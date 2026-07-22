/**
 * Public entrypoint for `@committee/db`.
 * Re-exports the client, the schema (tables + enums), the jsonb payload types,
 * and inferred Row / Insert types for every table.
 */
export { db, sql } from "./client";
export type { DrizzleDb } from "./client";
export * from "./schema";
export * from "./types";

import type {
  users,
  sessions,
  alpacaCredentials,
  watchlistItems,
} from "./schema/users";
import type { priceBars, indicatorSnapshots } from "./schema/market";
import type { agentRuns, agentOutputs } from "./schema/agents";

/** Inferred SELECT (Row) types. */
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AlpacaCredential = typeof alpacaCredentials.$inferSelect;
export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type PriceBar = typeof priceBars.$inferSelect;
export type IndicatorSnapshot = typeof indicatorSnapshots.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AgentOutput = typeof agentOutputs.$inferSelect;

/** Inferred INSERT types. */
export type NewUser = typeof users.$inferInsert;
export type NewSession = typeof sessions.$inferInsert;
export type NewAlpacaCredential = typeof alpacaCredentials.$inferInsert;
export type NewWatchlistItem = typeof watchlistItems.$inferInsert;
export type NewPriceBar = typeof priceBars.$inferInsert;
export type NewIndicatorSnapshot = typeof indicatorSnapshots.$inferInsert;
export type NewAgentRun = typeof agentRuns.$inferInsert;
export type NewAgentOutput = typeof agentOutputs.$inferInsert;
