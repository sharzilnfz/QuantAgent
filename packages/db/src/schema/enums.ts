import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Shared Postgres enums. Kept isomorphic with the Zod enums in
 * `packages/contracts` (Direction, AgentName, Timeframe) — but NOT imported
 * from there, so `@committee/db` stays independently typecheckable.
 */

// Timeframe — mirrors contracts `Timeframe` (["1Day", "1Hour"]).
export const timeframeEnum = pgEnum("timeframe", ["1Day", "1Hour"]);

// Agent direction — mirrors contracts `Direction`.
export const directionEnum = pgEnum("direction", [
  "bullish",
  "bearish",
  "neutral",
]);

// Agent name — mirrors contracts `AgentName`.
export const agentNameEnum = pgEnum("agent_name", [
  "technical",
  "sentiment",
  "fundamental",
]);

// Lifecycle status of an agent run.
export const runStatusEnum = pgEnum("run_status", [
  "running",
  "completed",
  "failed",
]);
