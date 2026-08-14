import { describe, it, expect } from "vitest";
import { loadFixture } from "@committee/fixtures";
import { runVarianceSweep, calculateMetricStats } from "../src/experiments/variance-sweep.js";
import { BudgetExceededError } from "../src/experiments/budget.js";

describe("Live Variance Sweeps & Statistical Aggregation", () => {
  const fixture = loadFixture("AAPL");

  it("calculates sample mean, sample variance, and sample stdDev accurately", () => {
    // Sample numbers: [10, 12, 14]
    // mean = 12
    // variance = ((10-12)^2 + (12-12)^2 + (14-12)^2) / 2 = (4 + 0 + 4) / 2 = 4
    // stdDev = sqrt(4) = 2
    const stats = calculateMetricStats([10, 12, 14]);
    expect(stats.mean).toBe(12);
    expect(stats.variance).toBe(4);
    expect(stats.stdDev).toBe(2);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(14);
  });

  it("executes N=3 variance sweep on 25-bar validation window and constructs variance bands", async () => {
    const sweep = await runVarianceSweep(fixture, {
      runsCount: 3,
      windowSize: 25,
      budgetLimit: 5.0,
      deterministicOffline: true,
    });

    expect(sweep.symbol).toBe("AAPL");
    expect(sweep.runsCount).toBe(3);
    expect(sweep.windowSize).toBe(25);
    expect(sweep.runs).toHaveLength(3);
    expect(sweep.totalCost).toBeLessThan(5.0);
    expect(sweep.budgetExceeded).toBe(false);

    // Validate aggregated metric stats
    expect(sweep.metricStats.totalReturn).toBeDefined();
    expect(sweep.metricStats.sharpeRatio).toBeDefined();
    expect(sweep.metricStats.maxDrawdown).toBeDefined();
    expect(sweep.metricStats.directionalAccuracy).toBeDefined();

    // Validate pointwise equity variance bands
    expect(sweep.equityBands.length).toBeGreaterThanOrEqual(20);
    for (const band of sweep.equityBands) {
      expect(band.asOf).toBeDefined();
      expect(band.meanEquity).toBeGreaterThan(0);
      expect(band.upperBand).toBeGreaterThanOrEqual(band.meanEquity);
      expect(band.lowerBand).toBeLessThanOrEqual(band.meanEquity);
    }
  });

  it("enforces budget cap limit and prevents runaway LLM spend", async () => {
    // Attempt with tiny budget ($0.0001) that will fail when spend occurs
    await expect(
      runVarianceSweep(fixture, {
        runsCount: 5,
        windowSize: 25,
        budgetLimit: 0.000001,
        deterministicOffline: false,
      }),
    ).rejects.toThrow(BudgetExceededError);
  });
});
