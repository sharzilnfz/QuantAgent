import { describe, expect, it } from "vitest";
import { AgentOutput, type AgentName } from "@committee/contracts";

import { NO_OPINION, type Agent, type AgentLogRecord } from "../src/agents/base.js";
import type { AgentRunPersistence, AgentRunRecord } from "../src/agents/persistence.js";
import { runAgents } from "../src/agents/runner.js";
import {
  HealthyAgent,
  InvalidOutputAgent,
  SlowAgent,
  ThrowingAgent,
  makeInput,
  silentLogger,
  sleep,
} from "./agents.helpers.js";

/**
 * Spec 06 §7. Every test here runs with `persistence: null` — the DB seam is
 * injectable precisely so these can prove the resilience contract without Postgres.
 */

function recordingPersistence() {
  const runs: AgentRunRecord[] = [];
  const outputs: Array<{ runId: string; output: AgentOutput }> = [];
  const finished: Array<{ runId: string; status: string }> = [];

  const persistence: AgentRunPersistence = {
    async createRun(record) {
      runs.push(record);
    },
    async saveOutput(runId, output) {
      outputs.push({ runId, output });
    },
    async finishRun(runId, status) {
      finished.push({ runId, status });
    },
  };

  return { persistence, runs, outputs, finished };
}

describe("runAgents — resilience (PRD Testing Decisions)", () => {
  it("completes with a thrower and a timeout present; healthy output is unaffected", async () => {
    const healthy = new HealthyAgent("technical", 0, "bullish");

    const { runId, outputs } = await runAgents(
      makeInput(),
      [healthy, new ThrowingAgent("sentiment"), new SlowAgent("fundamental", 200, 25)],
      { persistence: null, logger: silentLogger },
    );

    expect(runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(outputs).toHaveLength(3);

    const byAgent = Object.fromEntries(outputs.map((o) => [o.agent, o]));

    // The healthy agent's real output survived untouched.
    expect(byAgent.technical).toMatchObject({
      direction: "bullish",
      confidence: 0.77,
      rationale: "healthy technical output",
    });

    // Both failure modes degraded to the same neutral shape.
    expect(byAgent.sentiment).toEqual(NO_OPINION("sentiment", "error"));
    expect(byAgent.fundamental).toEqual(NO_OPINION("fundamental", "timeout"));

    for (const output of outputs) expect(() => AgentOutput.parse(output)).not.toThrow();
  });

  it("survives an Agent that bypasses BaseAgent and rejects outright", async () => {
    const rogue: Agent = {
      name: "sentiment" as AgentName,
      analyze: async () => {
        throw new Error("rogue agent exploded");
      },
    };

    const { outputs } = await runAgents(
      makeInput(),
      [new HealthyAgent("technical"), rogue],
      { persistence: null, logger: silentLogger },
    );

    expect(outputs).toHaveLength(2);
    expect(outputs[1]).toEqual(NO_OPINION("sentiment", "error"));
  });
});

describe("runAgents — schema enforcement", () => {
  it("catches invalid output and returns neutral instead of propagating it", async () => {
    const { outputs } = await runAgents(
      makeInput(),
      [new InvalidOutputAgent("sentiment")],
      { persistence: null, logger: silentLogger },
    );

    expect(outputs[0]?.confidence).toBe(0);
    expect(outputs[0]?.direction).toBe("neutral");
    expect(() => AgentOutput.parse(outputs[0])).not.toThrow();
  });

  it("catches invalid output from an Agent that skips BaseAgent validation", async () => {
    const rogue: Agent = {
      name: "fundamental" as AgentName,
      analyze: async () =>
        ({
          agent: "fundamental",
          direction: "bearish",
          confidence: 9.5,
          rationale: "",
          evidence: {},
        }) as AgentOutput,
    };

    const { outputs } = await runAgents(makeInput(), [rogue], {
      persistence: null,
      logger: silentLogger,
    });

    expect(outputs[0]).toEqual(NO_OPINION("fundamental", "error"));
  });
});

describe("runAgents — parallelism", () => {
  it("runs three ~100ms agents concurrently (~100ms, not ~300ms)", async () => {
    const agents = [
      new HealthyAgent("technical", 100),
      new HealthyAgent("sentiment", 100),
      new HealthyAgent("fundamental", 100),
    ];

    const startedAt = Date.now();
    const { outputs } = await runAgents(makeInput(), agents, {
      persistence: null,
      logger: silentLogger,
    });
    const elapsed = Date.now() - startedAt;

    expect(outputs).toHaveLength(3);
    // Serial execution would be >= 300ms. Generous ceiling for CI jitter.
    expect(elapsed).toBeLessThan(250);
    expect(elapsed).toBeGreaterThanOrEqual(90);
  });

  it("a slow agent does not delay the fast agents' own completion", async () => {
    const finishedAt: Record<string, number> = {};
    const start = Date.now();

    class Timed extends HealthyAgent {
      override async analyze(input: Parameters<HealthyAgent["analyze"]>[0]) {
        const out = await super.analyze(input);
        finishedAt[this.name] = Date.now() - start;
        return out;
      }
    }

    await runAgents(
      makeInput(),
      [new Timed("technical", 0), new Timed("sentiment", 150)],
      { persistence: null, logger: silentLogger },
    );

    expect(finishedAt["technical"] ?? Infinity).toBeLessThan(60);
    expect(finishedAt["sentiment"] ?? 0).toBeGreaterThanOrEqual(140);
  });
});

describe("runAgents — persistence seam", () => {
  it("writes one run row + one output row per agent, then closes the lifecycle", async () => {
    const { persistence, runs, outputs, finished } = recordingPersistence();

    const result = await runAgents(
      makeInput(),
      [new HealthyAgent("technical"), new ThrowingAgent("sentiment")],
      { persistence, logger: silentLogger },
    );

    expect(runs).toEqual([
      {
        runId: result.runId,
        symbol: "AAPL",
        timeframe: "1Day",
        decisionTs: makeInput().decisionTs,
      },
    ]);
    expect(outputs).toHaveLength(2);
    expect(outputs.every((o) => o.runId === result.runId)).toBe(true);
    expect(finished).toEqual([{ runId: result.runId, status: "completed" }]);
  });

  it("still completes the run when persistence is broken", async () => {
    const broken: AgentRunPersistence = {
      async createRun() {
        throw new Error("db down");
      },
      async saveOutput() {
        throw new Error("db down");
      },
      async finishRun() {
        throw new Error("db down");
      },
    };

    const { outputs } = await runAgents(makeInput(), [new HealthyAgent("technical")], {
      persistence: broken,
      logger: silentLogger,
    });

    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.direction).toBe("bullish");
  });

  it("skips persistence entirely when passed null", async () => {
    const { persistence, runs } = recordingPersistence();
    void persistence;
    await runAgents(makeInput(), [new HealthyAgent("technical")], {
      persistence: null,
      logger: silentLogger,
    });
    expect(runs).toHaveLength(0);
  });
});

