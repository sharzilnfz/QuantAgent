import { z } from "zod";
import { IndicatorSnapshot, PriceBar } from "./signals";
import { ConsensusResult } from "./debate";
import { RiskAssessment } from "./risk";
import { OrderResult } from "./execution";

/**
 * Real-time streaming market data and indicator tick message.
 */
export const MarketStreamMessage = z.object({
  type: z.enum(["bar", "quote", "indicator", "heartbeat"]),
  symbol: z.string(),
  price: z.number(),
  volume: z.number().default(0),
  bar: PriceBar.optional(),
  indicators: IndicatorSnapshot.optional(),
  timestamp: z.string(),
});
export type MarketStreamMessage = z.infer<typeof MarketStreamMessage>;

/**
 * Autonomous background trading daemon lifecycle state.
 */
export const DaemonState = z.enum(["idle", "running", "paused", "error"]);
export type DaemonState = z.infer<typeof DaemonState>;

/**
 * Configuration options for the autonomous trading daemon.
 */
export const DaemonConfig = z.object({
  enabled: z.boolean().default(false),
  intervalSeconds: z.number().int().positive().default(60),
  symbols: z.array(z.string()).default(["AAPL", "NVDA", "SPY"]),
  dryRun: z.boolean().default(true),
  autoExecute: z.boolean().default(false),
  debateEnabled: z.boolean().default(true),
  minConfidence: z.number().min(0).max(1).default(0.6),
});
export type DaemonConfig = z.infer<typeof DaemonConfig>;

/**
 * Execution report for a single daemon trading cycle.
 */
export const DaemonCycleResult = z.object({
  id: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number(),
  symbolsEvaluated: z.array(z.string()),
  results: z.array(
    z.object({
      symbol: z.string(),
      decisionTs: z.string(),
      consensus: ConsensusResult,
      riskAssessment: RiskAssessment,
      orderResult: OrderResult.optional(),
      actionTaken: z.enum(["executed", "dry_run_recorded", "rejected_by_risk", "neutral_abstain", "error"]),
      error: z.string().optional(),
    }),
  ),
});
export type DaemonCycleResult = z.infer<typeof DaemonCycleResult>;

/**
 * Live status payload of the autonomous trading daemon.
 */
export const DaemonStatus = z.object({
  state: DaemonState,
  uptimeSeconds: z.number(),
  lastCycleAt: z.string().nullable(),
  nextCycleAt: z.string().nullable(),
  totalCycles: z.number(),
  successfulCycles: z.number(),
  failedCycles: z.number(),
  config: DaemonConfig,
  lastCycleResult: DaemonCycleResult.optional(),
});
export type DaemonStatus = z.infer<typeof DaemonStatus>;
