import { describe, expect, it } from "vitest";
import { IndicatorSnapshot, type PriceBar, Timeframe } from "@committee/contracts";
import { loadPriceBars } from "@committee/fixtures";

import {
  computeIndicatorSnapshots,
  prepareBars,
} from "../src/indicators/engine.js";

const CROSSOVER_BAR = 122;

function crossoverCloses(): number[] {
  const arr: number[] = [];
  for (let i = 0; i < 100; i++) arr.push(200.0 - i);
  for (let i = 100; i < 200; i++) arr.push(i + 2.0);
  return arr;
}

function makeSyntheticBars(
  closes: number[],
  options?: {
    symbol?: string;
    timeframe?: Timeframe;
    asOfOffsetsHours?: number[];
  },
): PriceBar[] {
  const symbol = options?.symbol ?? "SYNTH";
  const timeframe = options?.timeframe ?? Timeframe.Enum["1Day"];
  const firstTs = new Date("2024-01-02T00:00:00.000Z").getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  return closes.map((close, i) => {
    const tsDate = new Date(firstTs + i * oneDay);
    const offsetHours = options?.asOfOffsetsHours?.[i] ?? 21; // 21:00 UTC = session close
    const asOfDate = new Date(tsDate.getTime() + offsetHours * 60 * 60 * 1000);
    return {
      symbol,
      timeframe,
      ts: tsDate.toISOString(),
      open: close,
      high: close,
      low: close,
      close,
      volume: 1_000_000,
      asOf: asOfDate.toISOString(),
    };
  });
}

describe("prepareBars", () => {
  it("sorts bars by ts ascending and dedupes identical ts (last wins)", () => {
    const bar1: PriceBar = {
      symbol: "TEST",
      timeframe: Timeframe.Enum["1Day"],
      ts: "2024-01-02T00:00:00.000Z",
      open: 10,
      high: 10,
      low: 10,
      close: 10,
      volume: 100,
      asOf: "2024-01-02T21:00:00.000Z",
    };
    const bar2Original: PriceBar = {
      symbol: "TEST",
      timeframe: Timeframe.Enum["1Day"],
      ts: "2024-01-03T00:00:00.000Z",
      open: 20,
      high: 20,
      low: 20,
      close: 20,
      volume: 100,
      asOf: "2024-01-03T21:00:00.000Z",
    };
    const bar2Revised: PriceBar = {
      symbol: "TEST",
      timeframe: Timeframe.Enum["1Day"],
      ts: "2024-01-03T00:00:00.000Z",
      open: 22,
      high: 22,
      low: 22,
      close: 22,
      volume: 200,
      asOf: "2024-01-04T12:00:00.000Z",
    };
    const bar3: PriceBar = {
      symbol: "TEST",
      timeframe: Timeframe.Enum["1Day"],
      ts: "2024-01-04T00:00:00.000Z",
      open: 30,
      high: 30,
      low: 30,
      close: 30,
      volume: 100,
      asOf: "2024-01-04T21:00:00.000Z",
    };

    // Passed out of order and with duplicate
    const prepared = prepareBars([bar3, bar2Original, bar1, bar2Revised]);
    expect(prepared.length).toBe(3);
    expect(prepared[0]?.ts).toBe("2024-01-02T00:00:00.000Z");
    expect(prepared[1]?.ts).toBe("2024-01-03T00:00:00.000Z");
    expect(prepared[1]?.close).toBe(22); // Revised bar wins
    expect(prepared[2]?.ts).toBe("2024-01-04T00:00:00.000Z");
  });

  it("filters bars using asOfMax before sorting", () => {
    const bars = makeSyntheticBars([10, 20, 30, 40, 50]);
    const asOfBoundary = bars[2]?.asOf; // only first 3 bars knowable
    expect(asOfBoundary).toBeDefined();
    const prepared = prepareBars(bars, asOfBoundary);
    expect(prepared.length).toBe(3);
    expect(prepared.map((b) => b.close)).toEqual([10, 20, 30]);
  });

  it("returns empty array on empty input", () => {
    expect(prepareBars([])).toEqual([]);
  });
});

