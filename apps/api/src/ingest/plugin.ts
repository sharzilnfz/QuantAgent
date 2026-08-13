import type { FastifyInstance } from "fastify";

import { requireAuth } from "../auth/require-auth.js";
import { MarketDataIngestor } from "./market-data-ingestor.js";
import { IngestRequest } from "./prices.js";

/**
 * OWNER: M2 (spec 04) — Market Data Ingestion.
 * Registers: POST /ingest/prices (auth required).
 *
 * Thin transport shell only. Ingestion logic is delegated to `MarketDataIngestor`,
 * and point-in-time semantics live in `./as-of.ts`.
 */
export async function ingestPlugin(app: FastifyInstance): Promise<void> {
  app.post("/ingest/prices", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = IngestRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await MarketDataIngestor.ingest(parsed.data);
      // Partial failure is reported, not thrown: the caller sees exactly what
      // was ingested and which symbols failed.
      return reply.code(200).send(result);
    } catch (error) {
      request.log.error({ err: error }, "ingest/prices failed");
      return reply.code(502).send({
        error: "ingest_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

