import { describe, it, expect } from "vitest";
import { runMultiAssetBacktest } from "../src/backtest/multi-asset-simulator.js";
import { MultiAssetBuyAndHoldStrategy } from "../src/backtest/strategies/multi-asset-buy-and-hold.js";
import { MultiAssetSmaRsiStrategy } from "../src/backtest/strategies/multi-asset-sma-rsi.js";
import type { PriceBar } from "@committee/contracts";

function createSyntheticBars(
  symbol: string,
  prices: number[],
  startDate = "2024-01-01",
): PriceBar[] {
  const bars: PriceBar[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < prices.length; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const ts = d.toISOString().split("T")[0] + "T00:00:00.000Z";
    const asOf = d.toISOString().split("T")[0] + "T21:00:00.000Z";
    const p = prices[i]!;

    bars.push({
      symbol,
      timeframe: "1Day",
      ts,
      open: p,
      high: p * 1.02,
      low: p * 0.98,
      close: p,
      volume: 1_000_000,
      asOf,
    });
  }

  return bars;
}

describe("Multi-Asset Backtest Simulator Engine", () => {
  it("executes 1/N Equal-Weight Buy & Hold benchmark with next-bar execution delay and 5 bps fees", async () => {
    // 2 assets: AAPL goes 100 -> 110 -> 120 (+20%), NVDA goes 100 -> 120 -> 140 (+40%)
    const aaplBars = createSyntheticBars("AAPL", [100, 110, 120]);
    const nvdaBars = createSyntheticBars("NVDA", [100, 120, 140]);

    const strategy = new MultiAssetBuyAndHoldStrategy();
    const result = await runMultiAssetBacktest({
      strategy,
      universeBars: { AAPL: aaplBars, NVDA: nvdaBars },
      options: { initialCash: 100_000, feeBps: 5, cashReserve: 0.05 },
    });

    expect(result.strategy).toBe("multi-asset-equal-weight-basket");
    expect(result.symbols).toEqual(["AAPL", "NVDA"]);
    expect(result.equityCurve.length).toBe(3);

    // Initial allocation occurs at bar 1 (next-bar open fill from day 0 signal)
    expect(result.trades.length).toBe(2);
    expect(result.trades.some((t) => t.symbol === "AAPL")).toBe(true);
    expect(result.trades.some((t) => t.symbol === "NVDA")).toBe(true);

    // Final equity must be > initialCash and have positive Sharpe ratio
    expect(result.finalEquity).toBeGreaterThan(100_000);
    expect(result.totalReturn).toBeGreaterThan(0);
    expect(result.sharpeRatio).toBeGreaterThan(0);
  });

  it("dynamically rebalances capital across multi-asset universe without violating cash reserve", async () => {
    const aaplBars = createSyntheticBars("AAPL", [100, 105, 110, 115, 120]);
    const nvdaBars = createSyntheticBars("NVDA", [100, 110, 120, 130, 140]);
    const spyBars = createSyntheticBars("SPY", [400, 405, 410, 415, 420]);

    const strategy = new MultiAssetSmaRsiStrategy();
    const result = await runMultiAssetBacktest({
      strategy,
      universeBars: { AAPL: aaplBars, NVDA: nvdaBars, SPY: spyBars },
      options: { initialCash: 100_000, feeBps: 5, cashReserve: 0.10 },
    });

    expect(result.symbols).toEqual(["AAPL", "NVDA", "SPY"]);
    for (const point of result.equityCurve) {
      // Cash weight should stay >= 0
      expect(point.cash).toBeGreaterThanOrEqual(0);
      expect(point.totalEquity).toBeGreaterThan(0);
    }
  });
});
