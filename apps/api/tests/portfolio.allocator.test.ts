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

  it("calculates rolling annualized realized volatility from historical bars", async () => {
    const { computeRollingAnnualizedVolatility } = await import("../src/portfolio/allocator.js");

    const bars = [
      { symbol: "AAPL", timeframe: "1Day" as const, ts: "2024-01-01T00:00:00Z", asOf: "2024-01-01T00:00:00Z", open: 180, high: 182, low: 179, close: 180, volume: 1000 },
      { symbol: "AAPL", timeframe: "1Day" as const, ts: "2024-01-02T00:00:00Z", asOf: "2024-01-02T00:00:00Z", open: 180, high: 185, low: 180, close: 184, volume: 1000 },
      { symbol: "AAPL", timeframe: "1Day" as const, ts: "2024-01-03T00:00:00Z", asOf: "2024-01-03T00:00:00Z", open: 184, high: 186, low: 182, close: 183, volume: 1000 },
      { symbol: "AAPL", timeframe: "1Day" as const, ts: "2024-01-04T00:00:00Z", asOf: "2024-01-04T00:00:00Z", open: 183, high: 188, low: 183, close: 187, volume: 1000 },
      { symbol: "AAPL", timeframe: "1Day" as const, ts: "2024-01-05T00:00:00Z", asOf: "2024-01-05T00:00:00Z", open: 187, high: 190, low: 186, close: 189, volume: 1000 },
    ];

    const vol = computeRollingAnnualizedVolatility(bars, 20);
    expect(vol).toBeGreaterThan(0.10);
    expect(vol).toBeLessThan(0.60);
  });

  it("scales multi-asset basket allocations to preserve the configured cash buffer", () => {
    const allocator = new PositionAllocatorEngine({
      config: {
        defaultMethod: "fixed_percentage",
        fixedPercentage: 0.40, // 40% per asset
        maxWeightCap: 0.50,
        cashBuffer: 0.10, // Must keep 10% cash buffer (max 90% gross equity)
      },
    });

    const inputs = [
      {
        symbol: "AAPL",
        direction: "bullish" as const,
        confidence: 0.90,
        estimatedPrice: 200,
        portfolio: basePortfolio,
        riskAssessment: { ...approvedRiskAssessment, symbol: "AAPL", adjustedConstraints: { maxAllowedWeight: 0.40 } },
        decisionTs: "2024-06-30T20:00:00.000Z",
      },
      {
        symbol: "NVDA",
        direction: "bullish" as const,
        confidence: 0.90,
        estimatedPrice: 100,
        portfolio: basePortfolio,
        riskAssessment: { ...approvedRiskAssessment, symbol: "NVDA", adjustedConstraints: { maxAllowedWeight: 0.40 } },
        decisionTs: "2024-06-30T20:00:00.000Z",
      },
      {
        symbol: "MSFT",
        direction: "bullish" as const,
        confidence: 0.90,
        estimatedPrice: 400,
        portfolio: basePortfolio,
        riskAssessment: { ...approvedRiskAssessment, symbol: "MSFT", adjustedConstraints: { maxAllowedWeight: 0.40 } },
        decisionTs: "2024-06-30T20:00:00.000Z",
      },
    ];

    const portfolioAllocations = allocator.allocatePortfolio(inputs, basePortfolio);
    expect(portfolioAllocations.length).toBe(3);

    const totalWeight = portfolioAllocations.reduce((sum, a) => sum + a.targetWeight, 0);
    expect(totalWeight).toBeLessThanOrEqual(0.90);
    for (const alloc of portfolioAllocations) {
      expect(alloc.sizingParameters.portfolioScaled).toBe(true);
      expect(alloc.sizingParameters.cashBufferPreserved).toBe(0.10);
    }
  });
});
