import { describe, expect, it } from "vitest";
import { AgentOutput, type AgentInput, type PriceBar } from "@committee/contracts";

import { NO_OPINION } from "../src/agents/base.js";
import { runAgents } from "../src/agents/runner.js";
import { TechnicalAgent, blendConfidence } from "../src/agents/technical/agent.js";
import { classify } from "../src/agents/technical/classify.js";
import { ScriptedLlmClient } from "../src/agents/technical/llm-client.js";
import { createInMemorySnapshotProvider } from "../src/agents/technical/snapshots.js";
import { AGENT_OUTPUT_TOOL_NAME } from "../src/agents/technical/prompt.js";
import { DECISION_TS, makeInput, makeSnapshot, silentLogger } from "./agents.helpers.js";

/**
 * Spec 07 §7 — technical agent tests. The LLM is ALWAYS mocked: no live API call,
 * no network, no budget burn. Assertions are on bounds and on computed values,
 * never on model wording.
 */

const RUN_ID = "44444444-4444-4444-8444-444444444444";

/** Strongly oversold + bullish cross + below lower band. */
const BULLISH_SNAPSHOT = makeSnapshot({
  rsi: 22,
  macd: 1.4,
  macdSignal: 0.6,
  bbLower: 95,
  bbUpper: 115,
  sma20: 104,
  sma50: 100,
  asOf: DECISION_TS,
});

const OVERBOUGHT_SNAPSHOT = makeSnapshot({
  rsi: 84,
  macd: 0.1,
  macdSignal: 1.2,
  bbLower: 95,
  bbUpper: 115,
  sma20: 100,
  sma50: 106,
  asOf: DECISION_TS,
});

function bar(close: number, asOf: string): PriceBar {
  return {
    symbol: "AAPL",
    timeframe: "1Day",
    ts: asOf,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1_000,
    asOf,
  };
}

function inputWith(overrides: Partial<AgentInput> = {}): AgentInput {
  return { ...makeInput(overrides), runId: RUN_ID } as AgentInput;
}

/** A well-behaved mocked model that follows the mechanical read it was handed. */
function obedientReply(direction: AgentOutput["direction"], confidence = 0.8) {
  return {
    agent: "technical",
    direction,
    confidence,
    rationale: `Signals point ${direction}; the mechanical read is corroborated by the fired rules.`,
    evidence: {},
  };
}

function makeAgent(payloads: unknown[], snapshots: Parameters<typeof createInMemorySnapshotProvider>[0] = []) {
  const llm = new ScriptedLlmClient(payloads);
  const agent = new TechnicalAgent({
    llm,
    snapshots: createInMemorySnapshotProvider(snapshots),
    model: "claude-haiku-4-5",
    logger: silentLogger,
  });
  return { agent, llm };
}

describe("TechnicalAgent — schema validity", () => {
  it("returns a schema-valid AgentOutput for a valid point-in-time snapshot", async () => {
    const { agent } = makeAgent([obedientReply("bullish")]);
    const out = await agent.analyze(
      inputWith({ indicators: BULLISH_SNAPSHOT, bars: [bar(92, DECISION_TS)] }),
    );

    expect(() => AgentOutput.parse(out)).not.toThrow();
    expect(out.agent).toBe("technical");
    expect(["bullish", "bearish", "neutral"]).toContain(out.direction);
    expect(out.confidence).toBeGreaterThanOrEqual(0);
    expect(out.confidence).toBeLessThanOrEqual(1);
    expect(out.rationale.length).toBeGreaterThan(0);
  });

  it("makes exactly ONE LLM call on the happy path, on the cheap tier", async () => {
    const { agent, llm } = makeAgent([obedientReply("bullish")]);
    await agent.analyze(inputWith({ indicators: BULLISH_SNAPSHOT, bars: [bar(92, DECISION_TS)] }));

    expect(llm.callCount).toBe(1);
    expect(llm.requests[0]?.model).toBe("claude-haiku-4-5");
    expect(llm.requests[0]?.toolName).toBe(AGENT_OUTPUT_TOOL_NAME);
    expect(llm.requests[0]?.toolSchema).toMatchObject({ type: "object" });
  });
});

