import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ingestPlugin } from "../src/ingest/plugin.js";

/**
 * Route-level checks for POST /ingest/prices. Registers ONLY the ingest plugin
 * (plus @fastify/cookie, which the real composition root provides and which
 * spec 03's requireAuth reads the session cookie from) so this test needs
 * neither Postgres nor the other domains' plugins.
 *
 * The auth guard is `requireAuth` from spec 03 (M4). This test asserts the
 * guard is APPLIED — it does not re-test M4's session logic.
 */
describe("POST /ingest/prices", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(ingestPlugin);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("is registered", () => {
    expect(app.hasRoute({ method: "POST", url: "/ingest/prices" })).toBe(true);
  });

  it("rejects an unauthenticated request before doing any work", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/ingest/prices",
      payload: {
        symbols: ["AAPL"],
        from: "2024-03-01T00:00:00.000Z",
        to: "2024-03-15T00:00:00.000Z",
        timeframe: "1Day",
      },
    });

    // requireAuth fails closed. Whatever M4's final implementation, an
    // unauthenticated caller must never reach the ingestion body.
    expect(response.statusCode).toBe(401);
  });

  it("runs the auth guard even for a malformed body", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/ingest/prices",
      payload: { nonsense: true },
    });
    // Auth is a preHandler, so it short-circuits before schema validation —
    // an anonymous caller cannot probe the endpoint's validation behaviour.
    expect(response.statusCode).toBe(401);
  });
});
