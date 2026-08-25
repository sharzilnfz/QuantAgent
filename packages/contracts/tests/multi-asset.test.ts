import { describe, it, expect } from "vitest";
import {
  MultiAssetTrade,
  AssetPositionSnapshot,
  MultiAssetEquityPoint,
  MultiAssetBacktestResult,
  MultiAssetExperimentManifest,
  MultiAssetSuiteResult,
} from "../src/index.js";

describe("Multi-Asset Portfolio Contracts", () => {
  it("validates MultiAssetTrade with symbol tag", () => {
    const trade = {
      symbol: "AAPL",
      ts: "2024-01-03T16:00:00Z",
      price: 185.5,
      fromPosition: 0,
      toPosition: 0.33,
      shares: 175,
      value: 32462.5,
      fee: 16.23,
    };
    const parsed = MultiAssetTrade.parse(trade);
    expect(parsed.symbol).toBe("AAPL");
    expect(parsed.shares).toBe(175);
  });

  it("validates AssetPositionSnapshot and MultiAssetEquityPoint", () => {
    const snapshot: AssetPositionSnapshot = {
      symbol: "NVDA",
      shares: 100,
      price: 480.0,
      marketValue: 48000.0,
      weight: 0.48,
    };
    const parsedSnapshot = AssetPositionSnapshot.parse(snapshot);
    expect(parsedSnapshot.weight).toBe(0.48);

    const point: MultiAssetEquityPoint = {
      ts: "2024-01-03T16:00:00Z",
      cash: 52000.0,
      cashWeight: 0.52,
      totalEquity: 100000.0,
      drawdown: 0.0,
      positions: {
        NVDA: parsedSnapshot,
      },
    };
    const parsedPoint = MultiAssetEquityPoint.parse(point);
    expect(parsedPoint.totalEquity).toBe(100000.0);
    expect(parsedPoint.positions.NVDA?.shares).toBe(100);
  });

  it("validates MultiAssetExperimentManifest and MultiAssetSuiteResult", () => {
    const manifest: MultiAssetExperimentManifest = {
      id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      createdAt: new Date().toISOString(),
      gitCommit: "a1b2c3d",
      datasetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      symbols: ["AAPL", "NVDA", "SPY"],
      timeframe: "1Day",
      strategy: {
        name: "multi-asset-equal-weight-basket",
        type: "benchmark",
        description: "1/N Equal-Weight Buy & Hold Basket",
        parameters: {},
      },
      metrics: {
        initialCash: 100000,
        finalEquity: 125000,
        totalReturn: 0.25,
        annualizedReturn: 0.25,
        sharpeRatio: 1.65,
        sortinoRatio: 2.10,
        maxDrawdown: -0.08,
        totalTurnover: 1.0,
        tradeCount: 3,
        winRate: 1.0,
        profitFactor: 5.0,
      },
      trades: [
        {
          symbol: "AAPL",
          ts: "2024-01-03T16:00:00Z",
          price: 185.0,
          fromPosition: 0,
          toPosition: 0.33,
          shares: 175,
          value: 32375,
          fee: 16.18,
        },
      ],
      equityCurve: [
        {
          ts: "2024-01-03T16:00:00Z",
          cash: 67608.82,
          cashWeight: 0.676,
          totalEquity: 100000,
          drawdown: 0,
          positions: {
            AAPL: {
              symbol: "AAPL",
              shares: 175,
              price: 185.0,
              marketValue: 32375,
              weight: 0.3238,
            },
          },
        },
      ],
      perAssetTurnover: { AAPL: 0.33, NVDA: 0.33, SPY: 0.33 },
      perAssetTradeCount: { AAPL: 1, NVDA: 1, SPY: 1 },
    };

    const parsedManifest = MultiAssetExperimentManifest.parse(manifest);
    expect(parsedManifest.symbols).toEqual(["AAPL", "NVDA", "SPY"]);
    expect(parsedManifest.metrics.totalReturn).toBe(0.25);

    const suite: MultiAssetSuiteResult = {
      suiteId: "c7320b99-31ff-4848-93ee-84c48970e7e1",
      universe: ["AAPL", "NVDA", "SPY"],
      datasetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      gitCommit: "a1b2c3d",
      createdAt: new Date().toISOString(),
      benchmark: parsedManifest,
      experiments: [parsedManifest],
      totalDurationMs: 15.2,
      totalCost: 0.0,
    };

    const parsedSuite = MultiAssetSuiteResult.parse(suite);
    expect(parsedSuite.universe).toEqual(["AAPL", "NVDA", "SPY"]);
    const stratName = typeof parsedSuite.benchmark.strategy === "string"
      ? parsedSuite.benchmark.strategy
      : parsedSuite.benchmark.strategy.name;
    expect(stratName).toBe("multi-asset-equal-weight-basket");
  });
});
