import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadFixture } from "@committee/fixtures";
import { ExperimentSuiteResult, VarianceSweepResult } from "@committee/contracts";
import { isLlmConfigured } from "../agents/technical/llm-client.js";
import { runBenchmarkSuite } from "./suite.js";
import { runVarianceSweep } from "./variance-sweep.js";
import { computeDatasetHash } from "./hash.js";

/**
 * OWNER: M4 (Evaluation Lab Experiments HTTP Surface).
 *
 *   GET /experiments/suite?symbol=AAPL
 *   GET /experiments/variance-sweep?symbol=AAPL&windowSize=25&runs=3[&live=1]
 *
 * Serves deterministic offline evaluation benchmark suites on frozen fixtures
 * and bounded variance sweeps over validation windows. `live=1` opts a sweep
 * into real LLM runs (budget-capped); it requires configured credentials and
 * is never cached, since its whole point is measuring nondeterminism.
 */

const SuiteQuery = z.object({
  symbol: z.string().min(1).default("AAPL"),
});

const VarianceSweepQuery = z.object({
  symbol: z.string().min(1).default("AAPL"),
  windowSize: z.coerce.number().min(10).max(100).default(25),
  runs: z.coerce.number().min(2).max(10).default(3),
  budget: z.coerce.number().positive().default(5.0),
  live: z.coerce.boolean().default(false),
});

// In-memory cache keyed by symbol and datasetHash for fast repeated evaluation reads
const suiteCache = new Map<string, ExperimentSuiteResult>();
const sweepCache = new Map<string, VarianceSweepResult>();

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

  app.get("/experiments/variance-sweep", async (request, reply) => {
    const queryResult = VarianceSweepQuery.safeParse(request.query ?? {});
    if (!queryResult.success) {
      return reply.code(400).send({
        error: "invalid_query",
        issues: queryResult.error.issues,
      });
    }

    const { symbol, windowSize, runs, budget, live } = queryResult.data;

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

    // Live LLM sweeps need credentials; without them the request degrades to the
    // deterministic offline mode rather than failing (zero-credential principle).
    const goLive = live && isLlmConfigured();
    if (live && !goLive) {
      request.log.warn(
        { symbol },
        "live variance sweep requested but no LLM credentials configured; falling back to deterministic offline mode",
      );
    }

    // Live sweeps are never cached — measuring nondeterminism requires fresh runs.
    if (goLive) {
      const sweep = await runVarianceSweep(fixture, {
        windowSize,
        runsCount: runs,
        budgetLimit: budget,
        deterministicOffline: false,
      });
      return reply.code(200).send(sweep);
    }

    const datasetHash = computeDatasetHash(fixture);
    const cacheKey = `${fixture.symbol.toUpperCase()}:${datasetHash}:${windowSize}:${runs}:${budget}`;

    let sweep = sweepCache.get(cacheKey);
    if (!sweep) {
      sweep = await runVarianceSweep(fixture, {
        windowSize,
        runsCount: runs,
        budgetLimit: budget,
        deterministicOffline: true,
      });
      sweepCache.set(cacheKey, sweep);
    }

    return reply.code(200).send(sweep);
  });
}
