import type { AgentInput, AgentOutput, AgentName } from "@committee/contracts";

import { BaseAgent } from "../base.js";
import { round2, seededUnitInterval } from "./seed.js";

/** Placeholder for the Sprint-2 sentiment agent. Deterministic and offline. */
export class StubSentimentAgent extends BaseAgent {
  readonly name: AgentName = "sentiment";

  protected async run(input: AgentInput): Promise<AgentOutput> {
    const seed = seededUnitInterval("sentiment", input.symbol, input.decisionTs);
    const direction = seed < 0.45 ? "bullish" : seed < 0.75 ? "neutral" : "bearish";
    const confidence = direction === "neutral" ? 0.1 : round2(0.25 + seed * 0.35);

    return {
      agent: this.name,
      direction,
      confidence,
      rationale: `stub sentiment read for ${input.symbol} — deterministic placeholder, no news consulted`,
      evidence: {
        stub: true,
        symbol: input.symbol,
        decisionTs: input.decisionTs,
        headlinesConsidered: 0,
      },
    };
  }
}
