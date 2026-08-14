import type { FastifyInstance } from "fastify";

import { DuplicateEmailError, InvalidCredentialsError } from "./errors.js";
import { installSensitiveErrorHandler } from "./redaction.js";
import { requireAuth } from "./require-auth.js";
import { LoginBody, RegisterBody } from "./schemas.js";
import { authenticate, registerUser } from "./service.js";
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  sessionCookieOptions,
} from "./session.js";

/**
 * OWNER: M4 (spec 03) — User Auth & Session Management.
 *
 * Registers: POST /auth/register, POST /auth/login, POST /auth/logout,
 * GET /auth/me.
 *
 * LOGGING RULE (spec 03 §5): nothing in this file passes a request body,
 * password, email or session id to the logger. The plugin-scoped error handler
 * from ./redaction.js enforces the same for framework-level failures.
 */
export async function authPlugin(app: FastifyInstance): Promise<void> {
  installSensitiveErrorHandler(app);

  app.post("/auth/register", async (request, reply) => {
    const parsed = RegisterBody.safeParse(request.body);
    if (!parsed.success) {
      // Deliberately generic: a field-level message would echo the payload.
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      const user = await registerUser(parsed.data.email, parsed.data.password);
      const { sessionId } = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE, sessionId, sessionCookieOptions());
      return reply.code(201).send({ user });
    } catch (err) {
      if (err instanceof DuplicateEmailError) {
        return reply.code(409).send({ error: "email_already_registered" });
      }
      throw err;
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = LoginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      const user = await authenticate(parsed.data.email, parsed.data.password);
      const { sessionId } = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE, sessionId, sessionCookieOptions());
      return reply.code(200).send({ user });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        // Same status + same body for unknown email and wrong password.
        return reply.code(401).send({ error: "invalid_credentials" });
      }
      throw err;
    }
  });

  /**
   * Logout is intentionally NOT behind requireAuth: an already-dead session
   * must still clear the client cookie rather than bounce with a 401.
   */
  app.post("/auth/logout", async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId) {
      try {
        await destroySession(sessionId);
      } catch (err) {
        request.log.error(
          { err: (err as Error).message },
          "failed to delete session row on logout",
        );
      }
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (request, reply) => {
    // requireAuth guarantees request.user; the guard keeps TS honest and keeps
    // the route failing closed even if the preHandler chain is ever reordered.
    if (!request.user) return reply.code(401).send({ error: "unauthorized" });
    return reply.code(200).send({ user: request.user });
  });
}