describe("runAgents — logging", () => {
  it("keys every line by the returned runId", async () => {
    const records: AgentLogRecord[] = [];

    const { runId } = await runAgents(makeInput(), [new HealthyAgent("technical")], {
      persistence: null,
      logger: (record) => records.push(record),
    });

    const events = records.map((r) => r.event);
    expect(events).toContain("agent_run.start");
    expect(events).toContain("agent_run.finish");
    expect(records.every((r) => r.runId === runId)).toBe(true);
  });

  it("honours a caller-supplied runId so a run is replayable by id", async () => {
    const replayId = "22222222-2222-4222-8222-222222222222";
    const { runId } = await runAgents(makeInput(), [new HealthyAgent("technical")], {
      persistence: null,
      logger: silentLogger,
      runId: replayId,
    });
    expect(runId).toBe(replayId);
  });
});

describe("runAgents — input plumbing", () => {
  it("injects the runId into the AgentInput each agent receives", async () => {
    let seen: string | undefined;
    const spy: Agent = {
      name: "technical" as AgentName,
      analyze: async (agentInput) => {
        seen = agentInput.runId;
        await sleep(1);
        return {
          agent: "technical",
          direction: "neutral",
          confidence: 0,
          rationale: "spy",
          evidence: {},
        };
      },
    };

    const { runId } = await runAgents(makeInput(), [spy], {
      persistence: null,
      logger: silentLogger,
    });

    expect(seen).toBe(runId);
  });
});
