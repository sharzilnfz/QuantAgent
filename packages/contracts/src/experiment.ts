import { z } from "zod";
import { Timeframe } from "./enums";
import { FinancialMetrics, Trade, EquityPoint } from "./backtest";

/**
 * Strategy configuration snapshot recorded in an experiment manifest.
 */
export const ExperimentStrategyConfig = z.object({
  name: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).default({}),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type ExperimentStrategyConfig = z.infer<typeof ExperimentStrategyConfig>;

/**
 * Comparative financial metrics delta relative to the benchmark strategy (e.g. Buy & Hold).
 * Formula: strategyMetric - benchmarkMetric
 */
export const BenchmarkDelta = z.object({
  totalReturn: z.number(),
  annualizedReturn: z.number(),
  sharpeRatio: z.number(),
  sortinoRatio: z.number(),
  maxDrawdown: z.number(),
  profitFactor: z.number().optional(),
  winRate: z.number().optional(),
  tradeCount: z.number().optional(),
  brierScore: z.number().optional(),
  deltaTotalReturn: z.number().optional(),
  deltaAnnualizedReturn: z.number().optional(),
  deltaSharpeRatio: z.number().optional(),
  deltaSortinoRatio: z.number().optional(),
  deltaMaxDrawdown: z.number().optional(),
  deltaWinRate: z.number().optional(),
});
export type BenchmarkDelta = z.infer<typeof BenchmarkDelta>;

/**
 * Immutable ExperimentManifest schema for evaluation lab experiments.
 * Captures all execution context, parameters, point-in-time dataset hashes,
 * simulated trades, equity curve, and calculated financial metrics.
 */
export const ExperimentManifest = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  gitCommit: z.string(),
  datasetHash: z.string(),
  symbol: z.string().optional(),
  timeframe: Timeframe.default("1Day"),
  strategy: z.union([z.string(), ExperimentStrategyConfig]),
  strategyConfig: ExperimentStrategyConfig.optional(),
  metrics: FinancialMetrics,
  benchmarkDelta: BenchmarkDelta.optional(),
  trades: z.array(Trade),
  equityCurve: z.array(EquityPoint),
  tokenCost: z.number().default(0).optional(),
  latencyMs: z.number().default(0).optional(),
  fallbackRate: z.number().default(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ExperimentManifest = z.infer<typeof ExperimentManifest>;

/**
 * Aggregate suite result comparing multiple strategies against a benchmark.
 */
export const ExperimentSuiteResult = z.object({
  id: z.string().optional(),
  suiteId: z.string().optional(),
  symbol: z.string(),
  datasetHash: z.string(),
  gitCommit: z.string(),
  createdAt: z.string(),
  benchmark: ExperimentManifest,
  experiments: z.array(ExperimentManifest),
  totalDurationMs: z.number().optional(),
  totalCost: z.number().optional(),
  summary: z.record(z.string(), z.unknown()).optional(),
});
export type ExperimentSuiteResult = z.infer<typeof ExperimentSuiteResult>;
