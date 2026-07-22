import type { AgentInput, AgentOutput, AgentName } from "@committee/contracts";

import { BaseAgent } from "../base.js";
import { round2, seededUnitInterval } from "./seed.js";

/** Placeholder for the Sprint-2 fundamental agent. Deterministic and offline. */
export class StubFundamentalAgent extends BaseAgent {
  readonly name: AgentName = "fundamental";

  protected async run(input: AgentInput): Promise<AgentOutput> {
    const seed = seededUnitInterval("fundamental", input.symbol, input.decisionTs);
    const direction = seed < 0.5 ? "bullish" : seed < 0.85 ? "neutral" : "bearish";
    const confidence = direction === "neutral" ? 0.15 : round2(0.2 + seed * 0.3);

    return {
      agent: this.name,
      direction,
      confidence,
      rationale: `stub fundamental read for ${input.symbol} — deterministic placeholder, no financials consulted`,
      evidence: {
        stub: true,
        symbol: input.symbol,
        decisionTs: input.decisionTs,
        statementsConsidered: 0,
      },
    };
  }
}
