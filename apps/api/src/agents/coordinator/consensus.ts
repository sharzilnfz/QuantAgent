import type { AgentOutput, Direction } from "@committee/contracts";

export interface ConsensusEvaluation {
  reached: boolean;
  mode?: "consensus_short_circuit";
  direction?: Direction;
  confidence?: number;
  rationale?: string;
  reason?: "directional_conflict" | "unilateral_signal";
}

/**
 * Evaluate directional consensus across specialist agent outputs.
 *
 * Fast-path rule (0 extra tokens):
 * If all active specialists share the identical directional stance
 * (e.g. bullish-bullish, bearish-bearish, neutral-neutral), consensus is reached immediately.
 * Confidence is the arithmetic mean of the agreeing specialists.
 */
export function evaluateConsensus(
  specialists: Record<string, AgentOutput> | AgentOutput[],
): ConsensusEvaluation {
  const outputs = Array.isArray(specialists) ? specialists : Object.values(specialists);

  if (outputs.length === 0) {
    return {
      reached: true,
      mode: "consensus_short_circuit",
      direction: "neutral",
      confidence: 0,
      rationale: "No specialist outputs provided; defaulting to neutral consensus.",
    };
  }

  const first = outputs[0];
  if (!first) {
    return {
      reached: true,
      mode: "consensus_short_circuit",
      direction: "neutral",
      confidence: 0,
      rationale: "Empty specialist output list.",
    };
  }

  // Check if every specialist shares the same direction (unanimous)
  const allAgree = outputs.every((o) => o.direction === first.direction);

  if (allAgree) {
    const avgConfidence =
      outputs.reduce((sum, o) => sum + o.confidence, 0) / outputs.length;
    const roundedConfidence = Math.round(avgConfidence * 1000) / 1000;

    const agentsList = outputs.map((o) => `${o.agent}=${o.confidence}`).join(", ");
    return {
      reached: true,
      mode: "consensus_short_circuit",
      direction: first.direction,
      confidence: roundedConfidence,
      rationale: `Unanimous specialist consensus on ${first.direction} (${agentsList}).`,
    };
  }

  // Count directions
  const bullishOutputs = outputs.filter((o) => o.direction === "bullish");
  const bearishOutputs = outputs.filter((o) => o.direction === "bearish");
  const isDirectConflict = bullishOutputs.length > 0 && bearishOutputs.length > 0;

  // Majority rule without opposing conflict (e.g. 2 bullish + 1 neutral, or 2 bearish + 1 neutral)
  if (!isDirectConflict) {
    if (bullishOutputs.length >= 2) {
      const avgConfidence =
        bullishOutputs.reduce((sum, o) => sum + o.confidence, 0) / bullishOutputs.length;
      const roundedConfidence = Math.round(avgConfidence * 1000) / 1000;
      const agentsList = bullishOutputs.map((o) => `${o.agent}=${o.confidence}`).join(", ");
      return {
        reached: true,
        mode: "consensus_short_circuit",
        direction: "bullish",
        confidence: roundedConfidence,
        rationale: `Majority specialist consensus on bullish with no opposing dissent (${agentsList}).`,
      };
    }

    if (bearishOutputs.length >= 2) {
      const avgConfidence =
        bearishOutputs.reduce((sum, o) => sum + o.confidence, 0) / bearishOutputs.length;
      const roundedConfidence = Math.round(avgConfidence * 1000) / 1000;
      const agentsList = bearishOutputs.map((o) => `${o.agent}=${o.confidence}`).join(", ");
      return {
        reached: true,
        mode: "consensus_short_circuit",
        direction: "bearish",
        confidence: roundedConfidence,
        rationale: `Majority specialist consensus on bearish with no opposing dissent (${agentsList}).`,
      };
    }
  }

  return {
    reached: false,
    reason: isDirectConflict ? "directional_conflict" : "unilateral_signal",
  };
}
