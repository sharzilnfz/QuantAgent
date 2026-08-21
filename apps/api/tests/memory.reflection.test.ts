import { describe, expect, it } from "vitest";
import { ReflectionAgent } from "../src/memory/reflection.js";

describe("ReflectionAgent — Post-Trade Outcome & Contradiction Analysis", () => {
  const agent = new ReflectionAgent({ deterministicOffline: true });

  it("analyzes a winning long trade with positive feedback", () => {
    const reflection = agent.analyzeTrade({
      symbol: "AAPL",
      tradeId: "trade-win-1",
      entryDecision: {
        decisionTs: "2024-03-01T16:00:00.000Z",
        direction: "bullish",
        confidence: 0.85,
        rationale: "MACD crossover and positive earnings guidance.",
      },
      entryPrice: 180,
      exitPrice: 190,
      holdingBars: 5,
      reviewTs: "2024-03-08T16:00:00.000Z",
    });

    expect(reflection.outcomeReturnPct).toBeGreaterThan(0.05);
    expect(reflection.contradictionDetected).toBe(false);
    expect(reflection.asOf).toBe("2024-03-08T16:00:00.000Z");
    expect(reflection.critique).toContain("Trade succeeded");
  });

  it("detects signal contradiction on a losing trade with high sentiment euphoria", () => {
    const reflection = agent.analyzeTrade({
      symbol: "NVDA",
      tradeId: "trade-loss-contradiction",
      entryDecision: {
        decisionTs: "2024-04-01T16:00:00.000Z",
        direction: "bullish",
        confidence: 0.9,
        rationale: "Huge earnings headlines euphoria.",
        specialistVotes: {
          sentiment: {
            agent: "sentiment",
            direction: "bullish",
            confidence: 0.95,
            rationale: "Overwhelmingly positive news sentiment.",
            evidence: {},
          },
          technical: {
            agent: "technical",
            direction: "bearish",
            confidence: 0.7,
            rationale: "RSI 85 overbought divergence.",
            evidence: {},
          },
        },
      },
      entryPrice: 900,
      exitPrice: 850,
      holdingBars: 4,
      reviewTs: "2024-04-05T16:00:00.000Z",
    });

    expect(reflection.outcomeReturnPct).toBeLessThan(-0.05);
    expect(reflection.contradictionDetected).toBe(true);
    expect(reflection.contradictionDetails).toContain("Sentiment specialist strongly favored");
    expect(reflection.lessonLearned).toContain("Require stronger technical confirmation");
  });
});