describe("computeIndicatorSnapshots - Point-in-time discipline", () => {
  it("maintains running max of asOf", () => {
    // Simulate an out-of-order revision where bar 0 was revised later than bar 1
    const closes = [100, 101, 102, 103];
    const offsets = [48, 21, 21, 21]; // bar 0 has asOf +48h (later than bar 1's asOf)
    const bars = makeSyntheticBars(closes, { asOfOffsetsHours: offsets });

    const snapshots = computeIndicatorSnapshots(bars);
    expect(snapshots.length).toBe(4);

    const bar0 = bars[0];
    const snap0 = snapshots[0];
    const snap1 = snapshots[1];
    expect(bar0).toBeDefined();
    expect(snap0).toBeDefined();
    expect(snap1).toBeDefined();

    if (bar0 && snap0 && snap1) {
      // Snapshot at bar 0 asOf is bars[0].asOf
      expect(snap0.asOf).toBe(bar0.asOf);
      // Snapshot at bar 1 must NOT step backwards to bars[1].asOf; it must equal bars[0].asOf
      expect(new Date(snap1.asOf).getTime()).toBeGreaterThanOrEqual(
        new Date(bar0.asOf).getTime(),
      );
      expect(snap1.asOf).toBe(bar0.asOf);
    }

    // Verify all snapshot asOf timestamps are monotonically non-decreasing
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      if (prev && curr) {
        expect(new Date(curr.asOf).getTime()).toBeGreaterThanOrEqual(
          new Date(prev.asOf).getTime(),
        );
      }
    }
  });

  it("strictly excludes future bars when asOfMax is specified", () => {
    const bars = makeSyntheticBars(crossoverCloses());
    const boundary = bars[50]?.asOf;
    expect(boundary).toBeDefined();
    if (!boundary) return;

    const snapshots = computeIndicatorSnapshots(bars, { asOfMax: boundary });

    expect(snapshots.length).toBe(51);
    for (const snap of snapshots) {
      expect(new Date(snap.asOf).getTime()).toBeLessThanOrEqual(
        new Date(boundary).getTime(),
      );
    }
  });
});

describe("computeIndicatorSnapshots - Contract validation & Accuracy", () => {
  it("conforms to Zod IndicatorSnapshot schema on every record", () => {
    const bars = makeSyntheticBars(crossoverCloses());
    const snapshots = computeIndicatorSnapshots(bars);

    expect(snapshots.length).toBe(bars.length);
    for (const snap of snapshots) {
      // Must validate without throwing
      const parsed = IndicatorSnapshot.parse(snap);
      expect(parsed.symbol).toBe("SYNTH");
      expect(parsed.timeframe).toBe("1Day");
    }
  });

  it("verifies warm-up nulls and SMA crossover bar", () => {
    const bars = makeSyntheticBars(crossoverCloses());
    const snapshots = computeIndicatorSnapshots(bars);

    // Warm-up null checks
    expect(snapshots[18]?.sma20).toBeNull();
    expect(snapshots[19]?.sma20).not.toBeNull();

    expect(snapshots[48]?.sma50).toBeNull();
    expect(snapshots[49]?.sma50).not.toBeNull();

    expect(snapshots[13]?.rsi).toBeNull();
    expect(snapshots[14]?.rsi).not.toBeNull();

    // MACD slow length = 26 -> null before index 25
    expect(snapshots[24]?.macd).toBeNull();
    expect(snapshots[25]?.macd).not.toBeNull();

    // Signal line needs 25 (first macd) + 9 = 33 bars -> null before index 33
    expect(snapshots[32]?.macdSignal).toBeNull();
    expect(snapshots[33]?.macdSignal).not.toBeNull();

    // Crossover at bar 122
    const atCrossover = snapshots[CROSSOVER_BAR];
    const beforeCrossover = snapshots[CROSSOVER_BAR - 1];

    expect(atCrossover).toBeDefined();
    expect(beforeCrossover).toBeDefined();

    if (atCrossover && beforeCrossover) {
      expect(atCrossover.sma20).toBeCloseTo(114.5, 2);
      expect(atCrossover.sma50).toBeCloseTo(113.54, 2);
      expect(atCrossover.sma20!).toBeGreaterThan(atCrossover.sma50!);

      expect(beforeCrossover.sma20).toBeCloseTo(113.5, 2);
      expect(beforeCrossover.sma50).toBeCloseTo(113.62, 2);
      expect(beforeCrossover.sma20!).toBeLessThan(beforeCrossover.sma50!);
    }
  });

  it("is bit-identical and deterministic across repeated invocations", () => {
    const bars = makeSyntheticBars(crossoverCloses());
    const first = computeIndicatorSnapshots(bars);
    const second = computeIndicatorSnapshots(bars);
    expect(first).toEqual(second);
  });
});

