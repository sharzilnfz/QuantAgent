import { describe, expect, it } from "vitest";
import { runBacktest } from "../src/backtest/simulator.js";
import { MultiAgentCoordinatorStrategy } from "../src/agents/coordinator/strategy.js";
import { BaseAgent } from "../src/agents/base.js";
import type { AgentInput, AgentOutput, PriceBar } from "@committee/contracts";

class StepWiseSpecialist extends BaseAgent {
  constructor(
    readonly name: "technical" | "sentiment",
    private readonly stepDirections: AgentOutput["direction"][],
  ) {
    super();
  }

  protected async run(input: AgentInput): Promise<AgentOutput> {
    const barIndex = Math.max(0, input.bars.length - 1);
    const direction = this.stepDirections[barIndex] ?? "neutral";
    return {
      agent: this.name,
      direction,
      confidence: direction === "neutral" ? 0.0 : 0.8,
      rationale: `${this.name} bar ${barIndex} direction: ${direction}`,
      evidence: {},
    };
  }
}

function makeBar(ts: string, open: number, close: number): PriceBar {
  return {
    symbol: "AAPL",
    timeframe: "1Day",
    ts,
    open,
    high: Math.max(open, close) * 1.01,
    low: Math.min(open, close) * 0.99,
    close,
    volume: 1_000_000,
    asOf: ts,
  };
}

describe("MultiAgentCoordinatorStrategy Backtest Integration", () => {
  it("fast-paths consensus and executes long position when specialists agree", async () => {
    // Both specialists agree on bullish for bar 0, 1, 2
    const tech = new StepWiseSpecialist("technical", ["bullish", "bullish", "neutral"]);
    const sent = new StepWiseSpecialist("sentiment", ["bullish", "bullish", "neutral"]);

    const strategy = new MultiAgentCoordinatorStrategy({
      name: "test-debate-on",
      debateEnabled: true,
      specialists: [tech, sent],
      logger: () => {},
    });

    const bars: PriceBar[] = [
      makeBar("2024-01-01T00:00:00.000Z", 100, 105), // Bullish consensus -> signal 1.0
      makeBar("2024-01-02T00:00:00.000Z", 105, 110), // Executed buy at open 105, signal 1.0
      makeBar("2024-01-03T00:00:00.000Z", 110, 115), // Neutral consensus -> signal 0.0
      makeBar("2024-01-04T00:00:00.000Z", 115, 120), // Executed sell at open 115
    ];

    const result = await runBacktest(strategy, bars, {
      initialCash: 10_000,
      feeBps: 0,
    });

    expect(result.trades).toHaveLength(2);
    expect(result.totalReturn).toBeGreaterThan(0);
  });

  it("ablation mode (Debate OFF) stays 100% cash / neutral when specialists clash", async () => {
    // Technical says bullish, Sentiment says bearish throughout -> Disagreement!
    const tech = new StepWiseSpecialist("technical", ["bullish", "bullish", "bullish"]);
    const sent = new StepWiseSpecialist("sentiment", ["bearish", "bearish", "bearish"]);

    const strategy = new MultiAgentCoordinatorStrategy({
      name: "test-debate-off",
      debateEnabled: false, // ABLATION MODE
      specialists: [tech, sent],
      logger: () => {},
    });

    const bars: PriceBar[] = [
      makeBar("2024-01-01T00:00:00.000Z", 100, 105),
      makeBar("2024-01-02T00:00:00.000Z", 105, 110),
      makeBar("2024-01-03T00:00:00.000Z", 110, 115),
    ];

    const result = await runBacktest(strategy, bars, {
      initialCash: 10_000,
      feeBps: 0,
    });

    // Zero trades executed because ablation defaults strictly to neutral
    expect(result.trades).toHaveLength(0);
    expect(result.totalReturn).toBe(0);
    expect(result.finalEquity).toBe(10_000);
  });
});
