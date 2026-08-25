import { z } from "zod";

/**
 * Shared enums — one definition, imported everywhere (agents, signals, UI, quant).
 * Each is exported as BOTH a Zod schema (value) and its inferred TS type (same name).
 */

/** Directional stance an agent or signal can take. */
export const Direction = z.enum(["bullish", "bearish", "neutral"]);
export type Direction = z.infer<typeof Direction>;

/** The specialist agents. Agents are interchangeable by name. */
export const AgentName = z.enum(["technical", "sentiment", "fundamental", "polymarket"]);
export type AgentName = z.infer<typeof AgentName>;

/** Bar aggregation window used across market-data and indicator payloads. */
export const Timeframe = z.enum(["1Day", "1Hour"]);
export type Timeframe = z.infer<typeof Timeframe>;
