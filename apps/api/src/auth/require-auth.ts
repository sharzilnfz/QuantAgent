import type { FastifyReply, FastifyRequest } from "fastify";

import { SESSION_COOKIE, resolveSession, sessionCookieOptions } from "./session.js";

/**
 * OWNER: M4 (spec 03).
 *
 * requireAuth is the Fastify preHandler reused by every protected route
 * (credentials, portfolio, ingest, agents). It:
 *   1. reads the opaque session id from the httpOnly cookie,
 *   2. looks up a non-expired `sessions` row (rolling-refreshing its expiry),
 *   3. sets `request.user = { id, email }`, or replies 401 and FAILS CLOSED.
 *
 * SIGNATURE IS A CROSS-TEAM SEAM — other plugins do `{ preHandler: requireAuth }`.
 * Do not change it without coordinating with the owners of spec 04/06/07/08.
 *
 * Fail-closed contract: *any* problem — no cookie, malformed id, missing row,
 * expired row, or an error reaching the session store — results in 401 with
 * `request.user` left undefined. There is no path where a handler runs with a
 * silently-empty user.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const unauthorized = async (): Promise<void> => {
    // Clear a cookie we've just decided is worthless so the browser stops
    // replaying it on every subsequent request.
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    await reply.code(401).send({ error: "unauthorized" });
  };

  let session;
  try {
    session = await resolveSession(request.cookies[SESSION_COOKIE]);
  } catch (err) {
    // Never leak the cookie value into the log line.
    request.log.error(
      { err: (err as Error).message, url: request.url },
      "session lookup failed — failing closed",
    );
    return unauthorized();
  }

  if (!session) return unauthorized();

  request.user = session.user;

  // Rolling expiry is only useful if the browser learns about it.
  reply.setCookie(SESSION_COOKIE, session.sessionId, sessionCookieOptions());
}
