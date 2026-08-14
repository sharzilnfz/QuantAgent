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

    // 100k input tokens + 20k output tokens with default rate ($0.50 / $2.00 per MTok)
    const cost = guard.calculateCost(100_000, 20_000, "default");
    // (100k / 1M * 0.5) + (20k / 1M * 2.0) = 0.05 + 0.04 = 0.09
    expect(cost).toBeCloseTo(0.09, 4);

    // Free model always costs $0.00
    const freeCost = guard.calculateCost(100_000, 20_000, "meta-llama/llama-3.3-70b-instruct:free");
    expect(freeCost).toBe(0.0);

    const snapshot = guard.recordTokens(100_000, 20_000, "default");
    expect(snapshot.cumulativeCostUsd).toBeCloseTo(0.09, 4);
    expect(snapshot.inputTokens).toBe(100_000);
    expect(snapshot.outputTokens).toBe(20_000);
  });
});
