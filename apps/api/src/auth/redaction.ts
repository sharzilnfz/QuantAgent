import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * OWNER: M4 (spec 03 §5) — "never log request bodies for /auth/* or /credentials".
 *
 * Fastify does not log bodies by default, but two paths can still leak them:
 *   1. a body-parse / validation error whose message quotes the payload, and
 *   2. a well-meaning `log.error({ err })` where `err` drags a request context.
 *
 * `installSensitiveErrorHandler` closes both for an encapsulated plugin scope:
 * every error is logged as a fixed, body-free tuple and answered with a generic
 * response. Domain routes therefore never hand a body to the logger, and Zod
 * failures never echo the value that failed.
 */
export function installSensitiveErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(function sensitiveErrorHandler(
    err: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const statusCode = err.statusCode ?? 500;

    // Log the shape of the failure, never its payload.
    request.log.error(
      {
        url: request.url,
        method: request.method,
        statusCode,
        errName: err.name,
        errCode: err.code,
      },
      "request failed on a sensitive route (body intentionally not logged)",
    );

    if (statusCode >= 500) {
      return reply.code(500).send({ error: "internal_error" });
    }
    // 4xx from the framework (bad JSON, payload too large, ...) — generic text.
    return reply.code(statusCode).send({ error: "invalid_request" });
  });
}
