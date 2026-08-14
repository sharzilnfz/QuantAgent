import { describe, expect, it } from "vitest";
import {
  evaluateConsensus,
  MultiAgentCoordinator,
  DebateSynthesizer,
  buildDebateUserPrompt,
  DEBATE_SYSTEM_PROMPT,
} from "../src/agents/coordinator/index.js";
import { BaseAgent, NO_OPINION } from "../src/agents/base.js";
import { ScriptedLlmClient } from "../src/agents/technical/llm-client.js";
import type { AgentInput, AgentOutput, PriceBar } from "@committee/contracts";

class MockSpecialistAgent extends BaseAgent {
  constructor(
    readonly name: "technical" | "sentiment",
    private readonly mockOutput: Partial<AgentOutput>,
  ) {
    super();
  }

  protected async run(input: AgentInput): Promise<AgentOutput> {
    return {
      agent: this.name,
      direction: this.mockOutput.direction ?? "neutral",
      confidence: this.mockOutput.confidence ?? 0.5,
      rationale: this.mockOutput.rationale ?? `${this.name} test analysis`,
      evidence: this.mockOutput.evidence ?? {},
    };
  }
}

function makeBar(ts: string, close: number = 100): PriceBar {
  return {
    symbol: "AAPL",
    timeframe: "1Day",
    ts,
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 1_000_000,
    asOf: ts,
  };
}

