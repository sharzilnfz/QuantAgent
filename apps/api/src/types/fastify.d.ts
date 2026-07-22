import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by requireAuth (spec 03) once a valid session is resolved. */
    user?: { id: string; email: string };
  }
}
