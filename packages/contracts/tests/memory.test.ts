import { describe, expect, it } from "vitest";
import {
  EpisodicReflection,
  LongTermMemoryItem,
  MemoryContext,
  ShortTermMemory,
} from "../src/memory";

describe("Memory Contracts & Schemas", () => {
  it("validates valid ShortTermMemory schema", () => {
    const validStm = {
      asOf: "2024-05-15T16:00:00.000Z",
      recentDecisions: [
        {
          id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          decisionTs: "2024-05-14T16:00:00.000Z",
          symbol: "AAPL",
          direction: "bullish" as const,
          confidence: 0.85,
          rationale: "Strong technical momentum with MACD golden cross.",
          asOf: "2024-05-14T16:00:00.000Z",
        },
      ],
      activePosition: {
        symbol: "AAPL",
        qty: 100,
        marketValue: 18500,
        unrealizedPl: 450,
      },
    };

    const parsed = ShortTermMemory.parse(validStm);
    expect(parsed.recentDecisions).toHaveLength(1);
    expect(parsed.activePosition?.symbol).toBe("AAPL");
  });

  it("validates LongTermMemoryItem categories and embeddings", () => {
    const item = {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category: "risk_rule" as const,
      symbol: null,
      title: "Hard Max Drawdown Stop",
      content: "Reduce equity sizing by 50% if portfolio drawdown exceeds 5.0%.",
      tags: ["risk", "drawdown", "stop_loss"],
      embedding: [0.012, -0.045, 0.089],
      asOf: "2023-01-01T00:00:00.000Z",
    };

    const parsed = LongTermMemoryItem.parse(item);
    expect(parsed.category).toBe("risk_rule");
    expect(parsed.embedding).toHaveLength(3);
  });

  it("validates EpisodicReflection with contradiction flags", () => {
    const reflection = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      symbol: "NVDA",
      decisionTs: "2024-03-01T16:00:00.000Z",
      reviewTs: "2024-03-08T16:00:00.000Z",
      initialDirection: "bullish" as const,
      initialConfidence: 0.9,
      outcomeReturnPct: -0.042,
      holdingBars: 5,
      critique:
        "High bullish sentiment from headlines ignored severe RSI overbought condition (RSI=84).",
      lessonLearned:
        "Do not size up on headline hype when technical indicators show extreme exhaustion.",
      contradictionDetected: true,
      contradictionDetails: "Sentiment was 0.90 Bullish, but price dropped 4.2%.",
      asOf: "2024-03-08T16:00:00.000Z",
    };

    const parsed = EpisodicReflection.parse(reflection);
    expect(parsed.contradictionDetected).toBe(true);
    expect(parsed.outcomeReturnPct).toBe(-0.042);
  });

  it("validates MemoryContext composite structure", () => {
    const context = {
      asOf: "2024-06-01T16:00:00.000Z",
      shortTerm: {
        asOf: "2024-06-01T16:00:00.000Z",
        recentDecisions: [],
      },
      longTerm: [],
      reflections: [],
    };

    const parsed = MemoryContext.parse(context);
    expect(parsed.asOf).toBe("2024-06-01T16:00:00.000Z");
    expect(parsed.longTerm).toEqual([]);
  });
});
