import { describe, expect, it } from "vitest";

import {
  classify,
  hasNoUsableFacts,
  rsiZone,
  type IndicatorFacts,
} from "../src/agents/technical/classify.js";

/**
 * Spec 07 §7 — plausible-bounds tests.
 *
 * These assert on the DETERMINISTIC read only. No LLM is involved, so nothing here
 * depends on model wording — exactly what the PRD's testing decisions demand.
 */

const empty: IndicatorFacts = {
  rsi: null,
  macd: null,
  macdSignal: null,
  bbUpper: null,
  bbLower: null,
  sma20: null,
  sma50: null,
  close: null,
};

describe("classify — plausible bounds", () => {
  it("leans bullish on strongly oversold + bullish MACD cross + below lower band", () => {
    const read = classify({
      ...empty,
      rsi: 21,
      macd: 1.4,
      macdSignal: 0.6,
      bbLower: 95,
      bbUpper: 115,
      sma20: 104,
      sma50: 100,
      close: 92,
    });

    expect(read.direction).toBe("bullish");
    expect(read.score).toBeGreaterThan(0);
    expect(read.strength).toBeGreaterThan(0);
    expect(read.rule).toContain("rsi_oversold");
    expect(read.rule).toContain("macd_bull_cross");
    expect(read.rule).toContain("close_below_lower_band");
  });

  it("leans bearish on strongly overbought + bearish MACD cross + above upper band", () => {
    const read = classify({
      ...empty,
      rsi: 82,
      macd: 0.2,
      macdSignal: 1.1,
      bbLower: 95,
      bbUpper: 115,
      sma20: 100,
      sma50: 104,
      close: 121,
    });

    expect(read.direction).toBe("bearish");
    expect(read.score).toBeLessThan(0);
    expect(read.rule).toContain("rsi_overbought");
    expect(read.rule).toContain("macd_bear_cross");
    expect(read.rule).toContain("close_above_upper_band");
  });

  it("returns neutral when the signals cancel out", () => {
    const read = classify({
      ...empty,
      rsi: 50,
      macd: 0.5,
      macdSignal: 0.5,
      bbLower: 90,
      bbUpper: 110,
      sma20: 100,
      sma50: 100,
      close: 100,
    });

    expect(read.direction).toBe("neutral");
    expect(read.rule).toBe("none");
  });
});

describe("classify — invariants", () => {
  it("keeps score in [-1,1] and strength/coverage in [0,1]", () => {
    const samples: IndicatorFacts[] = [
      { ...empty, rsi: 5, macd: 9, macdSignal: -9, bbLower: 100, close: 1, sma20: 50, sma50: 10 },
      { ...empty, rsi: 95, macd: -9, macdSignal: 9, bbUpper: 10, close: 999, sma20: 10, sma50: 50 },
      { ...empty, rsi: 55 },
      empty,
    ];

    for (const facts of samples) {
      const read = classify(facts);
      expect(read.score).toBeGreaterThanOrEqual(-1);
      expect(read.score).toBeLessThanOrEqual(1);
      expect(read.strength).toBeGreaterThanOrEqual(0);
      expect(read.strength).toBeLessThanOrEqual(1);
      expect(read.coverage).toBeGreaterThanOrEqual(0);
      expect(read.coverage).toBeLessThanOrEqual(1);
    }
  });

  it("is a pure function — repeated calls are identical", () => {
    const facts: IndicatorFacts = { ...empty, rsi: 28, macd: 1, macdSignal: 0, close: 99, sma20: 100, sma50: 98 };
    expect(classify(facts)).toEqual(classify(facts));
  });

  it("flags an all-null snapshot as unusable rather than inventing a bias", () => {
    const read = classify(empty);
    expect(hasNoUsableFacts(read)).toBe(true);
    expect(read.direction).toBe("neutral");
    expect(read.strength).toBe(0);
  });

  it("scales strength down when few indicators are available", () => {
    const partial = classify({ ...empty, rsi: 20 });
    const full = classify({
      ...empty,
      rsi: 20,
      macd: 1,
      macdSignal: 0,
      bbLower: 100,
      bbUpper: 120,
      sma20: 90,
      sma50: 85,
      close: 95,
    });
    expect(partial.coverage).toBeLessThan(full.coverage);
    expect(partial.strength).toBeLessThan(1);
  });

  it("publishes the computed indicator values as evidence", () => {
    const read = classify({ ...empty, rsi: 27.5, macd: 1.25, macdSignal: 0.25, close: 101 });
    expect(read.evidence.rsi).toBe(27.5);
    expect(read.evidence.macd).toBe(1.25);
    expect(read.evidence.macdSignal).toBe(0.25);
    expect(read.evidence.close).toBe(101);
    expect(read.evidence.macdHistogram).toBe(1);
    expect(read.evidence.rsiZone).toBe("oversold");
  });
});

describe("rsiZone", () => {
  it("labels every band", () => {
    expect(rsiZone(null)).toBe("unavailable");
    expect(rsiZone(25)).toBe("oversold");
    expect(rsiZone(35)).toBe("lean_oversold");
    expect(rsiZone(50)).toBe("neutral");
    expect(rsiZone(65)).toBe("lean_overbought");
    expect(rsiZone(75)).toBe("overbought");
  });
});
