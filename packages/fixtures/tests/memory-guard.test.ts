import { describe, expect, it } from "vitest";
import {
  FROZEN_EPISODIC_REFLECTIONS,
  FROZEN_LONG_TERM_MEMORY,
  loadEpisodicReflections,
  loadLongTermMemory,
  TemporalGuard,
  TemporalIntegrityViolation,
} from "../src/index.js";

describe("TemporalGuard — Memory & Reflection Protection", () => {
  it("filters long term memory strictly by asOf <= decisionTs", () => {
    const decisionTs = "2023-01-01T00:00:00.000Z";
    const memory = TemporalGuard.queryLongTermMemory(
      FROZEN_LONG_TERM_MEMORY,
      decisionTs,
    );
    expect(memory.length).toBeGreaterThan(0);

    for (const item of memory) {
      expect(Date.parse(item.asOf)).toBeLessThanOrEqual(
        Date.parse(decisionTs),
      );
    }
  });

  it("filters episodic reflections strictly by asOf <= decisionTs", () => {
    const beforeReview = "2023-02-05T00:00:00.000Z"; // Before AAPL review date 2023-02-09
    const afterReview = "2023-02-15T00:00:00.000Z";

    const hiddenReflections = TemporalGuard.queryReflections(
      FROZEN_EPISODIC_REFLECTIONS,
      beforeReview,
    );
    expect(hiddenReflections).toHaveLength(0);

    const visibleReflections = TemporalGuard.queryReflections(
      FROZEN_EPISODIC_REFLECTIONS,
      afterReview,
    );
    expect(visibleReflections.length).toBeGreaterThan(0);
    expect(visibleReflections[0]?.symbol).toBe("AAPL");
  });

  it("throws TemporalIntegrityViolation on future memory leakage", () => {
    const futureItem = {
      id: "f9999999-9999-9999-9999-999999999999",
      category: "risk_rule" as const,
      symbol: null,
      title: "Future Leakage Rule",
      content: "This rule comes from the future.",
      tags: [],
      metadata: {},
      asOf: "2025-01-01T00:00:00.000Z",
    };

    const pastDecisionTs = "2024-01-01T00:00:00.000Z";

    expect(() => {
      TemporalGuard.assertNoLeakage([futureItem], pastDecisionTs, "test-leak");
    }).toThrow(TemporalIntegrityViolation);
  });
});
