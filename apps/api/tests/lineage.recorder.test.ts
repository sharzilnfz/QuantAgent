import { describe, expect, it } from "vitest";
import { DecisionLineageRecorder } from "../src/agents/coordinator/lineage.js";
import type { ConsensusResult, PriceBar, Trade } from "@committee/contracts";

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

describe("Decision Lineage Recorder", () => {
  it("records and retrieves discrete point-in-time decision provenance", () => {
    const recorder = new DecisionLineageRecorder();

    const consensusResult: ConsensusResult = {
      lineageId: "00000000-0000-0000-0000-000000000001",
      consensusReached: true,
      mode: "consensus_short_circuit",
      finalBias: "bullish",
      finalConfidence: 0.85,
      specialistVotes: {
        technical: {
          agent: "technical",
          direction: "bullish",
          confidence: 0.8,
          rationale: "Golden cross",
          evidence: { rsi: 60 },
        },
        sentiment: {
          agent: "sentiment",
          direction: "bullish",
          confidence: 0.9,
          rationale: "Earnings beat",
          evidence: { bullishCount: 4 },
        },
      },
    };

    const record = recorder.record({
      decisionTs: "2024-01-02T00:00:00.000Z",
      symbol: "AAPL",
      inputBars: [makeBar("2024-01-02T00:00:00.000Z")],
      indicators: null,
      consensusResult,
      tokenCost: 0,
      latencyMs: 12,
    });

    expect(record.id).toBeDefined();
    expect(record.symbol).toBe("AAPL");
    expect(record.consensusResult.mode).toBe("consensus_short_circuit");
    expect(recorder.length).toBe(1);
    expect(recorder.getById(record.id)).toEqual(record);
  });

  it("attaches execution fills to matching decision timestamps", () => {
    const recorder = new DecisionLineageRecorder();

    const consensusResult: ConsensusResult = {
      lineageId: "00000000-0000-0000-0000-000000000002",
      consensusReached: false,
      mode: "debate_synthesis",
      finalBias: "bullish",
      finalConfidence: 0.7,
      specialistVotes: {},
      synthesis: {
        direction: "bullish",
        confidence: 0.7,
        rationale: "Debate resolved bullish",
        primaryDriver: "technical",
      },
    };

    const record = recorder.record({
      decisionTs: "2024-01-02T00:00:00.000Z",
      symbol: "AAPL",
      inputBars: [makeBar("2024-01-02T00:00:00.000Z")],
      indicators: null,
      consensusResult,
    });

    expect(record.executionFill).toBeUndefined();

    const fill: Trade = {
      ts: "2024-01-03T00:00:00.000Z",
      price: 185.0,
      fromPosition: 0,
      toPosition: 1,
      shares: 50,
      value: 9250,
      fee: 4.62,
    };

    const attached = recorder.attachExecutionFill("2024-01-02T00:00:00.000Z", fill);
    expect(attached).toBe(true);
    expect(recorder.getById(record.id)?.executionFill).toEqual(fill);
  });
});
