import { describe, it, expect } from "vitest";
import { MultiAssetCoordinatorStrategy } from "../src/agents/coordinator/multi-asset-strategy.js";
import { runMultiAssetBacktest } from "../src/backtest/multi-asset-simulator.js";
import { loadFixture } from "@committee/fixtures";

describe("MultiAssetCoordinatorStrategy Evaluation Integration", () => {
  it("coordinates multi-asset committee evaluation across AAPL, NVDA, and SPY frozen fixtures offline", async () => {
    const aapl = loadFixture("AAPL");
    const nvda = loadFixture("NVDA");
    const spy = loadFixture("SPY");

    // Slice to 25 bars for rapid verification
    const universeBars = {
      AAPL: aapl.bars.slice(0, 25),
      NVDA: nvda.bars.slice(0, 25),
      SPY: spy.bars.slice(0, 25),
    };

    const strategy = new MultiAssetCoordinatorStrategy({
      name: "test-multi-asset-coordinator",
      debateEnabled: true,
      deterministicOffline: true,
      newsBySymbol: {
        AAPL: aapl.news,
        NVDA: nvda.news,
        SPY: spy.news,
      },
      fundamentalsBySymbol: {
        AAPL: aapl.fundamentals ?? [],
        NVDA: nvda.fundamentals ?? [],
        SPY: spy.fundamentals ?? [],
      },
      predictionMarkets: aapl.predictionMarkets,
      sizingMethod: "conviction_weighted",
      logger: () => {},
    });

    const result = await runMultiAssetBacktest({
      strategy,
      universeBars,
      options: { initialCash: 100_000, feeBps: 5, cashReserve: 0.05 },
    });

    expect(result.strategy).toBe("test-multi-asset-coordinator");
    expect(result.symbols).toEqual(["AAPL", "NVDA", "SPY"]);
    expect(result.equityCurve.length).toBe(25);
    expect(result.finalEquity).toBeGreaterThan(0);

    const telemetry = strategy.getTelemetry();
    expect(telemetry.tokenCost).toBe(0); // $0.00 in offline mode
    expect(telemetry.fallbackRate).toBeGreaterThanOrEqual(0);
  });
});