describe("computeIndicatorSnapshots - Frozen Fixtures (@committee/fixtures)", () => {
  const symbols = ["AAPL", "NVDA", "SPY"];

  for (const symbol of symbols) {
    it(`computes valid indicator snapshots for frozen fixture ${symbol}`, () => {
      const bars = loadPriceBars(symbol);
      expect(bars.length).toBeGreaterThan(100);

      const snapshots = computeIndicatorSnapshots(bars);
      expect(snapshots.length).toBe(bars.length);

      // Validate all against Zod
      for (const snap of snapshots) {
        IndicatorSnapshot.parse(snap);
      }

      // Beyond warm-up (e.g. at index 60), all indicators must be populated numbers
      const matureSnap = snapshots[60];
      expect(matureSnap).toBeDefined();
      if (matureSnap) {
        expect(typeof matureSnap.rsi).toBe("number");
        expect(typeof matureSnap.macd).toBe("number");
        expect(typeof matureSnap.macdSignal).toBe("number");
        expect(typeof matureSnap.bbUpper).toBe("number");
        expect(typeof matureSnap.bbLower).toBe("number");
        expect(typeof matureSnap.sma20).toBe("number");
        expect(typeof matureSnap.sma50).toBe("number");
      }

      // Verify Bollinger Band order: lower <= sma20 (mid) <= upper
      for (let i = 20; i < snapshots.length; i++) {
        const s = snapshots[i];
        if (s && s.bbLower !== null && s.bbUpper !== null && s.sma20 !== null) {
          expect(s.bbLower).toBeLessThanOrEqual(s.sma20);
          expect(s.sma20).toBeLessThanOrEqual(s.bbUpper);
        }
      }

      // Verify RSI bounds: 0 <= rsi <= 100
      for (let i = 14; i < snapshots.length; i++) {
        const s = snapshots[i];
        if (s && s.rsi !== null) {
          expect(s.rsi).toBeGreaterThanOrEqual(0);
          expect(s.rsi).toBeLessThanOrEqual(100);
        }
      }
    });

    it(`enforces point-in-time boundary on fixture ${symbol}`, () => {
      const bars = loadPriceBars(symbol);
      const midpointIndex = Math.floor(bars.length / 2);
      const asOfBoundary = bars[midpointIndex]?.asOf;
      expect(asOfBoundary).toBeDefined();
      if (!asOfBoundary) return;

      const snapshots = computeIndicatorSnapshots(bars, { asOfMax: asOfBoundary });
      expect(snapshots.length).toBeLessThanOrEqual(midpointIndex + 1);

      for (const snap of snapshots) {
        expect(new Date(snap.asOf).getTime()).toBeLessThanOrEqual(
          new Date(asOfBoundary).getTime(),
        );
      }
    });
  }
});
