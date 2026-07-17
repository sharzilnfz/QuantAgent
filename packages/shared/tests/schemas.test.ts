import { describe, it, expect } from "vitest";
import {
  AgentInputSchema,
  AgentOutputSchema,
  BarSchema,
  IndicatorSnapshotSchema,
} from "../src/index.js";

describe("AgentInput schema", () => {
  it("accepts a valid input", () => {
    const input = {
      symbol: "AAPL",
      timeframe: "1D",
      decisionAsOf: "2024-01-15T16:00:00.000+00:00",
      features: { rsi: 45.2, sma: 185.3 },
    };
    const result = AgentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects missing symbol", () => {
    const result = AgentInputSchema.safeParse({
      timeframe: "1D",
      decisionAsOf: "2024-01-15T16:00:00.000+00:00",
      features: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-ISO decisionAsOf", () => {
    const result = AgentInputSchema.safeParse({
      symbol: "AAPL",
      timeframe: "1D",
      decisionAsOf: "not-a-date",
      features: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("AgentOutput schema", () => {
  const validOutput = {
    agentName: "technical",
    symbol: "AAPL",
    bias: "bullish" as const,
    confidence: 0.72,
    rationale: "RSI=28.5 below 30 threshold; MACD histogram positive",
    features: { rsi: 28.5, macd_hist: 0.45 },
    asOf: "2024-01-15T16:00:00.000+00:00",
    schemaVersion: "1.0.0",
  };

  it("accepts a valid output (round-trip)", () => {
    const result = AgentOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validOutput);
    }
  });

  it("rejects confidence > 1", () => {
    const result = AgentOutputSchema.safeParse({
      ...validOutput,
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence < 0", () => {
    const result = AgentOutputSchema.safeParse({
      ...validOutput,
      confidence: -0.1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid bias", () => {
    const result = AgentOutputSchema.safeParse({
      ...validOutput,
      bias: "maybe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty rationale", () => {
    const result = AgentOutputSchema.safeParse({
      ...validOutput,
      rationale: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("Bar schema", () => {
  it("accepts a valid bar", () => {
    const bar = {
      symbol: "AAPL",
      timeframe: "1D",
      barTime: "2024-01-15T16:00:00.000+00:00",
      open: 185.0,
      high: 187.5,
      low: 184.2,
      close: 186.8,
      volume: 52_000_000,
      asOf: "2024-01-15T20:00:00.000+00:00",
    };
    const result = BarSchema.safeParse(bar);
    expect(result.success).toBe(true);
  });

  it("rejects negative volume", () => {
    const result = BarSchema.safeParse({
      symbol: "AAPL",
      timeframe: "1D",
      barTime: "2024-01-15T16:00:00.000+00:00",
      open: 185.0,
      high: 187.5,
      low: 184.2,
      close: 186.8,
      volume: -100,
      asOf: "2024-01-15T20:00:00.000+00:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("IndicatorSnapshot schema", () => {
  it("accepts a valid snapshot with nullable fields", () => {
    const snapshot = {
      symbol: "AAPL",
      timeframe: "1D",
      barTime: "2024-01-15T16:00:00.000+00:00",
      values: {
        rsi: 45.2,
        macd: 1.23,
        macd_signal: 1.1,
        macd_hist: 0.13,
        bb_upper: 190.0,
        bb_mid: 186.0,
        bb_lower: 182.0,
        sma: 185.5,
        ema: 185.8,
      },
      computedAt: "2024-01-15T20:05:00.000+00:00",
      asOf: "2024-01-15T20:00:00.000+00:00",
    };
    const result = IndicatorSnapshotSchema.safeParse(snapshot);
    expect(result.success).toBe(true);
  });

  it("allows null indicator values", () => {
    const snapshot = {
      symbol: "AAPL",
      timeframe: "1D",
      barTime: "2024-01-15T16:00:00.000+00:00",
      values: {
        rsi: null,
        macd: null,
        sma: 185.5,
      },
      computedAt: "2024-01-15T20:05:00.000+00:00",
      asOf: "2024-01-15T20:00:00.000+00:00",
    };
    const result = IndicatorSnapshotSchema.safeParse(snapshot);
    expect(result.success).toBe(true);
  });
});