describe("TechnicalAgent — FACTS VS NARRATION", () => {
  it("computed indicator values win over anything the model narrates", async () => {
    // The model claims RSI 65 and a totally different MACD. The computed values must win.
    const lyingModel = {
      agent: "technical",
      direction: "bullish",
      confidence: 0.9,
      rationale: "RSI is 65 which is neutral-to-hot, and MACD is -4.",
      evidence: { rsi: 65, macd: -4, macdSignal: 99, close: 12345, rule: "made_up_rule" },
    };

    const { agent } = makeAgent([lyingModel]);
    const input = inputWith({ indicators: BULLISH_SNAPSHOT, bars: [bar(92, DECISION_TS)] });
    const out = await agent.analyze(input);

    const computed = classify({
      rsi: BULLISH_SNAPSHOT.rsi,
      macd: BULLISH_SNAPSHOT.macd,
      macdSignal: BULLISH_SNAPSHOT.macdSignal,
      bbUpper: BULLISH_SNAPSHOT.bbUpper,
      bbLower: BULLISH_SNAPSHOT.bbLower,
      sma20: BULLISH_SNAPSHOT.sma20,
      sma50: BULLISH_SNAPSHOT.sma50,
      close: 92,
    });

    expect(out.evidence.rsi).toBe(22);
    expect(out.evidence.rsi).toBe(computed.evidence.rsi);
    expect(out.evidence.macd).toBe(1.4);
    expect(out.evidence.macdSignal).toBe(0.6);
    expect(out.evidence.close).toBe(92);
    expect(out.evidence.rule).toBe(computed.rule);
    expect(out.evidence.rule).not.toBe("made_up_rule");
  });

  it("hands the model already-computed facts and forbids it from computing", async () => {
    const { agent, llm } = makeAgent([obedientReply("bullish")]);
    await agent.analyze(inputWith({ indicators: BULLISH_SNAPSHOT, bars: [bar(92, DECISION_TS)] }));

    const request = llm.requests[0];
    expect(request?.user).toContain("rsi: 22");
    expect(request?.user).toContain("COMPUTED FACTS");
    expect(request?.system).toContain("must");
    expect(request?.system.toLowerCase()).toContain("not");
  });
});

describe("TechnicalAgent — point-in-time discipline", () => {
  it("ignores a snapshot whose as_of is after decisionTs and uses the legal earlier one", async () => {
    const legal = makeSnapshot({ rsi: 22, asOf: "2026-03-09T21:00:00.000Z" });
    const future = makeSnapshot({ rsi: 99, asOf: "2026-03-11T21:00:00.000Z" });

    const { agent } = makeAgent([obedientReply("bullish")], [legal, future]);
    const out = await agent.analyze(inputWith({ indicators: null }));

    expect(out.evidence.rsi).toBe(22);
    expect(out.evidence.snapshotAsOf).toBe("2026-03-09T21:00:00.000Z");
  });

  it("rejects an illegal snapshot handed in on the input and falls back to a legal one", async () => {
    const legal = makeSnapshot({ rsi: 22, asOf: "2026-03-09T21:00:00.000Z" });
    const illegal = makeSnapshot({ rsi: 99, asOf: "2026-03-11T21:00:00.000Z" });

    const { agent } = makeAgent([obedientReply("bullish")], [legal]);
    const out = await agent.analyze(inputWith({ indicators: illegal }));

    expect(out.evidence.rsi).toBe(22);
    expect(out.evidence.snapshotAsOf).toBe("2026-03-09T21:00:00.000Z");
  });

  it("ignores bars whose as_of is after decisionTs when deriving close", async () => {
    const { agent } = makeAgent([obedientReply("bullish")]);
    const out = await agent.analyze(
      inputWith({
        indicators: BULLISH_SNAPSHOT,
        bars: [
          bar(92, "2026-03-10T21:00:00.000Z"),
          bar(500, "2026-03-11T21:00:00.000Z"), // future bar — must be ignored
        ],
      }),
    );

    expect(out.evidence.close).toBe(92);
  });

  it("returns NO_OPINION when no legal snapshot exists — never a fabricated bias", async () => {
    const future = makeSnapshot({ rsi: 99, asOf: "2026-03-11T21:00:00.000Z" });
    const { agent, llm } = makeAgent([obedientReply("bullish")], [future]);

    const out = await agent.analyze(inputWith({ indicators: null }));

    expect(out).toEqual(NO_OPINION("technical", "error"));
    expect(llm.callCount).toBe(0);
  });

  it("returns NO_OPINION when the snapshot exists but every indicator is null", async () => {
    const blank = makeSnapshot({
      rsi: null,
      macd: null,
      macdSignal: null,
      bbUpper: null,
      bbLower: null,
      sma20: null,
      sma50: null,
    });
    const { agent, llm } = makeAgent([obedientReply("bullish")]);

    const out = await agent.analyze(inputWith({ indicators: blank }));

    expect(out).toEqual(NO_OPINION("technical", "error"));
    expect(llm.callCount).toBe(0);
  });
});

