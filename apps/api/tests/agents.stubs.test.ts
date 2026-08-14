import { describe, expect, it } from "vitest";
import { AgentOutput } from "@committee/contracts";

import {
  StubFundamentalAgent,
  StubSentimentAgent,
  StubTechnicalAgent,
} from "../src/agents/stubs/index.js";
import { runAgents } from "../src/agents/runner.js";
import { makeInput, silentLogger } from "./agents.helpers.js";

const input = { ...makeInput(), runId: "33333333-3333-4333-8333-333333333333" };

describe("stub agents", () => {
  const agents = [
    new StubTechnicalAgent({ logger: silentLogger }),
    new StubSentimentAgent({ logger: silentLogger }),
    new StubFundamentalAgent({ logger: silentLogger }),
  ];

  it("each returns schema-valid AgentOutput under its own name", async () => {
    for (const agent of agents) {
      const out = await agent.analyze(input);
      expect(() => AgentOutput.parse(out)).not.toThrow();
      expect(out.agent).toBe(agent.name);
      expect(out.confidence).toBeGreaterThanOrEqual(0);
      expect(out.confidence).toBeLessThanOrEqual(1);
      expect(out.rationale.length).toBeGreaterThan(0);
      expect(out.evidence.stub).toBe(true);
    }
  });

  it("is deterministic — same input, byte-identical output", async () => {
    const agent = new StubTechnicalAgent({ logger: silentLogger });
    const a = await agent.analyze(input);
    const b = await agent.analyze(input);
    expect(a).toEqual(b);
  });

  it("varies by symbol so downstream fixtures are not all identical", async () => {
    const agent = new StubTechnicalAgent({ logger: silentLogger });
    const aapl = await agent.analyze(input);
    const msft = await agent.analyze({ ...input, symbol: "MSFT" });
    expect(aapl.evidence.symbol).toBe("AAPL");
    expect(msft.evidence.symbol).toBe("MSFT");
  });

  it("runs end-to-end through runAgents with no LLM and no database", async () => {
    const { runId, outputs } = await runAgents(makeInput(), agents, {
      persistence: null,
      logger: silentLogger,
    });

    expect(runId).toBeTruthy();
    expect(outputs.map((o) => o.agent).sort()).toEqual([
      "fundamental",
      "sentiment",
      "technical",
    ]);
  });
});
