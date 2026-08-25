import { z } from "zod";

/**
 * Position breakdown in an End-of-Day report.
 */
export const EodPositionSummary = z.object({
  symbol: z.string(),
  qty: z.number(),
  marketValue: z.number(),
  unrealizedPl: z.number().optional(),
  dayChangePct: z.number().optional(),
});
export type EodPositionSummary = z.infer<typeof EodPositionSummary>;

/**
 * End-of-Day report record schema.
 */
export const EodReportRecord = z.object({
  id: z.string().uuid(),
  asOf: z.string().datetime(),
  createdAt: z.string().datetime(),
  portfolioEquity: z.number(),
  cash: z.number(),
  dayChange: z.number(),
  dayChangePercent: z.number(),
  benchmarkSymbol: z.string().default("SPY"),
  benchmarkReturnPercent: z.number().default(0),
  executedTradesCount: z.number().int().nonnegative().default(0),
  topPositions: z.array(EodPositionSummary).default([]),
  dispatchedTelegram: z.boolean().default(false),
});
export type EodReportRecord = z.infer<typeof EodReportRecord>;

/**
 * Cron scheduler status response schema.
 */
export const CronStatusResponse = z.object({
  active: z.boolean(),
  cronSchedule: z.string(),
  nextRun: z.string().datetime().optional(),
  lastRunAt: z.string().datetime().optional(),
  lastRunStatus: z.enum(["ok", "failed", "idle"]).default("idle"),
});
export type CronStatusResponse = z.infer<typeof CronStatusResponse>;