describe("TechnicalAgent — plausible bounds", () => {
  it("stays bullish given strongly oversold + bullish-cross inputs", async () => {
    const { agent } = makeAgent([obedientReply("bullish")]);
    const out = await agent.analyze(
      inputWith({ indicators: BULLISH_SNAPSHOT, bars: [bar(92, DECISION_TS)] }),
    );

    expect(out.direction).toBe("bullish");
    expect(out.evidence.mechanicalDirection).toBe("bullish");
    expect(out.confidence).toBeGreaterThan(0);
  });

  it("stays bearish given strongly overbought inputs", async () => {
    const { agent } = makeAgent([obedientReply("bearish")]);
    const out = await agent.analyze(
      inputWith({ indicators: OVERBOUGHT_SNAPSHOT, bars: [bar(121, DECISION_TS)] }),
    );

    expect(out.direction).toBe("bearish");
    expect(out.evidence.mechanicalDirection).toBe("bearish");
  });

  it("halves conviction when the model overrides the mechanical read", async () => {
    const input = inputWith({ indicators: BULLISH_SNAPSHOT, bars: [bar(92, DECISION_TS)] });

    const agreeing = makeAgent([obedientReply("bullish", 0.8)]);
    const dissenting = makeAgent([obedientReply("bearish", 0.8)]);

    const agreed = await agreeing.agent.analyze(input);
    const dissented = await dissenting.agent.analyze(input);

    expect(dissented.evidence.modelAgreesWithRules).toBe(false);
    expect(dissented.confidence).toBeLessThan(agreed.confidence);
    expect(dissented.confidence).toBeCloseTo(agreed.confidence / 2, 2);
  });
});

describe("TechnicalAgent — malformed model output", () => {
  it("retries exactly once then falls back to NO_OPINION", async () => {
    const malformed = { agent: "technical", direction: "sideways", confidence: 7 };
    const { agent, llm } = makeAgent([malformed, malformed]);

    const out = await agent.analyze(
      inputWith({ indicators: BULLISH_SNAPSHOT, bars: [bar(92, DECISION_TS)] }),
    );

    expect(llm.callCount).toBe(2);
    expect(out).toEqual(NO_OPINION("technical", "error"));
    expect(() => AgentOutput.parse(out)).not.toThrow();
  });

  it("recovers when the retry returns valid output", async () => {
    const { agent, llm } = makeAgent([{ nonsense: true }, obedientReply("bullish")]);

    const out = await agent.analyze(
      inputWith({ indicators: BULLISH_SNAPSHOT, bars: [bar(92, DECISION_TS)] }),
    );

    expect(llm.callCount).toBe(2);
    expect(out.direction).toBe("bullish");
  });

  it("survives an LLM client that throws, and never crashes the run", async () => {
    const throwing = {
      completeStructured: async () => {
        throw new Error("429 rate limited");
      },
    };
    const agent = new TechnicalAgent({
      llm: throwing,
      snapshots: null,
      logger: silentLogger,
    });

    const { outputs } = await runAgents(
      makeInput({ indicators: BULLISH_SNAPSHOT, bars: [bar(92, DECISION_TS)] }),
      [agent],
      { persistence: null, logger: silentLogger },
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toEqual(NO_OPINION("technical", "error"));
  });
});

describe("TechnicalAgent — runner integration", () => {
  it("runs through runAgents and yields a validated, persistable output", async () => {
    const { agent } = makeAgent([obedientReply("bullish")]);
    const saved: AgentOutput[] = [];

    const { runId, outputs } = await runAgents(
      makeInput({ indicators: BULLISH_SNAPSHOT, bars: [bar(92, DECISION_TS)] }),
      [agent],
      {
        logger: silentLogger,
        persistence: {
          async createRun() {},
          async saveOutput(_runId, output) {
            saved.push(output);
          },
          async finishRun() {},
        },
      },
    );

    expect(runId).toBeTruthy();
    expect(outputs).toHaveLength(1);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.agent).toBe("technical");
    expect(saved[0]?.evidence.rsi).toBe(22);
  });
});

describe("blendConfidence", () => {
  it("is clamped to [0,1] and halves on disagreement", () => {
    expect(blendConfidence(1, 1, true)).toBe(1);
    expect(blendConfidence(1, 1, false)).toBe(0.5);
    expect(blendConfidence(0, 0, true)).toBe(0);
    expect(blendConfidence(0.4, 0.8, true)).toBeCloseTo(0.6, 5);
    expect(blendConfidence(2, 2, true)).toBe(1);
    expect(blendConfidence(-5, -5, true)).toBe(0);
  });
});
