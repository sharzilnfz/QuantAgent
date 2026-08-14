import { z } from "zod";
import { ExperimentManifest } from "./experiment";

/**
 * Aggregated statistical distribution (mean, stdDev, sample variance, min, max) for a metric across runs.
 */
export const VarianceMetricStats = z.object({
  mean: z.number(),
  stdDev: z.number().nonnegative(),
  variance: z.number().nonnegative(),
  min: z.number(),
  max: z.number(),
});
export type VarianceMetricStats = z.infer<typeof VarianceMetricStats>;

/**
 * Point-in-time equity variance band point with mean equity and standard deviation interval.
 */
export const VarianceEquityPoint = z.object({
  asOf: z.string(),
  meanEquity: z.number(),
  stdDev: z.number().nonnegative(),
  upperBand: z.number(), // mean + 1 stdDev
  lowerBand: z.number(), // mean - 1 stdDev
  minEquity: z.number().optional(),
  maxEquity: z.number().optional(),
});
export type VarianceEquityPoint = z.infer<typeof VarianceEquityPoint>;

/**
 * Validated result of a live/offline variance sweep across N runs on a validation window.
 */
export const VarianceSweepResult = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  createdAt: z.string().datetime(),
  runsCount: z.number().int().positive(),
  windowSize: z.number().int().positive(),
  totalCost: z.number().nonnegative(),
  budgetLimit: z.number().positive(),
  budgetExceeded: z.boolean(),
  runs: z.array(ExperimentManifest),
  metricStats: z.record(z.string(), VarianceMetricStats),
  equityBands: z.array(VarianceEquityPoint),
});
export type VarianceSweepResult = z.infer<typeof VarianceSweepResult>;
