import { describe, expect, it } from "vitest";
import type { PortfolioState } from "@committee/contracts";
import { MultiAgentCoordinator } from "../src/agents/coordinator/coordinator.js";
import { RiskGateEngine } from "../src/risk/engine.js";
import { PositionAllocatorEngine } from "../src/portfolio/allocator.js";
import { buildApp } from "../src/app.js";

describe("End-to-End Decision Pipeline (L2 Specialist -> L3 Debate -> L4 Risk Gate -> L5 Allocator)", () => {
  const sampleBars = [
    {
      symbol: "AAPL",
      timeframe: "1Day" as const,
      ts: "2024-06-30T16:00:00.000Z",
      open: 180,
      high: 185,
      low: 179,
      close: 184,
      volume: 1000000,
      asOf: "2024-06-30T20:00:00.000Z",
    },
  ];

  const sampleIndicators = {
    symbol: "AAPL",
    timeframe: "1Day" as const,
    ts: "2024-06-30T16:00:00.000Z",
    rsi: 35,
    macd: 1.2,
    macdSignal: 0.8,
    bbUpper: 190,
    bbLower: 170,
    sma20: 180,
    sma50: 175,
    asOf: "2024-06-30T20:00:00.000Z",
  };

  const samplePortfolio: PortfolioState = {
    cash: 40000,
    equity: 100000,
    positions: [],
    asOf: "2024-06-30T20:00:00.000Z",
  };

  it("orchestrates consensus, evaluates risk, and produces safe sizing", async () => {
    // 1. L2 & L3 Coordinator Run
    const coordinator = new MultiAgentCoordinator({
      deterministicOffline: true,
      debateEnabled: true,
    });

    const consensus = await coordinator.coordinate({
      symbol: "AAPL",
      timeframe: "1Day",
      decisionTs: "2024-06-30T20:00:00.000Z",
      bars: sampleBars,
      indicators: sampleIndicators,
    });

    expect(consensus.lineageId).toBeDefined();
    expect(["bullish", "bearish", "neutral"]).toContain(consensus.finalBias);
    expect(consensus.finalConfidence).toBeGreaterThanOrEqual(0);

    // 2. L4 Risk Gate Evaluation
    const riskEngine = new RiskGateEngine();
    const riskAssessment = riskEngine.assess({
      symbol: "AAPL",
      direction: consensus.finalBias,
      confidence: consensus.finalConfidence,
      currentPrice: 184,
      portfolio: samplePortfolio,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(riskAssessment.asOf).toBe("2024-06-30T20:00:00.000Z");
    expect(["APPROVED", "MODIFIED", "REJECTED"]).toContain(riskAssessment.status);

    // 3. L5 Position Sizing Allocation
    const allocator = new PositionAllocatorEngine();
    const allocation = allocator.allocate({
      symbol: "AAPL",
      direction: consensus.finalBias,
      confidence: consensus.finalConfidence,
      estimatedPrice: 184,
      portfolio: samplePortfolio,
      riskAssessment,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(allocation.symbol).toBe("AAPL");
    expect(allocation.targetNotional).toBeLessThanOrEqual(samplePortfolio.cash);
    expect(allocation.targetWeight).toBeLessThanOrEqual(0.20);
  });

  it("serves HTTP endpoints for POST /risk/assess and POST /portfolio/allocate", async () => {
    const app = await buildApp();

    const assessRes = await app.inject({
      method: "POST",
      url: "/risk/assess",
      payload: {
        symbol: "AAPL",
        direction: "bullish",
        confidence: 0.75,
        currentPrice: 184,
        portfolio: samplePortfolio,
        decisionTs: "2024-06-30T20:00:00.000Z",
      },
    });

    expect(assessRes.statusCode).toBe(200);
    const assessment = JSON.parse(assessRes.body);
    expect(assessment.status).toBeDefined();

    const allocateRes = await app.inject({
      method: "POST",
      url: "/portfolio/allocate",
      payload: {
        symbol: "AAPL",
        direction: "bullish",
        confidence: 0.75,
        estimatedPrice: 184,
        portfolio: samplePortfolio,
        riskAssessment: assessment,
        decisionTs: "2024-06-30T20:00:00.000Z",
      },
    });

    expect(allocateRes.statusCode).toBe(200);
    const allocation = JSON.parse(allocateRes.body);
    expect(allocation.targetQty).toBeGreaterThan(0);
    expect(allocation.sizingMethod).toBe("fractional_kelly");
  });
});
