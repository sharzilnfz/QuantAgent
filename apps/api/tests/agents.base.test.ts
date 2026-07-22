import { describe, expect, it } from "vitest";
import { AgentOutput } from "@committee/contracts";

import { BaseAgent, NO_OPINION, type AgentLogRecord } from "../src/agents/base.js";
import {
  DECISION_TS,
  HealthyAgent,
  InvalidOutputAgent,
  SlowAgent,
  ThrowingAgent,
  makeInput,
} from "./agents.helpers.js";

const input = { ...makeInput(), runId: "11111111-1111-4111-8111-111111111111" };

describe("NO_OPINION", () => {
  it("is the one neutral fallback shape and is schema-valid", () => {
    for (const reason of ["timeout", "error"] as const) {
      const out = NO_OPINION("technical", reason);
      expect(() => AgentOutput.parse(out)).not.toThrow();
      expect(out.direction).toBe("neutral");
      expect(out.confidence).toBe(0);
      expect(out.rationale).toBe(`no opinion (${reason})`);
    }
  });
});

describe("BaseAgent.analyze", () => {
  it("returns the validated output of a healthy agent", async () => {
    const out = await new HealthyAgent("technical").analyze(input);
    expect(out.agent).toBe("technical");
    expect(out.direction).toBe("bullish");
    expect(() => AgentOutput.parse(out)).not.toThrow();
  });

  it("maps a throwing agent to NO_OPINION instead of rejecting", async () => {
    const out = await new ThrowingAgent("sentiment").analyze(input);
    expect(out).toEqual(NO_OPINION("sentiment", "error"));
  });

  it("maps a timed-out agent to NO_OPINION(timeout)", async () => {
    const out = await new SlowAgent("fundamental", 200, 25).analyze(input);
    expect(out).toEqual(NO_OPINION("fundamental", "timeout"));
  });

  it("catches schema-invalid output and never propagates it", async () => {
    const out = await new InvalidOutputAgent("sentiment").analyze(input);
    expect(out.confidence).toBe(0);
    expect(out.direction).toBe("neutral");
    expect(() => AgentOutput.parse(out)).not.toThrow();
  });

  it("emits one structured log line keyed by runId, carrying no secrets", async () => {
    const records: AgentLogRecord[] = [];

    class LoggedAgent extends BaseAgent {
      readonly name = "technical" as const;
      protected async run(): Promise<AgentOutput> {
        return {
          agent: "technical",
          direction: "neutral",
          confidence: 0.5,
          rationale: "ok",
          evidence: {},
        };
      }
    }

    await new LoggedAgent({ logger: (r) => records.push(r) }).analyze(input);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      event: "agent.analyze",
      runId: input.runId,
      agent: "technical",
      decisionTs: DECISION_TS,
      outcome: "ok",
    });
    expect(typeof records[0]?.durationMs).toBe("number");
    // Only structural metadata is logged — never prompts, keys, or credentials.
    expect(Object.keys(records[0] ?? {}).sort()).toEqual([
      "agent",
      "decisionTs",
      "durationMs",
      "event",
      "outcome",
      "runId",
      "symbol",
    ]);
  });
});
