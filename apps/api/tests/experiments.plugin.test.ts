import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ExperimentSuiteResult, VarianceSweepResult } from "@committee/contracts";
import { buildApp } from "../src/app.js";

describe("Experiments Plugin HTTP Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /experiments/suite", () => {
    it("returns a contract-valid ExperimentSuiteResult for default symbol (AAPL)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/experiments/suite",
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      const parsed = ExperimentSuiteResult.safeParse(json);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;

      expect(parsed.data.symbol).toBe("AAPL");
      expect(parsed.data.datasetHash).toBeTruthy();
      expect(parsed.data.benchmark).toBeDefined();
      expect(parsed.data.benchmark?.strategyConfig?.name).toBe("buy-and-hold");

      const strategyNames = parsed.data.experiments.map((exp) => exp.strategyConfig?.name);
      expect(strategyNames).toContain("buy-and-hold");
      expect(strategyNames).toContain("sma-rsi");
      expect(strategyNames).toContain("multi-agent-debate-on");
      expect(strategyNames).toContain("multi-agent-debate-off");
      expect(strategyNames).toContain("multi-agent-polymarket");
    }, 15000);

    it("serves cached result on repeated requests", async () => {
      const res1 = await app.inject({
        method: "GET",
        url: "/experiments/suite?symbol=AAPL",
      });
      expect(res1.statusCode).toBe(200);

      const res2 = await app.inject({
        method: "GET",
        url: "/experiments/suite?symbol=AAPL",
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().datasetHash).toBe(res1.json().datasetHash);
      expect(res2.json().id).toBe(res1.json().id);
    });

    it("returns 404 when fixture symbol does not exist", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/experiments/suite?symbol=NONEXISTENT_TICKER_123",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("fixture_not_found");
    });
  });

  describe("GET /experiments/variance-sweep", () => {
    it("returns a contract-valid VarianceSweepResult with equity variance bands", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/experiments/variance-sweep?symbol=AAPL&windowSize=20&runs=3",
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();

      const parsed = VarianceSweepResult.safeParse(json);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;

      expect(parsed.data.symbol).toBe("AAPL");
      expect(parsed.data.runsCount).toBe(3);
      expect(parsed.data.windowSize).toBe(20);
      expect(parsed.data.runs).toHaveLength(3);
      expect(parsed.data.equityBands.length).toBeGreaterThan(0);
      expect(parsed.data.totalCost).toBeLessThan(5.0);
    });
  });
});

