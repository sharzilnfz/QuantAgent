import { describe, it, expect } from "vitest";
import { BudgetGuard, BudgetExceededError } from "../src/experiments/budget.js";

describe("BudgetGuard & Hard Cumulative Cost Enforcement", () => {
  it("tracks spend accurately and respects default $5.00 limit", () => {
    const guard = new BudgetGuard({ maxBudgetUsd: 5.0 });

    expect(guard.getSnapshot().remainingBudgetUsd).toBe(5.0);
    expect(guard.getSnapshot().cumulativeCostUsd).toBe(0.0);

    guard.recordSpend(1.25);
    expect(guard.getSnapshot().cumulativeCostUsd).toBe(1.25);
    expect(guard.getSnapshot().remainingBudgetUsd).toBe(3.75);
    expect(guard.getSnapshot().callCount).toBe(1);

    guard.recordSpend(2.5);
    expect(guard.getSnapshot().cumulativeCostUsd).toBe(3.75);
    expect(guard.getSnapshot().remainingBudgetUsd).toBe(1.25);
  });

  it("throws BudgetExceededError when spend exceeds hard ceiling", () => {
    const guard = new BudgetGuard({ maxBudgetUsd: 2.0 });

    guard.recordSpend(1.5);

    // Attempting to spend $1.00 more on a $2.00 limit must throw
    expect(() => {
      guard.recordSpend(1.0);
    }).toThrow(BudgetExceededError);

    try {
      guard.assertBudget(0.8);
    } catch (err) {
      expect(err).toBeInstanceOf(BudgetExceededError);
      const budgetErr = err as BudgetExceededError;
      expect(budgetErr.budgetLimit).toBe(2.0);
      expect(budgetErr.cumulativeCost).toBe(2.3);
    }
  });

  it("calculates cost accurately from token pricing rate cards", () => {
    const guard = new BudgetGuard({ maxBudgetUsd: 5.0 });

    // 100k input tokens + 20k output tokens with Claude 3.5 Haiku ($0.80 / $4.00 per MTok)
    const cost = guard.calculateCost(100_000, 20_000, "claude-3-5-haiku-20241022");
    // (100k / 1M * 0.8) + (20k / 1M * 4.0) = 0.08 + 0.08 = 0.16
    expect(cost).toBeCloseTo(0.16, 4);

    const snapshot = guard.recordTokens(100_000, 20_000, "claude-3-5-haiku-20241022");
    expect(snapshot.cumulativeCostUsd).toBeCloseTo(0.16, 4);
    expect(snapshot.inputTokens).toBe(100_000);
    expect(snapshot.outputTokens).toBe(20_000);
  });
});
