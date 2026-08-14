import type { AgentInput, AgentOutput, AgentName } from "@committee/contracts";

import { BaseAgent } from "../base.js";
import { round2, seededUnitInterval } from "./seed.js";

/**
 * Placeholder for the real technical agent (spec 07). Deterministic and offline.
 * Swap it for `TechnicalAgent` without touching the runner or any caller.
 */
export class StubTechnicalAgent extends BaseAgent {
  readonly name: AgentName = "technical";

  protected async run(input: AgentInput): Promise<AgentOutput> {
    const seed = seededUnitInterval("technical", input.symbol, input.decisionTs);
    const direction = seed < 0.4 ? "bullish" : seed < 0.8 ? "bearish" : "neutral";
    // Bounded well inside [0,1] so a stub is never mistaken for a confident call.
    const confidence = direction === "neutral" ? 0 : round2(0.3 + seed * 0.4);

    return {
      agent: this.name,
      direction,
      confidence,
      rationale: `stub technical read for ${input.symbol} (${input.timeframe}) — deterministic placeholder, no indicators consulted`,
      evidence: {
        stub: true,
        symbol: input.symbol,
        timeframe: input.timeframe,
        decisionTs: input.decisionTs,
        barCount: input.bars.length,
        hasIndicatorSnapshot: input.indicators !== null,
      },
    };
  }
}
