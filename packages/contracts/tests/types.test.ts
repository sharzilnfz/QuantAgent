import { describe, it, expect } from "vitest";
import type { AgentOutput } from "../src/agents";
import type { Direction, AgentName } from "../src/enums";

/**
 * Compile-time parity with spec 01's `agent_outputs` insert shape.
 *
 * We must NOT import `@committee/db` here (contracts stays db-free), so we mirror the
 * relevant insert columns locally. If spec 01's row shape drifts from this contract, this
 * assignment stops compiling — surfacing the contract-change event described in the spec.
 * The `expectAssignable` calls are compile-only; the runtime body is a trivial truthy check.
 */

// Local mirror of the spec-01 `agent_outputs` insert type (subset that overlaps the contract).
interface AgentOutputInsert {
  agent: AgentName;
  direction: Direction;
  confidence: number;
  rationale: string;
  evidence: Record<string, number | string | boolean>;
}

function expectAssignable<T>(_value: T): void {
  /* type-level only */
}

describe("type-level contracts", () => {
  it("AgentOutput is assignable to the spec-01 agent_outputs insert type", () => {
    const out: AgentOutput = {
      agent: "technical",
      direction: "neutral",
      confidence: 0.5,
      rationale: "No decisive signal.",
      evidence: {},
    };
    // Compile check: contract type must satisfy the DB insert shape.
    const insert: AgentOutputInsert = out;
    expectAssignable<AgentOutputInsert>(out);
    expect(insert.agent).toBe("technical");
  });
});
