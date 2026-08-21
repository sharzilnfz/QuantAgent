import { describe, expect, it } from "vitest";
import { cosineSimilarity, MemoryStore } from "../src/memory/store.js";

describe("MemoryStore — Point-in-Time & Multi-Tier Retrieval", () => {
  it("calculates cosine similarity accurately", () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    const v3 = [0, 1, 0];
    const v4 = [-1, 0, 0];

    expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
    expect(cosineSimilarity(v1, v3)).toBeCloseTo(0.0);
    expect(cosineSimilarity(v1, v4)).toBeCloseTo(-1.0);
  });

  it("retrieves unified MemoryContext strictly filtered by asOf", () => {
    const store = new MemoryStore({ deterministicOffline: true });

    // Record past short-term decision
    store.recordShortTermDecision({
      decisionTs: "2024-01-10T16:00:00.000Z",
      symbol: "AAPL",
      direction: "bullish",
      confidence: 0.85,
      rationale: "Golden cross confirmed",
      asOf: "2024-01-10T16:00:00.000Z",
    });

    // Record future short-term decision (should NOT be visible)
    store.recordShortTermDecision({
      decisionTs: "2024-06-10T16:00:00.000Z",
      symbol: "AAPL",
      direction: "bearish",
      confidence: 0.9,
      rationale: "Future breakdown",
      asOf: "2024-06-10T16:00:00.000Z",
    });

    const ctx = store.queryMemoryContext({
      symbol: "AAPL",
      asOf: "2024-01-15T16:00:00.000Z",
    });

    expect(ctx.asOf).toBe("2024-01-15T16:00:00.000Z");
    expect(ctx.shortTerm?.recentDecisions).toHaveLength(1);
    expect(ctx.shortTerm?.recentDecisions[0]?.direction).toBe("bullish");

    // Long-term items should include cross-asset rules and AAPL items
    expect(ctx.longTerm.length).toBeGreaterThan(0);
    for (const item of ctx.longTerm) {
      expect(item.symbol === null || item.symbol === "AAPL").toBe(true);
      expect(Date.parse(item.asOf)).toBeLessThanOrEqual(
        Date.parse("2024-01-15T16:00:00.000Z"),
      );
    }
  });

  it("ranks long-term items by vector similarity when queryEmbedding is provided", () => {
    const store = new MemoryStore({
      initialLongTerm: [
        {
          id: "10000000-0000-0000-0000-000000000001",
          category: "risk_rule",
          symbol: "AAPL",
          title: "Orthogonal Rule",
          content: "Some rule",
          tags: [],
          embedding: [0, 1, 0],
          metadata: {},
          asOf: "2023-01-01T00:00:00.000Z",
        },
        {
          id: "10000000-0000-0000-0000-000000000002",
          category: "company_fact",
          symbol: "AAPL",
          title: "Aligned Fact",
          content: "Relevant fact",
          tags: [],
          embedding: [1, 0.1, 0],
          metadata: {},
          asOf: "2023-01-01T00:00:00.000Z",
        },
      ],
    });

    const ctx = store.queryMemoryContext({
      symbol: "AAPL",
      asOf: "2024-01-01T00:00:00.000Z",
      queryEmbedding: [1, 0, 0],
    });

    expect(ctx.longTerm).toHaveLength(2);
    expect(ctx.longTerm[0]?.title).toBe("Aligned Fact");
  });
});
