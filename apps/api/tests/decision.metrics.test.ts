import { describe, expect, it } from "vitest";
import {
  calculateDecisionIntelligenceMetrics,
  type DecisionSignal,
} from "../src/backtest/metrics.js";
import type { PriceBar, SignalType } from "@committee/contracts";

function makeBar(ts: string, close: number): PriceBar {
  return {
    symbol: "AAPL",
    timeframe: "1Day",
    ts,
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 1_000_000,
    asOf: ts,
  };
}

describe("Decision Intelligence Metrics", () => {
  it("calculates 100% directional accuracy and perfect Brier score for correct forecasts", () => {
    // 4 bars -> 3 forward transitions:
    // Bar 0 -> Bar 1: 100 -> 110 (+10) [Up]
    // Bar 1 -> Bar 2: 110 -> 120 (+10) [Up]
    // Bar 2 -> Bar 3: 120 -> 100 (-20) [Down]
    const bars: PriceBar[] = [
      makeBar("2024-01-01T00:00:00.000Z", 100),
      makeBar("2024-01-02T00:00:00.000Z", 110),
      makeBar("2024-01-03T00:00:00.000Z", 120),
      makeBar("2024-01-04T00:00:00.000Z", 100),
    ];

    const decisions: DecisionSignal[] = [
      { signal: "buy", confidence: 1.0 }, // bar 0: correctly predicted up
      { signal: 1.0, confidence: 1.0 },   // bar 1: correctly predicted up
      { signal: "sell", confidence: 1.0 }, // bar 2: correctly predicted down
    ];

    const metrics = calculateDecisionIntelligenceMetrics(bars, decisions);

    expect(metrics.activeBarCount).toBe(3);
    expect(metrics.neutralBarCount).toBe(0);
    expect(metrics.directionalAccuracy).toBe(1.0); // 3/3 correct = 100%
    expect(metrics.brierScore).toBe(0.0); // (1-1)^2 = 0
  });

  it("calculates 0% directional accuracy and worst-case Brier score for inverse forecasts", () => {
    const bars: PriceBar[] = [
      makeBar("2024-01-01T00:00:00.000Z", 100),
      makeBar("2024-01-02T00:00:00.000Z", 110), // Up
      makeBar("2024-01-03T00:00:00.000Z", 120), // Up
    ];

    // Predicts sell with 100% confidence on rising market
    const decisions: DecisionSignal[] = [
      { signal: "sell", confidence: 1.0 },
      { signal: "sell", confidence: 1.0 },
    ];

    const metrics = calculateDecisionIntelligenceMetrics(bars, decisions);

    expect(metrics.activeBarCount).toBe(2);
    expect(metrics.directionalAccuracy).toBe(0.0);
    expect(metrics.brierScore).toBe(1.0); // (1 - 0)^2 = 1.0
  });

  it("evaluates uninformative 50% confidence as Brier score of 0.25", () => {
    const bars: PriceBar[] = [
      makeBar("2024-01-01T00:00:00.000Z", 100),
      makeBar("2024-01-02T00:00:00.000Z", 110),
    ];

    const decisions: DecisionSignal[] = [
      { signal: "buy", confidence: 0.5 },
    ];

    const metrics = calculateDecisionIntelligenceMetrics(bars, decisions);

    expect(metrics.directionalAccuracy).toBe(1.0);
    // (0.5 - 1.0)^2 = 0.25
    expect(metrics.brierScore).toBe(0.25);
  });

  it("calculates Abstention Quality metrics during neutral/cash periods", () => {
    // Bar 0 -> Bar 1: 100 -> 110 (+10%) [Active Buy]
    // Bar 1 -> Bar 2: 110 -> 90  (-18%) [Neutral - avoided downturn!]
    // Bar 2 -> Bar 3: 90  -> 80  (-11%) [Neutral - avoided downturn!]
    // Bar 3 -> Bar 4: 80  -> 85  (+6%)  [Neutral - missed gain]
    const bars: PriceBar[] = [
      makeBar("2024-01-01T00:00:00.000Z", 100),
      makeBar("2024-01-02T00:00:00.000Z", 110),
      makeBar("2024-01-03T00:00:00.000Z", 90),
      makeBar("2024-01-04T00:00:00.000Z", 80),
      makeBar("2024-01-05T00:00:00.000Z", 85),
    ];

    const decisions: (SignalType | DecisionSignal)[] = [
      { signal: "buy", confidence: 0.8 }, // Bar 0 active
      "neutral",                          // Bar 1 neutral (avoids -18%)
      "neutral",                          // Bar 2 neutral (avoids -11%)
      "neutral",                          // Bar 3 neutral (misses +6%)
    ];

    const metrics = calculateDecisionIntelligenceMetrics(bars, decisions);

    expect(metrics.activeBarCount).toBe(1);
    expect(metrics.neutralBarCount).toBe(3);
    expect(metrics.directionalAccuracy).toBe(1.0);
    // Abstention Quality: 2 out of 3 neutral bars had negative/zero return = 2/3 ≈ 0.6667
    expect(metrics.abstentionQuality).toBeCloseTo(0.6667, 3);
    // Active mean return: +10% (0.10)
    // Neutral mean return: (-0.1818 - 0.1111 + 0.0625) / 3 = -0.0768
    // Abstention Alpha = 0.10 - (-0.0768) > 0
    expect(metrics.abstentionAlpha).toBeGreaterThan(0);
  });

  it("handles edge cases: empty data, single bar, all neutral", () => {
    expect(calculateDecisionIntelligenceMetrics([], []).activeBarCount).toBe(0);
    expect(
      calculateDecisionIntelligenceMetrics([makeBar("2024-01-01", 100)], ["buy"]).activeBarCount,
    ).toBe(0);

    const allNeutralMetrics = calculateDecisionIntelligenceMetrics(
      [makeBar("2024-01-01", 100), makeBar("2024-01-02", 110)],
      ["neutral"],
    );
    expect(allNeutralMetrics.activeBarCount).toBe(0);
    expect(allNeutralMetrics.neutralBarCount).toBe(1);
    expect(allNeutralMetrics.brierScore).toBeNull();
    expect(allNeutralMetrics.directionalAccuracy).toBe(0.0);
  });
});
