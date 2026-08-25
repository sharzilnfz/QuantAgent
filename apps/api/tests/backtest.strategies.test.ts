import { describe, expect, it } from "vitest";
import { BuyAndHoldStrategy, createBuyAndHoldStrategy } from "../src/backtest/strategies/buy-and-hold.js";
import { SmaRsiStrategy, createSmaRsiStrategy } from "../src/backtest/strategies/sma-rsi.js";
import type { IndicatorSnapshot, PriceBar } from "../src/backtest/types.js";

function makeBar(ts: string, close: number, open: number = close): PriceBar {
  return {
    symbol: "AAPL",
    timeframe: "1Day",
    ts,
    open,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 1_000_000,
    asOf: ts,
  };
}

function makeSnapshot(
  ts: string,
  sma20: number | null,
  sma50: number | null,
  rsi: number | null,
): IndicatorSnapshot {
  return {
    symbol: "AAPL",
    timeframe: "1Day",
    ts,
    rsi,
    macd: null,
    macdSignal: null,
    bbUpper: null,
    bbLower: null,
    sma20,
    sma50,
    asOf: ts,
  };
}

describe("Backtest Strategies", () => {
  describe("BuyAndHoldStrategy", () => {
    it("emits 1.0 (fully invested long) across all bars", () => {
      const strategy = createBuyAndHoldStrategy();
      expect(strategy.name).toBe("buy-and-hold");

      const bars: PriceBar[] = [
        makeBar("2024-01-01T00:00:00.000Z", 100),
        makeBar("2024-01-02T00:00:00.000Z", 105),
        makeBar("2024-01-03T00:00:00.000Z", 95),
      ];

      const signals = strategy.generateSignals(bars);
      expect(signals).toEqual([1.0, 1.0, 1.0]);
    });

    it("returns empty signals for empty bar array", () => {
      const strategy = new BuyAndHoldStrategy();
      expect(strategy.generateSignals([])).toEqual([]);
    });
  });

  describe("SmaRsiStrategy", () => {
    it("returns flat (0.0) when indicators are in warmup / null", () => {
      const strategy = createSmaRsiStrategy();
      const bars = [makeBar("2024-01-01T00:00:00.000Z", 100)];
      const snapshots = [makeSnapshot("2024-01-01T00:00:00.000Z", null, null, null)];

      const signals = strategy.generateSignals(bars, snapshots);
      expect(signals).toEqual([0.0]);
    });

    it("returns long (1.0) when sma20 > sma50 AND rsi < 70", () => {
      const strategy = createSmaRsiStrategy();
      const bars = [makeBar("2024-01-01T00:00:00.000Z", 100)];
      const snapshots = [makeSnapshot("2024-01-01T00:00:00.000Z", 110, 100, 55)];

      const signals = strategy.generateSignals(bars, snapshots);
      expect(signals).toEqual([1.0]);
    });

    it("returns flat (0.0) when sma20 <= sma50 (bearish / trend filter not met)", () => {
      const strategy = createSmaRsiStrategy();
      const bars = [makeBar("2024-01-01T00:00:00.000Z", 100)];
      const snapshots = [makeSnapshot("2024-01-01T00:00:00.000Z", 95, 100, 50)];

      const signals = strategy.generateSignals(bars, snapshots);
      expect(signals).toEqual([0.0]);
    });

    it("returns flat (0.0) when rsi >= 70 (overbought)", () => {
      const strategy = createSmaRsiStrategy();
      const bars = [makeBar("2024-01-01T00:00:00.000Z", 100)];
      const snapshots = [makeSnapshot("2024-01-01T00:00:00.000Z", 110, 100, 75)];

      const signals = strategy.generateSignals(bars, snapshots);
      expect(signals).toEqual([0.0]);
    });

    it("computes indicators dynamically when snapshots are omitted", () => {
      const strategy = createSmaRsiStrategy();
      // 60 daily bars with rising prices -> sma20 will exceed sma50
      const bars: PriceBar[] = Array.from({ length: 60 }, (_, i) =>
        makeBar(
          new Date(2024, 0, i + 1).toISOString(),
          100 + i * 2,
        ),
      );

      const signals = strategy.generateSignals(bars);
      expect(signals.length).toBe(60);
      // Warmup first 49 bars (sma50 requires 50 bars) will be 0.0
      expect(signals[0]).toBe(0.0);
      expect(signals[48]).toBe(0.0);
    });
  });
});
