import { describe, expect, it } from "vitest";
import type { PortfolioState, RiskAssessment } from "@committee/contracts";
import { PositionAllocatorEngine } from "../src/portfolio/allocator.js";

describe("Mathematical PositionAllocatorEngine (Layer 5)", () => {
  const basePortfolio: PortfolioState = {
    cash: 50000,
    equity: 100000,
    positions: [],
    asOf: "2024-06-30T20:00:00.000Z",
  };

  const approvedRiskAssessment: RiskAssessment = {
    assessmentId: "a0000000-0000-0000-0000-000000000001",
    symbol: "AAPL",
    direction: "bullish",
    status: "APPROVED",
    executionAllowed: true,
    evaluatedRules: [],
    violations: [],
    adjustedConstraints: {
      maxAllowedNotional: 20000,
      maxAllowedWeight: 0.20,
    },
    asOf: "2024-06-30T20:00:00.000Z",
    evaluatedAt: "2024-06-30T20:01:00.000Z",
  };

  it("calculates fractional Kelly position sizing accurately", () => {
    const allocator = new PositionAllocatorEngine({
      config: { defaultMethod: "fractional_kelly", kellyFraction: 0.25 },
    });

    const allocation = allocator.allocate({
      symbol: "AAPL",
      direction: "bullish",
      confidence: 0.80, // p = 0.80, b = 1.5 -> fullKelly = (0.8*2.5 - 1)/1.5 = 1/1.5 = 0.6667 -> 0.25 * 0.6667 = 0.1667
      estimatedPrice: 200,
      portfolio: basePortfolio,
      riskAssessment: approvedRiskAssessment,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(allocation.sizingMethod).toBe("fractional_kelly");
    expect(allocation.targetWeight).toBeGreaterThan(0.15);
    expect(allocation.targetWeight).toBeLessThanOrEqual(0.20);
    expect(allocation.targetQty).toBe(Math.floor(allocation.targetNotional / 200));
    expect(allocation.targetQty).toBeGreaterThan(0);
  });

  it("calculates volatility parity position sizing accurately", () => {
    const allocator = new PositionAllocatorEngine({
      config: { targetVolatility: 0.15, maxWeightCap: 0.20 },
    });

    const allocation = allocator.allocate({
      symbol: "AAPL",
      direction: "bullish",
      confidence: 0.70,
      estimatedPrice: 100,
      portfolio: basePortfolio,
      riskAssessment: approvedRiskAssessment,
      assetVolatility: 0.30, // 0.15 / 0.30 * 0.70 = 0.35 -> capped at 0.20
      sizingMethod: "volatility_parity",
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(allocation.sizingMethod).toBe("volatility_parity");
    expect(allocation.targetWeight).toBe(0.20); // capped at maxWeightCap
    expect(allocation.targetQty).toBe(200); // 20k / 100 = 200 shares
  });

  it("zeros allocation when risk assessment status is REJECTED", () => {
    const rejectedRisk: RiskAssessment = {
      ...approvedRiskAssessment,
      status: "REJECTED",
      executionAllowed: false,
      violations: [
        {
          ruleId: "max_exposure",
          name: "Max Exposure",
          passed: false,
          severity: "BLOCKING",
          message: "Exceeded exposure limit",
        },
      ],
    };

    const allocator = new PositionAllocatorEngine();
    const allocation = allocator.allocate({
      symbol: "AAPL",
      direction: "bullish",
      confidence: 0.90,
      estimatedPrice: 200,
      portfolio: basePortfolio,
      riskAssessment: rejectedRisk,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(allocation.targetWeight).toBe(0);
    expect(allocation.targetQty).toBe(0);
    expect(allocation.targetNotional).toBe(0);
    expect(allocation.rationale).toContain("Execution halted");
  });

  it("zeros allocation when signal direction is neutral", () => {
    const allocator = new PositionAllocatorEngine();
    const allocation = allocator.allocate({
      symbol: "AAPL",
      direction: "neutral",
      confidence: 0.30,
      estimatedPrice: 200,
      portfolio: basePortfolio,
      riskAssessment: { ...approvedRiskAssessment, direction: "neutral" },
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(allocation.targetWeight).toBe(0);
    expect(allocation.targetQty).toBe(0);
    expect(allocation.targetNotional).toBe(0);
  });

  it("targets liquidation of existing shares when signal is bearish", () => {
    const portfolioWithPosition: PortfolioState = {
      ...basePortfolio,
      positions: [
        {
          symbol: "AAPL",
          qty: 75,
          marketValue: 15000,
          unrealizedPl: 1200,
        },
      ],
    };

    const allocator = new PositionAllocatorEngine();
    const allocation = allocator.allocate({
      symbol: "AAPL",
      direction: "bearish",
      confidence: 0.85,
      estimatedPrice: 200,
      portfolio: portfolioWithPosition,
      riskAssessment: { ...approvedRiskAssessment, direction: "bearish" },
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(allocation.direction).toBe("bearish");
    expect(allocation.targetQty).toBe(75);
    expect(allocation.targetNotional).toBe(15000);
  });
});
