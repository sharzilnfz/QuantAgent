import { describe, it, expect } from "vitest";
import {
  AgentOutput,
  AgentInput,
  CONTRACTS_VERSION,
} from "../src/agents";
import { PriceBar, IndicatorSnapshot } from "../src/signals";
import { PortfolioState } from "../src/portfolio";

const validOutput = {
  agent: "technical",
  direction: "bullish",
  confidence: 0.72,
  rationale: "RSI at 61 and price above SMA20/SMA50 suggests continued upward momentum.",
  evidence: { rsi: 61, sma20: 190.2, aboveSma50: true, note: "MACD crossed up" },
};

describe("AgentOutput", () => {
  it("round-trips a valid payload", () => {
    const parsed = AgentOutput.parse(validOutput);
    expect(parsed).toEqual(validOutput);
  });

  it("defaults evidence to {} when omitted", () => {
    const { evidence: _omit, ...withoutEvidence } = validOutput;
    const parsed = AgentOutput.parse(withoutEvidence);
    expect(parsed.evidence).toEqual({});
  });

  it("rejects confidence above 1", () => {
    expect(() => AgentOutput.parse({ ...validOutput, confidence: 1.5 })).toThrow();
  });

  it("rejects confidence below 0", () => {
    expect(() => AgentOutput.parse({ ...validOutput, confidence: -0.1 })).toThrow();
  });

  it("rejects an empty rationale", () => {
    expect(() => AgentOutput.parse({ ...validOutput, rationale: "" })).toThrow();
  });

  it("rejects a rationale over 2000 chars", () => {
    expect(() =>
      AgentOutput.parse({ ...validOutput, rationale: "x".repeat(2001) }),
    ).toThrow();
  });

  it("rejects an unknown direction enum", () => {
    expect(() => AgentOutput.parse({ ...validOutput, direction: "sideways" })).toThrow();
  });

  it("rejects an unknown agent enum", () => {
    expect(() => AgentOutput.parse({ ...validOutput, agent: "macro" })).toThrow();
  });
});

describe("AgentInput", () => {
  const bar = {
    symbol: "AAPL",
    timeframe: "1Day",
    ts: "2026-07-21T20:00:00.000Z",
    open: 189.1,
    high: 191.4,
    low: 188.7,
    close: 190.6,
    volume: 51_000_000,
    asOf: "2026-07-21T20:00:00.000Z",
  };
  const validInput = {
    runId: "b3f2c1d0-1111-4222-8333-444455556666",
    symbol: "AAPL",
    timeframe: "1Day",
    decisionTs: "2026-07-22T13:30:00.000Z",
    bars: [bar],
    indicators: null,
  };

  it("round-trips a valid input with null indicators", () => {
    expect(() => AgentInput.parse(validInput)).not.toThrow();
  });

  it("rejects a non-uuid runId", () => {
    expect(() => AgentInput.parse({ ...validInput, runId: "not-a-uuid" })).toThrow();
  });

  it("rejects a non-ISO decisionTs", () => {
    expect(() => AgentInput.parse({ ...validInput, decisionTs: "yesterday" })).toThrow();
  });
});

describe("signal + portfolio schemas", () => {
  it("PriceBar round-trips", () => {
    const bar = {
      symbol: "AAPL",
      timeframe: "1Hour",
      ts: "2026-07-22T14:00:00.000Z",
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 100,
      asOf: "2026-07-22T14:00:00.000Z",
    };
    expect(PriceBar.parse(bar)).toEqual(bar);
  });

  it("IndicatorSnapshot accepts nullable indicators", () => {
    const snap = {
      symbol: "AAPL",
      timeframe: "1Day",
      ts: "2026-07-22T14:00:00.000Z",
      rsi: null,
      macd: 0.4,
      macdSignal: 0.2,
      bbUpper: null,
      bbLower: null,
      sma20: 190,
      sma50: null,
      asOf: "2026-07-22T14:00:00.000Z",
    };
    expect(() => IndicatorSnapshot.parse(snap)).not.toThrow();
  });

  it("PortfolioState round-trips", () => {
    const state = {
      cash: 10_000,
      equity: 25_000,
      positions: [
        { symbol: "AAPL", qty: 50, marketValue: 9_500, unrealizedPl: 320 },
      ],
      asOf: "2026-07-22T14:00:00.000Z",
    };
    expect(PortfolioState.parse(state)).toEqual(state);
  });
});

describe("CONTRACTS_VERSION", () => {
  it("is a semver string", () => {
    expect(CONTRACTS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
