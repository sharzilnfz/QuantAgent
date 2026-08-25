import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Direction } from "./enums";
import { AgentOutput } from "./agents";

/**
 * Decision pathway taken by the multi-agent coordinator:
 * - `consensus_short_circuit`: Specialists agreed naturally; fast-pathed at $0.00 extra cost (0 extra tokens).
 * - `debate_synthesis`: Specialists disagreed and debate was enabled; single-pass LLM synthesized stances.
 * - `ablation_neutral_fallback`: Specialists disagreed with debate disabled (control mode); defaulted to neutral abstain.
 */
export const CoordinatorMode = z.enum([
  "consensus_short_circuit",
  "debate_synthesis",
  "ablation_neutral_fallback",
]);
export type CoordinatorMode = z.infer<typeof CoordinatorMode>;

/**
 * Structured critique argument generated during adversarial cross-examination rounds.
 */
export const DebateCritique = z.object({
  agent: z.string(),
  stance: Direction,
  rebuttal: z.string().min(1).max(2000),
  revisedConfidence: z.number().min(0).max(1),
});
export type DebateCritique = z.infer<typeof DebateCritique>;

/**
 * Structured LLM synthesis output generated during multi-agent debate reconciliation.
 * Encapsulates the reconciled stance, confidence score, rationale, dissenting view analysis,
 * and multi-round cross-examination critiques.
 */
export const DebateSynthesis = z.object({
  direction: Direction,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(2000),
  dissentingView: z.string().min(1).max(2000).optional(),
  primaryDriver: z.enum(["technical", "sentiment", "fundamental", "macro", "compromise"]).default("compromise"),
  rounds: z.number().int().min(1).max(3).optional(),
  critiques: z.array(DebateCritique).optional(),
  tokenCost: z.number().min(0).default(0).optional(),
  latencyMs: z.number().min(0).default(0).optional(),
});
export type DebateSynthesis = z.infer<typeof DebateSynthesis>;

/**
 * JSON-Schema export for structured model completion requests during debate synthesis.
 */
export const DebateSynthesisJsonSchema = zodToJsonSchema(DebateSynthesis, "DebateSynthesis");

/**
 * Output of the L3 multi-agent coordinator after evaluating all specialist signals.
 */
export const ConsensusResult = z.object({
  lineageId: z.string().uuid(),
  consensusReached: z.boolean(),
  mode: CoordinatorMode,
  finalBias: Direction,
  finalConfidence: z.number().min(0).max(1),
  specialistVotes: z.record(z.string(), AgentOutput),
  synthesis: DebateSynthesis.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ConsensusResult = z.infer<typeof ConsensusResult>;
