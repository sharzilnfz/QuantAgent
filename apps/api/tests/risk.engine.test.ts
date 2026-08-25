import { describe, expect, it } from "vitest";
import type { PortfolioState } from "@committee/contracts";
import { RiskGateEngine } from "../src/risk/engine.js";

describe("Deterministic RiskGateEngine (Layer 4)", () => {
  const basePortfolio: PortfolioState = {
    cash: 50000,
    equity: 100000,
    positions: [
      {
        symbol: "MSFT",
        qty: 100,
        marketValue: 40000,
        unrealizedPl: 2000,
      },
      {
        symbol: "AAPL",
        qty: 50,
        marketValue: 10000,
        unrealizedPl: 500,
      },
    ],
    asOf: "2024-06-30T20:00:00.000Z",
  };

  it("approves trade when all deterministic risk limits are respected", () => {
    const engine = new RiskGateEngine();
    const assessment = engine.assess({
      symbol: "AAPL",
      direction: "bullish",
      confidence: 0.75,
      currentPrice: 200,
      portfolio: basePortfolio,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(assessment.status).toBe("MODIFIED"); // Modified because max exposure ceiling is clamped to remaining 10% NAV
    expect(assessment.executionAllowed).toBe(true);
    expect(assessment.violations).toHaveLength(0);
    expect(assessment.adjustedConstraints.maxAllowedNotional).toBe(10000); // 20k max - 10k current = 10k
  });

  it("approves neutral stance unconditionally", () => {
    const engine = new RiskGateEngine();
    const assessment = engine.assess({
      symbol: "AAPL",
      direction: "neutral",
      confidence: 0.20,
      currentPrice: 200,
      portfolio: basePortfolio,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(assessment.status).toBe("APPROVED");
    expect(assessment.executionAllowed).toBe(true);
    expect(assessment.violations).toHaveLength(0);
  });

  it("rejects bullish order when single asset position already exceeds max exposure ceiling (20%)", () => {
    const engine = new RiskGateEngine();
    // MSFT is $40,000 / $100,000 = 40% NAV > 20%
    const assessment = engine.assess({
      symbol: "MSFT",
      direction: "bullish",
      confidence: 0.85,
      currentPrice: 400,
      portfolio: basePortfolio,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(assessment.status).toBe("REJECTED");
    expect(assessment.executionAllowed).toBe(false);
    expect(assessment.violations.some((v) => v.ruleId === "max_exposure")).toBe(true);
  });

  it("rejects bullish order when cash reserves are below required minimum buffer (10%)", () => {
    const depletedPortfolio: PortfolioState = {
      cash: 5000, // 5k < 10k (10% of 100k)
      equity: 100000,
      positions: [
        {
          symbol: "MSFT",
          qty: 237,
          marketValue: 95000,
          unrealizedPl: 5000,
        },
      ],
      asOf: "2024-06-30T20:00:00.000Z",
    };

    const engine = new RiskGateEngine();
    const assessment = engine.assess({
      symbol: "NVDA",
      direction: "bullish",
      confidence: 0.80,
      currentPrice: 120,
      portfolio: depletedPortfolio,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(assessment.status).toBe("REJECTED");
    expect(assessment.executionAllowed).toBe(false);
    expect(assessment.violations.some((v) => v.ruleId === "min_cash_reserve")).toBe(true);
  });

  it("rejects bullish order when portfolio drawdown breaches circuit breaker (15%)", () => {
    const portfolioInDrawdown: PortfolioState = {
      cash: 20000,
      equity: 80000, // 20% down from 100k peak
      positions: [],
      asOf: "2024-06-30T20:00:00.000Z",
    };

    const history = [
      { asOf: "2024-01-01T20:00:00.000Z", equity: 100000 },
      { asOf: "2024-03-01T20:00:00.000Z", equity: 95000 },
    ];

    const engine = new RiskGateEngine();
    const assessment = engine.assess({
      symbol: "AAPL",
      direction: "bullish",
      confidence: 0.90,
      currentPrice: 200,
      portfolio: portfolioInDrawdown,
      portfolioHistory: history,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(assessment.status).toBe("REJECTED");
    expect(assessment.executionAllowed).toBe(false);
    expect(assessment.violations.some((v) => v.ruleId === "drawdown_circuit_breaker")).toBe(true);
  });

  it("rejects signal when committee confidence is below minimum conviction threshold", () => {
    const engine = new RiskGateEngine();
    const assessment = engine.assess({
      symbol: "AAPL",
      direction: "bullish",
      confidence: 0.42, // < 0.50 default
      currentPrice: 200,
      portfolio: basePortfolio,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(assessment.status).toBe("REJECTED");
    expect(assessment.executionAllowed).toBe(false);
    expect(assessment.violations.some((v) => v.ruleId === "confidence_threshold")).toBe(true);
  });

  it("throws TemporalIntegrityViolation if portfolio.asOf is after decisionTs (Anti-Leakage Guard)", () => {
    const engine = new RiskGateEngine();
    expect(() =>
      engine.assess({
        symbol: "AAPL",
        direction: "bullish",
        confidence: 0.80,
        currentPrice: 200,
        portfolio: {
          ...basePortfolio,
          asOf: "2024-07-01T20:00:00.000Z", // Future relative to decisionTs
        },
        decisionTs: "2024-06-30T20:00:00.000Z",
      }),
    ).toThrow();
  });
});
