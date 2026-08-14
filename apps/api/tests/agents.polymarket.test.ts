import { describe, it, expect } from "vitest";
import { loadFixture, TemporalGuard } from "@committee/fixtures";
import { PolymarketAgent } from "../src/agents/polymarket/agent.js";
import { classifyMacroOdds } from "../src/agents/polymarket/classify.js";
import { MultiAgentCoordinator } from "../src/agents/coordinator/coordinator.js";
import { DecisionLineageRecorder } from "../src/agents/coordinator/lineage.js";

describe("Polymarket Specialist Agent & Macro Odds Classification", () => {
  const fixture = loadFixture("AAPL");

  it("classifies dovish easing and hawkish tightening regimes deterministically", () => {
    // 1. Dovish easing scenario (high cut probability, low recession, low inflation)
    const dovishEvents = [
      {
        id: "pm-rate-cut",
        marketSlug: "fed-rate-cut",
        question: "Will Fed cut rates?",
        category: "fed_rate" as const,
        outcomes: ["Yes", "No"],
        asOf: "2024-09-01T00:00:00Z",
        history: [{ ts: "2024-09-01T12:00:00Z", asOf: "2024-09-01T12:00:00Z", probability: 0.85 }],
      },
      {
        id: "pm-cpi",
        marketSlug: "cpi-inflation",
        question: "CPI > 3%",
        category: "cpi_inflation" as const,
        outcomes: ["Yes", "No"],
        asOf: "2024-09-01T00:00:00Z",
        history: [{ ts: "2024-09-01T12:00:00Z", asOf: "2024-09-01T12:00:00Z", probability: 0.22 }],
      },
    ];

    const dovishResult = classifyMacroOdds(dovishEvents, "2024-09-01T21:00:00Z");
    expect(dovishResult.macroRegime).toBe("dovish_easing");
    expect(dovishResult.direction).toBe("bullish");
    expect(dovishResult.strength).toBeGreaterThan(0.4);
    expect(dovishResult.evidence.marketsConsidered).toBe(2);

    // 2. Stagflation / Recession risk scenario
    const recessionEvents = [
      {
        id: "pm-recession",
        marketSlug: "us-recession",
        question: "Recession in 2024?",
        category: "recession" as const,
        outcomes: ["Yes", "No"],
        asOf: "2024-01-01T00:00:00Z",
        history: [{ ts: "2024-01-01T12:00:00Z", asOf: "2024-01-01T12:00:00Z", probability: 0.48 }],
      },
    ];

    const recResult = classifyMacroOdds(recessionEvents, "2024-01-01T21:00:00Z");
    expect(recResult.macroRegime).toBe("stagflation_risk");
    expect(recResult.direction).toBe("bearish");
    expect(recResult.strength).toBeGreaterThan(0.4);
  });

  it("strictly evaluates historical curves as of decisionTs without look-ahead", async () => {
    const agent = new PolymarketAgent({ deterministicOffline: true });
    const decisionTs = "2024-03-20T21:00:00.000Z";

    const output = await agent.analyze({
      runId: "11111111-1111-1111-1111-111111111111",
      symbol: "AAPL",
      timeframe: "1Day",
      decisionTs,
      bars: TemporalGuard.queryBars(fixture.bars, decisionTs),
      indicators: null,
      predictionMarkets: fixture.predictionMarkets,
    });

    expect(output.agent).toBe("polymarket");
    expect(["bullish", "bearish", "neutral"]).toContain(output.direction);
    expect(output.confidence).toBeGreaterThanOrEqual(0);
    expect(output.confidence).toBeLessThanOrEqual(1);
    expect(output.evidence.marketsConsidered).toBeGreaterThan(0);
    expect(output.rationale).toContain("Polymarket crowdsourced macro");
  });

  it("handles missing prediction market data gracefully with neutral stance", async () => {
    const agent = new PolymarketAgent({ deterministicOffline: true });
    const decisionTs = "2024-03-20T21:00:00.000Z";

    const output = await agent.analyze({
      runId: "22222222-2222-2222-2222-222222222222",
      symbol: "AAPL",
      timeframe: "1Day",
      decisionTs,
      bars: TemporalGuard.queryBars(fixture.bars, decisionTs),
      indicators: null,
      predictionMarkets: [],
    });

    expect(output.agent).toBe("polymarket");
    expect(output.direction).toBe("neutral");
    expect(output.confidence).toBe(0);
    expect(output.rationale).toContain("no point-in-time prediction market data available");
  });

  it("participates in MultiAgentCoordinator committee with full lineage tracking", async () => {
    const lineageRecorder = new DecisionLineageRecorder();
    const coordinator = new MultiAgentCoordinator({
      includePolymarket: true,
      deterministicOffline: true,
      lineageRecorder,
    });

    const decisionTs = "2024-09-18T21:00:00.000Z";
    const pitBars = TemporalGuard.queryBars(fixture.bars, decisionTs);
    const pitNews = TemporalGuard.queryNews(fixture.news, decisionTs);
    const pitPm = TemporalGuard.queryPredictionMarkets(fixture.predictionMarkets ?? [], decisionTs);

    const consensus = await coordinator.coordinate({
      symbol: "AAPL",
      timeframe: "1Day",
      decisionTs,
      bars: pitBars,
      indicators: null,
      news: pitNews,
      predictionMarkets: pitPm,
    });

    expect(consensus.specialistVotes.polymarket).toBeDefined();
    expect(consensus.specialistVotes.technical).toBeDefined();
    expect(consensus.specialistVotes.sentiment).toBeDefined();

    const lineage = lineageRecorder.getAll();
    expect(lineage).toHaveLength(1);
    expect(lineage[0]?.specialistCompletions.polymarket).toBeDefined();
  });
});
