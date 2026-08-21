import { z } from "zod";
import { AgentOutput } from "./agents.js";
import { ConsensusResult } from "./debate.js";
import { IndicatorSnapshot, PriceBar } from "./signals.js";

/**
 * Radar item for an individual asset symbol on the Live Signals monitor.
 * Contains latest point-in-time OHLCV bar, mathematical indicator status,
 * specialist agent signal outputs, and the coordinator consensus outcome.
 */
export const LiveSignalRadarItem = z.object({
  symbol: z.string(),
  currentBar: PriceBar,
  recentBars: z.array(PriceBar),
  indicators: IndicatorSnapshot,
  rsiZone: z.enum(["oversold", "neutral", "overbought"]),
  macdCross: z.enum(["bullish", "bearish", "neutral"]),
  trend: z.enum(["bullish", "bearish", "ranging"]),
  specialistVotes: z.record(z.string(), AgentOutput),
  consensus: ConsensusResult,
  newsHeadline: z.string().optional(),
  asOf: z.string().datetime(),
});
export type LiveSignalRadarItem = z.infer<typeof LiveSignalRadarItem>;

/**
 * Response payload for `GET /signals/radar`.
 */
export const LiveSignalRadarResponse = z.object({
  asOf: z.string().datetime(),
  items: z.array(LiveSignalRadarItem),
});
export type LiveSignalRadarResponse = z.infer<typeof LiveSignalRadarResponse>;
