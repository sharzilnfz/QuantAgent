import { describe, expect, it } from "vitest";
import { runBacktest } from "../src/backtest/simulator.js";
import { BuyAndHoldStrategy } from "../src/backtest/strategies/buy-and-hold.js";
import type { PriceBar, SignalType, Strategy } from "../src/backtest/types.js";

function makeBar(
  ts: string,
  open: number,
  close: number,
  symbol: string = "AAPL",
): PriceBar {
  return {
    symbol,
    timeframe: "1Day",
    ts,
    open,
    high: Math.max(open, close) * 1.01,
    low: Math.min(open, close) * 0.99,
    close,
    volume: 1_000_000,
    asOf: ts,
  };
}

describe("Backtest Execution Simulator", () => {
  it("enforces 1-bar execution delay: fills signal at bar T+1 open", async () => {
    // Custom strategy that signals BUY on bar 0 and FLAT on bar 2
    const customStrategy: Strategy = {
      name: "test-delayed-strategy",
      generateSignals(bars: PriceBar[]): SignalType[] {
        return bars.map((_, i) => (i === 0 ? 1.0 : i >= 2 ? 0.0 : 1.0));
      },
    };

    const bars: PriceBar[] = [
      makeBar("2024-01-01T00:00:00.000Z", 100, 105), // Bar 0: signal 1.0 generated
      makeBar("2024-01-02T00:00:00.000Z", 110, 115), // Bar 1: signal 1.0 executed at open=110
      makeBar("2024-01-03T00:00:00.000Z", 120, 125), // Bar 2: signal 0.0 generated
      makeBar("2024-01-04T00:00:00.000Z", 130, 135), // Bar 3: signal 0.0 executed at open=130
    ];

    const result = await runBacktest(customStrategy, bars, {
      initialCash: 10_000,
      feeBps: 0, // Zero fee for simple math check
      slippageBps: 0,
    });

    expect(result.trades).toHaveLength(2);

    // Trade 1: executed at bar 1 open price ($110)
    const trade1 = result.trades[0];
    expect(trade1).toBeDefined();
    if (!trade1) throw new Error("trade1 undefined");
    expect(trade1.ts).toBe("2024-01-02T00:00:00.000Z");
    expect(trade1.price).toBe(110);
    expect(trade1.fromPosition).toBe(0);
    expect(trade1.toPosition).toBe(1);

    // Trade 2: executed at bar 3 open price ($130)
    const trade2 = result.trades[1];
    expect(trade2).toBeDefined();
    if (!trade2) throw new Error("trade2 undefined");
    expect(trade2.ts).toBe("2024-01-04T00:00:00.000Z");
    expect(trade2.price).toBe(130);
    expect(trade2.fromPosition).toBe(1);
    expect(trade2.toPosition).toBe(0);
  });

  it("deducts transaction fees (5 bps default)", async () => {
    const strategy = new BuyAndHoldStrategy();
    const bars: PriceBar[] = [
      makeBar("2024-01-01T00:00:00.000Z", 100, 100),
      makeBar("2024-01-02T00:00:00.000Z", 100, 100),
    ];

    const result = await runBacktest(strategy, bars, {
      initialCash: 10_000,
      feeBps: 5, // 0.05%
    });

    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    expect(trade).toBeDefined();
    if (!trade) throw new Error("trade undefined");
    // With 5 bps, fee = value * 0.0005
    expect(trade.fee).toBeCloseTo(trade.value * 0.0005, 2);
    // Ending cash + stock value should reflect the fee deduction
    expect(result.finalEquity).toBeLessThan(10_000);
  });

  it("applies slippage modeling on entry and exit", async () => {
    const buySellStrategy: Strategy = {
      name: "slippage-strategy",
      generateSignals(bars: PriceBar[]): SignalType[] {
        return bars.map((_, i) => (i === 0 ? 1.0 : 0.0));
      },
    };

    const bars: PriceBar[] = [
      makeBar("2024-01-01T00:00:00.000Z", 100, 100),
      makeBar("2024-01-02T00:00:00.000Z", 100, 100), // Buy filled here
      makeBar("2024-01-03T00:00:00.000Z", 100, 100), // Sell filled here
    ];

    const result = await runBacktest(buySellStrategy, bars, {
      initialCash: 10_000,
      feeBps: 0,
      slippageBps: 10, // 10 bps = 0.1%
    });

    expect(result.trades).toHaveLength(2);
    const t0 = result.trades[0];
    const t1 = result.trades[1];
    expect(t0).toBeDefined();
    expect(t1).toBeDefined();
    if (!t0 || !t1) throw new Error("trades undefined");
    // Buy execution price is higher due to slippage: 100 * (1 + 0.001) = 100.1
    expect(t0.price).toBe(100.1);
    // Sell execution price is lower due to slippage: 100 * (1 - 0.001) = 99.9
    expect(t1.price).toBe(99.9);
  });

  it("produces complete equity curve and drawdown for Buy & Hold", async () => {
    const strategy = new BuyAndHoldStrategy();
    const bars: PriceBar[] = [
      makeBar("2024-01-01T00:00:00.000Z", 100, 100),
      makeBar("2024-01-02T00:00:00.000Z", 100, 110),
      makeBar("2024-01-03T00:00:00.000Z", 110, 90),
      makeBar("2024-01-04T00:00:00.000Z", 90, 120),
    ];

    const result = await runBacktest(strategy, bars, {
      initialCash: 10_000,
      feeBps: 0,
    });

    expect(result.equityCurve).toHaveLength(4);
    const eq0 = result.equityCurve[0];
    const eq2 = result.equityCurve[2];
    expect(eq0).toBeDefined();
    expect(eq2).toBeDefined();
    if (!eq0 || !eq2) throw new Error("equityCurve undefined");
    expect(eq0.equity).toBe(10_000);
    // On bar 2, price drops to 90 -> drawdown should be negative
    expect(eq2.drawdown).toBeLessThan(0);
    expect(result.maxDrawdown).toBeLessThan(0);
  });

  it("handles empty bars safely", async () => {
    const strategy = new BuyAndHoldStrategy();
    const result = await runBacktest(strategy, [], { initialCash: 50_000 });
    expect(result.initialCash).toBe(50_000);
    expect(result.finalEquity).toBe(50_000);
    expect(result.trades).toHaveLength(0);
    expect(result.equityCurve).toHaveLength(0);
    expect(result.totalReturn).toBe(0);
  });
});
