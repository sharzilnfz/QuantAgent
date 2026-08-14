import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadFixture } from "@committee/fixtures";
import { ExperimentSuiteResult } from "@committee/contracts";
import { runBenchmarkSuite } from "./suite.js";
import { computeDatasetHash } from "./hash.js";

/**
 * OWNER: M4 (Evaluation Lab Experiments HTTP Surface).
 *
 *   GET /experiments/suite?symbol=AAPL
 *
 * Serves deterministic offline evaluation benchmark suites on frozen fixtures.
 * Caches suite results in memory by symbol/datasetHash for fast repeated queries.
 */

const SuiteQuery = z.object({
  symbol: z.string().min(1).default("AAPL"),
});

// In-memory cache keyed by symbol and datasetHash for fast repeated evaluation reads
const suiteCache = new Map<string, ExperimentSuiteResult>();

export async function experimentsPlugin(app: FastifyInstance): Promise<void> {
  app.get("/experiments/suite", async (request, reply) => {
    const queryResult = SuiteQuery.safeParse(request.query ?? {});
    if (!queryResult.success) {
      return reply.code(400).send({
        error: "invalid_query",
        issues: queryResult.error.issues,
      });
    }

    const { symbol } = queryResult.data;

    let fixture;
    try {
      fixture = loadFixture(symbol);
    } catch (err) {
      request.log.warn({ symbol, err: (err as Error).message }, "Fixture not found");
      return reply.code(404).send({
        error: "fixture_not_found",
        message: `Fixture for symbol "${symbol.toUpperCase()}" not found.`,
      });
    }

    const datasetHash = computeDatasetHash(fixture);
    const cacheKey = `${fixture.symbol.toUpperCase()}:${datasetHash}`;

    let suite = suiteCache.get(cacheKey);
    if (!suite) {
      suite = await runBenchmarkSuite(fixture);
      suiteCache.set(cacheKey, suite);
    }

    return reply.code(200).send(suite);
  });
}
