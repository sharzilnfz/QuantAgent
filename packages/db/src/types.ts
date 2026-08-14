/**
 * Local structural types for jsonb payloads. These deliberately DUPLICATE the
 * shapes defined in `packages/contracts` (AgentOutput) rather than importing
 * them, so `@committee/db` stays independently typecheckable. Field names are
 * kept isomorphic with the contracts Zod schemas (spec 02 §4).
 */

export type Direction = "bullish" | "bearish" | "neutral";
export type AgentName = "technical" | "sentiment" | "fundamental";

/** Mirrors the contracts `AgentOutput` Zod schema. */
export type AgentOutputPayload = {
  agent: AgentName;
  direction: Direction;
  confidence: number;
  rationale: string;
  evidence: Record<string, number | string | boolean>;
};