describe("L3 Multi-Agent Coordinator & Consensus Short-Circuit", () => {
  it("detects matching directional bias and fast-passes consensus without extra synthesis calls", async () => {
    const tech = new MockSpecialistAgent("technical", {
      direction: "bullish",
      confidence: 0.8,
      rationale: "Strong golden cross and RSI momentum",
    });
    const sent = new MockSpecialistAgent("sentiment", {
      direction: "bullish",
      confidence: 0.9,
      rationale: "Positive earnings headlines",
    });

    const coordinator = new MultiAgentCoordinator({
      debateEnabled: true,
      specialists: [tech, sent],
      logger: () => {},
    });

    const result = await coordinator.coordinate({
      symbol: "AAPL",
      timeframe: "1Day",
      decisionTs: "2024-01-02T00:00:00.000Z",
      bars: [makeBar("2024-01-02T00:00:00.000Z")],
      indicators: null,
    });

    expect(result.consensusReached).toBe(true);
    expect(result.mode).toBe("consensus_short_circuit");
    expect(result.finalBias).toBe("bullish");
    expect(result.finalConfidence).toBe(0.85); // average of 0.8 and 0.9
    expect(result.synthesis).toBeUndefined();
  });

  it("handles unanimous neutral consensus fast-path", () => {
    const evalResult = evaluateConsensus([
      {
        agent: "technical",
        direction: "neutral",
        confidence: 0.0,
        rationale: "No signals",
        evidence: {},
      },
      {
        agent: "sentiment",
        direction: "neutral",
        confidence: 0.0,
        rationale: "No news",
        evidence: {},
      },
    ]);

    expect(evalResult.reached).toBe(true);
    expect(evalResult.direction).toBe("neutral");
    expect(evalResult.confidence).toBe(0);
    expect(evalResult.mode).toBe("consensus_short_circuit");
  });

  describe("Debate Mode (ON)", () => {
    it("triggers single-pass LLM debate synthesis when specialists disagree", async () => {
      const tech = new MockSpecialistAgent("technical", {
        direction: "bullish",
        confidence: 0.75,
        rationale: "RSI oversold bounce",
      });
      const sent = new MockSpecialistAgent("sentiment", {
        direction: "bearish",
        confidence: 0.85,
        rationale: "Regulatory investigation headlines",
      });

      const scriptedLlm = new ScriptedLlmClient([
        {
          direction: "bearish",
          confidence: 0.7,
          rationale: "Regulatory risk outweighs technical oversold bounce.",
          dissentingView: "Technical analyst noted RSI oversold bounce.",
          primaryDriver: "sentiment",
        },
      ]);

      const synthesizer = new DebateSynthesizer({ llm: scriptedLlm });
      const coordinator = new MultiAgentCoordinator({
        debateEnabled: true,
        specialists: [tech, sent],
        synthesizer,
        logger: () => {},
      });

      const result = await coordinator.coordinate({
        symbol: "AAPL",
        timeframe: "1Day",
        decisionTs: "2024-01-02T00:00:00.000Z",
        bars: [makeBar("2024-01-02T00:00:00.000Z")],
        indicators: null,
      });

      expect(result.consensusReached).toBe(false);
      expect(result.mode).toBe("debate_synthesis");
      expect(result.finalBias).toBe("bearish");
      expect(result.finalConfidence).toBe(0.7);
      expect(result.synthesis).toBeDefined();
      expect(result.synthesis?.primaryDriver).toBe("sentiment");
      expect(result.synthesis?.dissentingView).toContain("Technical analyst");
      expect(scriptedLlm.callCount).toBe(1);
    });

    it("synthesizes deterministically in offline mode ($0.00 cost)", async () => {
      const tech = new MockSpecialistAgent("technical", {
        direction: "bullish",
        confidence: 0.9,
        rationale: "Breakout",
      });
      const sent = new MockSpecialistAgent("sentiment", {
        direction: "bearish",
        confidence: 0.5,
        rationale: "Mild headwinds",
      });

      const coordinator = new MultiAgentCoordinator({
        debateEnabled: true,
        deterministicOffline: true,
        specialists: [tech, sent],
        logger: () => {},
      });

      const result = await coordinator.coordinate({
        symbol: "AAPL",
        timeframe: "1Day",
        decisionTs: "2024-01-02T00:00:00.000Z",
        bars: [makeBar("2024-01-02T00:00:00.000Z")],
        indicators: null,
      });

      expect(result.mode).toBe("debate_synthesis");
      expect(result.finalBias).toBe("bullish"); // Tech conviction (0.9) overrides Sentiment (0.5)
      expect(result.synthesis?.primaryDriver).toBe("technical");
      expect(result.synthesis?.tokenCost).toBe(0);
    });
  });

  describe("Ablation Mode (OFF)", () => {
    it("defaults to neutral signal with 0 confidence when specialists disagree and debate is disabled", async () => {
      const tech = new MockSpecialistAgent("technical", {
        direction: "bullish",
        confidence: 0.9,
        rationale: "Strong breakout",
      });
      const sent = new MockSpecialistAgent("sentiment", {
        direction: "bearish",
        confidence: 0.9,
        rationale: "Major scandal",
      });

      const coordinator = new MultiAgentCoordinator({
        debateEnabled: false, // DEBATE OFF (Ablation Control)
        specialists: [tech, sent],
        logger: () => {},
      });

      const result = await coordinator.coordinate({
        symbol: "AAPL",
        timeframe: "1Day",
        decisionTs: "2024-01-02T00:00:00.000Z",
        bars: [makeBar("2024-01-02T00:00:00.000Z")],
        indicators: null,
      });

      expect(result.consensusReached).toBe(false);
      expect(result.mode).toBe("ablation_neutral_fallback");
      expect(result.finalBias).toBe("neutral");
      expect(result.finalConfidence).toBe(0.0);
      expect(result.synthesis).toBeUndefined();
    });
  });

  describe("Prompt Construction", () => {
    it("renders specialist arguments, evidence, and price action in synthesis prompt", () => {
      const userPrompt = buildDebateUserPrompt({
        symbol: "AAPL",
        decisionTs: "2024-01-02T00:00:00.000Z",
        currentBar: makeBar("2024-01-02T00:00:00.000Z", 185.5),
        technical: {
          agent: "technical",
          direction: "bullish",
          confidence: 0.85,
          rationale: "Golden cross confirmed",
          evidence: { rsi: 55, sma20: 180 },
        },
        sentiment: {
          agent: "sentiment",
          direction: "bearish",
          confidence: 0.7,
          rationale: "Antitrust lawsuit filed",
          evidence: { headlinesConsidered: 3 },
        },
      });

      expect(userPrompt).toContain("AAPL");
      expect(userPrompt).toContain("$185.50");
      expect(userPrompt).toContain("Golden cross confirmed");
      expect(userPrompt).toContain("Antitrust lawsuit filed");
      expect(userPrompt).toContain("Reconcile this disagreement");
      expect(DEBATE_SYSTEM_PROMPT).toContain("Synthesis Coordinator");
    });
  });
});
