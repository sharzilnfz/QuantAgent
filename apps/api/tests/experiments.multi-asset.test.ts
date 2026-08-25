import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { experimentsPlugin } from "../src/experiments/plugin.js";
import { MultiAssetSuiteResult } from "@committee/contracts";

describe("Multi-Asset Evaluation Benchmark Suite Plugin", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(experimentsPlugin);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it(
    "GET /experiments/multi-asset/suite returns contract-valid MultiAssetSuiteResult for AAPL, NVDA, SPY",
    async () => {
      const res = await app.inject({
        method: "GET",
        url: "/experiments/multi-asset/suite?universe=AAPL,NVDA,SPY",
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);

      const parsed = MultiAssetSuiteResult.parse(json);
      expect(parsed.universe).toEqual(["AAPL", "NVDA", "SPY"]);
      expect(parsed.benchmark.strategyConfig?.name).toBe("multi-asset-equal-weight-basket");
      expect(parsed.experiments.length).toBeGreaterThanOrEqual(4);

      // Verify benchmark deltas are computed
      const debateOn = parsed.experiments.find((e) =>
        typeof e.strategy === "string"
          ? e.strategy.includes("debate-on")
          : e.strategy.name.includes("debate-on"),
      );
      expect(debateOn).toBeDefined();
      expect(debateOn?.benchmarkDelta).toBeDefined();
      expect(typeof debateOn?.benchmarkDelta?.sharpeRatio).toBe("number");
    },
    30000,
  );
});
