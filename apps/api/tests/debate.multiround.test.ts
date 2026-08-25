import { describe, expect, it, beforeEach } from "vitest";
import {
  DebateSynthesis,
  type AgentOutput,
  type PriceBar,
} from "@committee/contracts";

import {
  DebateSynthesizer,
  MultiAgentCoordinator,
  MultiAgentCoordinatorStrategy,
} from "../src/agents/coordinator/index.js";
import { type Agent } from "../src/agents/base.js";

const mockBar: PriceBar = {
  symbol: "AAPL",
  timeframe: "1Day",
  ts: "2024-01-15T00:00:00.000Z",
  asOf: "2024-01-15T00:00:00.000Z",
  open: 180.0,
  high: 185.0,
  low: 179.0,
  close: 184.5,
  volume: 50000000,
};

describe("DebateSynthesizer — Multi-Round Adversarial Protocol", () => {
  let synthesizer: DebateSynthesizer;

  beforeEach(() => {
    synthesizer = new DebateSynthesizer({
      deterministicOffline: true,
      debateRounds: 2,
    });
  });

  it("reports debateRounds configuration correctly", () => {
    expect(synthesizer.getDebateRounds()).toBe(2);
  });

  it("generates structured Round 1 cross-examination critiques between conflicting specialists", () => {
    const technical: AgentOutput = {
      agent: "technical",
      direction: "bullish",
      confidence: 0.85,
      rationale: "Golden cross 20/50 SMA with RSI at 55.",
      evidence: { rsi: 55, sma20: 182, sma50: 178 },
    };

    const sentiment: AgentOutput = {
      agent: "sentiment",
      direction: "bearish",
      confidence: 0.8,
      rationale: "Antitrust investigation headline broke.",
      evidence: { headlines: "Regulatory scrutiny increases" },
    };

    const critiques = synthesizer.generateCritiques({
      symbol: "AAPL",
      decisionTs: "2024-01-15T00:00:00.000Z",
      currentBar: mockBar,
      technical,
      sentiment,
    });

    expect(critiques.length).toBe(2);

    const techCritique = critiques.find((c) => c.agent === "technical");
    expect(techCritique).toBeDefined();
    expect(techCritique?.stance).toBe("bullish");
    expect(techCritique?.rebuttal).toContain("Price action");
    expect(techCritique?.revisedConfidence).toBeLessThan(0.85);

    const sentCritique = critiques.find((c) => c.agent === "sentiment");
    expect(sentCritique).toBeDefined();
    expect(sentCritique?.stance).toBe("bearish");
    expect(sentCritique?.rebuttal).toContain("lagging");
    expect(sentCritique?.revisedConfidence).toBeLessThan(0.8);
  });

  it("executes multi-round synthesis and returns contract-valid DebateSynthesis with R=2", async () => {
    const technical: AgentOutput = {
      agent: "technical",
      direction: "bullish",
      confidence: 0.9,
      rationale: "Strong upward momentum.",
      evidence: {},
    };

    const sentiment: AgentOutput = {
      agent: "sentiment",
      direction: "bearish",
      confidence: 0.6,
      rationale: "Minor negative news.",
      evidence: {},
    };

    const synthesis = await synthesizer.synthesize({
      symbol: "AAPL",
      decisionTs: "2024-01-15T00:00:00.000Z",
      currentBar: mockBar,
      technical,
      sentiment,
    });

    expect(DebateSynthesis.safeParse(synthesis).success).toBe(true);
    expect(synthesis.rounds).toBe(2);
    expect(synthesis.critiques).toBeDefined();
    expect(synthesis.critiques?.length).toBe(2);
    expect(synthesis.direction).toBe("bullish");
    expect(synthesis.rationale).toContain("cross-examination");
    expect(synthesis.dissentingView).toBeDefined();
    expect(synthesis.tokenCost).toBe(0);
  });
});

describe("MultiAgentCoordinator — Multi-Round Debate Coordination", () => {
  it("triggers multi-round cross-examination when specialists clash", async () => {
    class MockBullishTechAgent implements Agent {
      readonly name = "technical" as const;
      async analyze(): Promise<AgentOutput> {
        return {
          agent: "technical",
          direction: "bullish",
          confidence: 0.88,
          rationale: "Clear breakout pattern.",
          evidence: {},
        };
      }
    }

    class MockBearishSentAgent implements Agent {
      readonly name = "sentiment" as const;
      async analyze(): Promise<AgentOutput> {
        return {
          agent: "sentiment",
          direction: "bearish",
          confidence: 0.82,
          rationale: "Macro headwind warning.",
          evidence: {},
        };
      }
    }

    const coordinator = new MultiAgentCoordinator({
      debateEnabled: true,
      debateRounds: 2,
      deterministicOffline: true,
      specialists: [new MockBullishTechAgent(), new MockBearishSentAgent()],
    });

    const result = await coordinator.coordinate({
      symbol: "AAPL",
      timeframe: "1Day",
      decisionTs: "2024-01-15T00:00:00.000Z",
      bars: [mockBar],
      indicators: null,
    });

    expect(result.mode).toBe("debate_synthesis");
    expect(result.consensusReached).toBe(false);
    expect(result.synthesis).toBeDefined();
    expect(result.synthesis?.rounds).toBe(2);
    expect(result.synthesis?.critiques?.length).toBe(2);
    expect(result.metadata?.debateRounds).toBe(2);
  });

  it("fast-paths on consensus without executing debate rounds when specialists agree", async () => {
    class MockBullishTechAgent implements Agent {
      readonly name = "technical" as const;
      async analyze(): Promise<AgentOutput> {
        return {
          agent: "technical",
          direction: "bullish",
          confidence: 0.9,
          rationale: "RSI momentum.",
          evidence: {},
        };
      }
    }

    class MockBullishSentAgent implements Agent {
      readonly name = "sentiment" as const;
      async analyze(): Promise<AgentOutput> {
        return {
          agent: "sentiment",
          direction: "bullish",
          confidence: 0.85,
          rationale: "Positive earnings catalyst.",
          evidence: {},
        };
      }
    }

    const coordinator = new MultiAgentCoordinator({
      debateEnabled: true,
      debateRounds: 2,
      deterministicOffline: true,
      specialists: [new MockBullishTechAgent(), new MockBullishSentAgent()],
    });

    const result = await coordinator.coordinate({
      symbol: "AAPL",
      timeframe: "1Day",
      decisionTs: "2024-01-15T00:00:00.000Z",
      bars: [mockBar],
      indicators: null,
    });

    expect(result.mode).toBe("consensus_short_circuit");
    expect(result.consensusReached).toBe(true);
    expect(result.finalBias).toBe("bullish");
    expect(result.synthesis).toBeUndefined();
  });
});

describe("MultiAgentCoordinatorStrategy — Multi-Round Strategy Naming & Execution", () => {
  it("initializes with debate-multiround name when debateRounds >= 2", () => {
    const strategy = new MultiAgentCoordinatorStrategy({
      debateEnabled: true,
      debateRounds: 2,
      deterministicOffline: true,
    });

    expect(strategy.name).toBe("multi-agent-coordinator-debate-multiround");
  });
});
