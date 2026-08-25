import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  generateDeterministicEmbedding,
  MemoryStore,
} from "../src/memory/store.js";
import type { LongTermMemoryItem, EpisodicReflection } from "@committee/contracts";

describe("pgvector Semantic Memory Retrieval & Point-in-Time Discipline", () => {
  it("generateDeterministicEmbedding produces normalized 1536-dim unit vectors", () => {
    const vec1 = generateDeterministicEmbedding("Apple iPhone revenue growth");
    const vec2 = generateDeterministicEmbedding("Apple iPhone revenue growth");
    const vec3 = generateDeterministicEmbedding("Federal Reserve interest rate hike");

    expect(vec1.length).toBe(1536);
    expect(vec2.length).toBe(1536);
    expect(vec3.length).toBe(1536);

    // Exact bit-for-bit determinism
    expect(vec1).toEqual(vec2);

    // Unit norm calculation
    const norm = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    expect(Math.abs(norm - 1.0)).toBeLessThan(0.0001);

    // Dissimilar text has lower cosine similarity
    const simSame = cosineSimilarity(vec1, vec2);
    const simDiff = cosineSimilarity(vec1, vec3);

    expect(simSame).toBeCloseTo(1.0, 4);
    expect(simDiff).toBeLessThan(simSame);
  });

  it("MemoryStore ranks long-term knowledge items by semantic similarity", () => {
    const ts = "2024-02-01T00:00:00.000Z";
    const store = new MemoryStore({
      deterministicOffline: false,
      initialLongTerm: [
        {
          id: "m-1",
          category: "risk_rule",
          symbol: "AAPL",
          title: "Earnings Volatility Guard",
          content: "Do not hold long equity overnight preceding quarterly earnings report due to gap risk.",
          tags: ["earnings", "risk", "gap"],
          metadata: {},
          asOf: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "m-2",
          category: "company_fact",
          symbol: "AAPL",
          title: "Services Margin Expansion",
          content: "App Store and Cloud subscription gross margin expanded to 72 percent.",
          tags: ["fundamentals", "services"],
          metadata: {},
          asOf: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const ctx = store.queryMemoryContext({
      symbol: "AAPL",
      asOf: ts,
      queryText: "Quarterly earnings report gap risk and volatility",
      limitLongTerm: 2,
    });

    expect(ctx.longTerm.length).toBe(2);
    // The earnings volatility rule should rank first due to higher semantic similarity
    expect(ctx.longTerm[0]?.id).toBe("m-1");
  });

  it("strictly enforces Point-in-Time: future memories are filtered out despite high similarity", () => {
    const decisionTs = "2024-01-15T00:00:00.000Z";
    const futureTs = "2024-02-15T00:00:00.000Z";

    const store = new MemoryStore({
      deterministicOffline: false,
      initialLongTerm: [
        {
          id: "past-memory",
          category: "guidance",
          symbol: "AAPL",
          title: "Past Guideline",
          content: "General trading guidelines for January 2024.",
          tags: ["guidance"],
          metadata: {},
          asOf: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "future-memory",
          category: "guidance",
          symbol: "AAPL",
          title: "Exact Matching Future Memory",
          content: "Exact keyword match for semantic query created in the future.",
          tags: ["future"],
          metadata: {},
          asOf: futureTs, // FUTURE
        },
      ],
    });

    const ctx = store.queryMemoryContext({
      symbol: "AAPL",
      asOf: decisionTs,
      queryText: "Exact keyword match for semantic query created in the future.",
    });

    expect(ctx.longTerm.some((item) => item.id === "future-memory")).toBe(false);
    expect(ctx.longTerm.some((item) => item.id === "past-memory")).toBe(true);
  });
});
