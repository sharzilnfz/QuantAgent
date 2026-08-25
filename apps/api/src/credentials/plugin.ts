import type { FastifyInstance } from "fastify";

import { installSensitiveErrorHandler } from "../auth/redaction.js";
import { requireAuth } from "../auth/require-auth.js";
import { config } from "../config.js";
import { StoreCredentialsBody } from "./schemas.js";
import { getCredentialStatus, storeCredentials } from "./service.js";

/**
 * OWNER: M4 (spec 03) — Alpaca credential vault (AES-256-GCM at rest).
 *
 * Registers: POST /credentials, GET /credentials/status. Both require a session.
 *
 * INVARIANTS ENFORCED HERE:
 *  - No response ever contains a plaintext key or secret. `/credentials` answers
 *    204 with an empty body; `/credentials/status` answers only
 *    `{ connected, keyTail }` where keyTail is at most 4 characters.
 *  - No log line in this file receives the request body or any field of it.
 */
export async function credentialsPlugin(app: FastifyInstance): Promise<void> {
  installSensitiveErrorHandler(app);

  app.post("/credentials", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "unauthorized" });

    // An unconfigured vault is a deploy state, not a crypto failure: say so
    // plainly instead of letting it surface as an opaque 500 from the redactor.
    if (!config.CREDENTIAL_ENC_KEY) {
      return reply.code(503).send({
        error: "vault_not_configured",
        message:
          "CREDENTIAL_ENC_KEY is not set on the server — credential storage is disabled.",
      });
    }

    const parsed = StoreCredentialsBody.safeParse(request.body);
    if (!parsed.success) {
      // Generic — a Zod issue list could echo the submitted key.
      return reply.code(400).send({ error: "invalid_request" });
    }

    await storeCredentials(request.user.id, parsed.data);
    return reply.code(204).send();
  });

  app.get(
    "/credentials/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: "unauthorized" });

      const status = await getCredentialStatus(request.user.id);
      return reply.code(200).send(status);
    },
  );
}
