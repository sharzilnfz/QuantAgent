import { z } from "zod";

// ─── ISO date-time string ───────────────────────────────────────────────────
export const ISODateTime = z.string().datetime({ offset: true });

// ─── Agent bias enum ────────────────────────────────────────────────────────
export const BiasEnum = z.enum(["bullish", "bearish", "neutral"]);
export type Bias = z.infer<typeof BiasEnum>;

// ─── Agent run status enum ──────────────────────────────────────────────────
export const AgentRunStatusEnum = z.enum(["pending", "success", "error"]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusEnum>;

// ─── AgentInput ─────────────────────────────────────────────────────────────
/**
 * The input payload provided to every agent's `analyze()` method.
 * `decisionAsOf` is the point-in-time boundary: the agent may only use data
 * with `as_of <= decisionAsOf`.
 */
export const AgentInputSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().min(1),
  decisionAsOf: ISODateTime,
  features: z.record(z.string(), z.number()),
});
export type AgentInput = z.infer<typeof AgentInputSchema>;

// ─── AgentOutput ────────────────────────────────────────────────────────────
/**
 * The schema-valid output every agent must return.
 * `features` echoes the exact numbers used to arrive at the bias/confidence,
 * ensuring full auditability (facts-first principle).
 */
export const AgentOutputSchema = z.object({
  agentName: z.string().min(1),
  symbol: z.string().min(1),
  bias: BiasEnum,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  features: z.record(z.string(), z.number()),
  asOf: ISODateTime,
  schemaVersion: z.string().min(1),
});
export type AgentOutput = z.infer<typeof AgentOutputSchema>;
