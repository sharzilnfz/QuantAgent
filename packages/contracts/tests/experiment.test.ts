import { describe, it, expect } from "vitest";
import {
  ExperimentManifest,
  ExperimentStrategyConfig,
  BenchmarkDelta,
  ExperimentSuiteResult,
} from "../src/index.js";

describe("Experiment contracts", () => {
  const validMetrics = {
    initialCash: 100000,
    finalEquity: 125000,
    totalReturn: 0.25,
    annualizedReturn: 0.25,
    sharpeRatio: 1.85,
    sortinoRatio: 2.15,
    maxDrawdown: -0.08,
    totalTurnover: 200000,
    tradeCount: 12,
    winRate: 0.67,
    profitFactor: 2.1,
  };

  const validManifest = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    createdAt: "2026-08-14T12:00:00.000Z",
    gitCommit: "a1b2c3d4e5f6",
    datasetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    symbol: "AAPL",
    timeframe: "1Day",
    strategy: "SMA(20/50)+RSI(14)",
    strategyConfig: {
      name: "SMA(20/50)+RSI(14)",
      type: "deterministic",
      parameters: { fastPeriod: 20, slowPeriod: 50, rsiPeriod: 14 },
    },
    metrics: validMetrics,
    benchmarkDelta: {
      totalReturn: 0.05,
      annualizedReturn: 0.05,
      sharpeRatio: 0.42,
      sortinoRatio: 0.55,
      maxDrawdown: 0.04,
      winRate: 0.12,
      deltaTotalReturn: 0.05,
      deltaAnnualizedReturn: 0.05,
      deltaSharpeRatio: 0.42,
      deltaSortinoRatio: 0.55,
      deltaMaxDrawdown: 0.04,
      deltaWinRate: 0.12,
    },
    trades: [
      {
        ts: "2023-01-05T00:00:00.000Z",
        price: 150.5,
        fromPosition: 0,
        toPosition: 1,
        shares: 664,
        value: 99932,
        fee: 49.97,
      },
    ],
    equityCurve: [
      {
        ts: "2023-01-05T00:00:00.000Z",
        cash: 18.03,
        position: 0.9998,
        price: 150.5,
        equity: 99950.03,
        drawdown: 0,
      },
    ],
    metadata: {
      tags: ["baseline", "evaluation-lab"],
    },
  };

  it("successfully parses a valid ExperimentManifest", () => {
    const parsed = ExperimentManifest.parse(validManifest);
    expect(parsed.id).toBe(validManifest.id);
    expect(parsed.strategy).toBe("SMA(20/50)+RSI(14)");
    expect(parsed.benchmarkDelta?.sharpeRatio).toBe(0.42);
    expect(parsed.trades.length).toBe(1);
    expect(parsed.equityCurve.length).toBe(1);
  });

  it("defaults parameters to empty object if omitted in ExperimentStrategyConfig", () => {
    const parsed = ExperimentStrategyConfig.parse({ name: "BuyAndHold" });
    expect(parsed.parameters).toEqual({});
  });

  it("validates BenchmarkDelta schema", () => {
    const delta = BenchmarkDelta.parse({
      totalReturn: 0.1,
      annualizedReturn: 0.1,
      sharpeRatio: 0.5,
      sortinoRatio: 0.6,
      maxDrawdown: 0.02,
    });
    expect(delta.sharpeRatio).toBe(0.5);
  });

  it("parses valid ExperimentSuiteResult", () => {
    const suite = ExperimentSuiteResult.parse({
      id: "123e4567-e89b-12d3-a456-426614174001",
      createdAt: "2026-08-14T12:00:00.000Z",
      symbol: "AAPL",
      datasetHash: validManifest.datasetHash,
      gitCommit: validManifest.gitCommit,
      benchmark: {
        ...validManifest,
        strategy: "BuyAndHold",
        strategyConfig: { name: "BuyAndHold" },
        benchmarkDelta: undefined,
      },
      experiments: [validManifest],
      summary: { totalExperiments: 2 },
    });
    expect(suite.experiments.length).toBe(1);
    expect(suite.benchmark.strategy).toBe("BuyAndHold");
  });

  it("rejects missing metrics in manifest", () => {
    const { metrics: _, ...withoutMetrics } = validManifest;
    expect(() => ExperimentManifest.parse(withoutMetrics)).toThrow();
  });
});
