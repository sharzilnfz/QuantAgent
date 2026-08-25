import { describe, expect, it } from "vitest";
import { MultiAgentCoordinator } from "../src/agents/coordinator/coordinator.js";
import { MemoryStore } from "../src/memory/store.js";
import { loadFixture } from "@committee/fixtures";

describe("MultiAgentCoordinator — Memory Layer Integration & Ablation", () => {
  const fixture = loadFixture("AAPL");
  const decisionBar = fixture.bars[50]!;
  const inputBars = fixture.bars.slice(0, 51);

  it("injects point-in-time MemoryContext when memoryEnabled is true", async () => {
    const memoryStore = new MemoryStore({ deterministicOffline: true });
    const coordinator = new MultiAgentCoordinator({
      deterministicOffline: true,
      debateEnabled: true,
      memoryEnabled: true,
      memoryStore,
    });

    const result = await coordinator.coordinate({
      symbol: "AAPL",
      timeframe: "1Day",
      decisionTs: decisionBar.asOf,
      bars: inputBars,
      indicators: {
        symbol: "AAPL",
        timeframe: "1Day",
        ts: decisionBar.ts,
        rsi: 55,
        macd: 1.2,
        macdSignal: 0.8,
        bbUpper: 195,
        bbLower: 180,
        sma20: 187,
        sma50: 182,
        asOf: decisionBar.asOf,
      },
    });

    expect(result.consensusReached).toBeDefined();

    // Verify that the decision was recorded into memoryStore
    const queried = memoryStore.queryMemoryContext({
      symbol: "AAPL",
      asOf: decisionBar.asOf,
    });
    expect(queried.shortTerm?.recentDecisions.length).toBeGreaterThan(0);
    expect(queried.shortTerm?.recentDecisions[0]?.symbol).toBe("AAPL");
  });

  it("operates without memory injection when memoryEnabled is false (ablation)", async () => {
    const coordinator = new MultiAgentCoordinator({
      deterministicOffline: true,
      debateEnabled: true,
      memoryEnabled: false,
    });

    expect(coordinator.memoryStore).toBeUndefined();

    const result = await coordinator.coordinate({
      symbol: "AAPL",
      timeframe: "1Day",
      decisionTs: decisionBar.asOf,
      bars: inputBars,
      indicators: null,
    });

    expect(result).toBeDefined();
    expect(result.metadata?.runId).toBeDefined();
  });

});
