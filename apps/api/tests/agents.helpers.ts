import type { AgentInput, AgentOutput, AgentName, IndicatorSnapshot } from "@committee/contracts";

import { BaseAgent, type StructuredLogger } from "../src/agents/base.js";

/** Shared fixtures for the agent framework + technical agent tests. */

export const DECISION_TS = "2026-03-10T21:00:00.000Z";

export function makeInput(overrides: Partial<AgentInput> = {}): Omit<AgentInput, "runId"> {
  return {
    symbol: "AAPL",
    timeframe: "1Day",
    decisionTs: DECISION_TS,
    bars: [],
    indicators: null,
    ...overrides,
  };
}

export function makeSnapshot(
  overrides: Partial<IndicatorSnapshot> = {},
): IndicatorSnapshot {
  return {
    symbol: "AAPL",
    timeframe: "1Day",
    ts: "2026-03-10T00:00:00.000Z",
    rsi: 50,
    macd: 0,
    macdSignal: 0,
    bbUpper: 110,
    bbLower: 90,
    sma20: 100,
    sma50: 100,
    asOf: "2026-03-10T21:00:00.000Z",
    ...overrides,
  };
}

/** Silences the framework's JSON log lines during tests. */
export const silentLogger: StructuredLogger = () => {};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Agent that always throws — the resilience test's failure case. */
export class ThrowingAgent extends BaseAgent {
  readonly name: AgentName;
  constructor(name: AgentName = "sentiment") {
    super({ logger: silentLogger });
    this.name = name;
  }
  protected async run(): Promise<AgentOutput> {
    throw new Error("boom");
  }
}

/** Agent that sleeps past its timeout — the resilience test's slow case. */
export class SlowAgent extends BaseAgent {
  readonly name: AgentName;
  constructor(
    name: AgentName = "fundamental",
    private readonly delayMs = 200,
    timeoutMs = 30,
  ) {
    super({ timeoutMs, logger: silentLogger });
    this.name = name;
  }
  protected async run(): Promise<AgentOutput> {
    await sleep(this.delayMs);
    return {
      agent: this.name,
      direction: "bullish",
      confidence: 1,
      rationale: "should never be returned — the timeout fires first",
      evidence: {},
    };
  }
}

/** Agent whose output violates the schema (confidence out of [0,1]). */
export class InvalidOutputAgent extends BaseAgent {
  readonly name: AgentName;
  constructor(name: AgentName = "sentiment") {
    super({ logger: silentLogger });
    this.name = name;
  }
  protected async run(): Promise<AgentOutput> {
    return {
      agent: this.name,
      direction: "bullish",
      confidence: 42,
      rationale: "confidence is way out of bounds",
      evidence: {},
    } as AgentOutput;
  }
}

/** Well-behaved agent that sleeps a fixed amount — used for the parallelism test. */
export class HealthyAgent extends BaseAgent {
  readonly name: AgentName;
  constructor(
    name: AgentName,
    private readonly delayMs = 0,
    private readonly direction: AgentOutput["direction"] = "bullish",
  ) {
    super({ timeoutMs: 5_000, logger: silentLogger });
    this.name = name;
  }
  protected async run(): Promise<AgentOutput> {
    if (this.delayMs > 0) await sleep(this.delayMs);
    return {
      agent: this.name,
      direction: this.direction,
      confidence: 0.77,
      rationale: `healthy ${this.name} output`,
      evidence: { healthy: true },
    };
  }
}
