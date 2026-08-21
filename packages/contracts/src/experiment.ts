import { z } from "zod";
import { Timeframe } from "./enums";
import { FinancialMetrics, Trade, EquityPoint, MultiAssetTrade, MultiAssetEquityPoint } from "./backtest";
import { DecisionLineageRecord } from "./lineage";

/**
 * Decision intelligence & calibration metrics evaluating LLM reasoning quality.
 */
export const DecisionIntelligenceMetrics = z.object({
  directionalAccuracy: z.number().min(0).max(1), // % of active trades where market moved in predicted direction
  brierScore: z.number().min(0).nullable(), // Calibration mean squared error (MSE) across active probabilistic stances
  abstentionQuality: z.number(), // Abstention Hit Rate: % of neutral bars avoiding <= 0 return
  abstentionAlpha: z.number().optional(), // Comparative Return Spread: mean(R_active) - mean(R_neutral)
  activeBarCount: z.number().int().nonnegative(),
  neutralBarCount: z.number().int().nonnegative(),
});
export type DecisionIntelligenceMetrics = z.infer<typeof DecisionIntelligenceMetrics>;

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
  brierScore: z.number().nullable().optional(),
  directionalAccuracy: z.number().optional(),
  abstentionQuality: z.number().optional(),
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
 * simulated trades, equity curve, calculated financial metrics, and decision telemetry.
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
  decisionMetrics: DecisionIntelligenceMetrics.optional(),
  trades: z.array(Trade),
  equityCurve: z.array(EquityPoint),
  lineageRecords: z.array(DecisionLineageRecord).default([]).optional(),
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

/**
 * Manifest for multi-asset universe portfolio experiments.
 */
export const MultiAssetExperimentManifest = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  gitCommit: z.string(),
  datasetHash: z.string(),
  symbols: z.array(z.string()),
  timeframe: Timeframe.default("1Day"),
  strategy: z.union([z.string(), ExperimentStrategyConfig]),
  strategyConfig: ExperimentStrategyConfig.optional(),
  metrics: FinancialMetrics,
  benchmarkDelta: BenchmarkDelta.optional(),
  decisionMetrics: DecisionIntelligenceMetrics.optional(),
  trades: z.array(MultiAssetTrade),
  equityCurve: z.array(MultiAssetEquityPoint),
  perAssetTurnover: z.record(z.string(), z.number()).default({}),
  perAssetTradeCount: z.record(z.string(), z.number()).default({}),
  tokenCost: z.number().default(0).optional(),
  latencyMs: z.number().default(0).optional(),
  fallbackRate: z.number().default(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type MultiAssetExperimentManifest = z.infer<typeof MultiAssetExperimentManifest>;

/**
 * Suite result evaluating multiple strategies across a multi-asset universe against an Equal-Weight Basket benchmark.
 */
export const MultiAssetSuiteResult = z.object({
  id: z.string().optional(),
  suiteId: z.string().optional(),
  universe: z.array(z.string()),
  datasetHash: z.string(),
  gitCommit: z.string(),
  createdAt: z.string(),
  benchmark: MultiAssetExperimentManifest,
  experiments: z.array(MultiAssetExperimentManifest),
  totalDurationMs: z.number().optional(),
  totalCost: z.number().optional(),
  summary: z.record(z.string(), z.unknown()).optional(),
});
export type MultiAssetSuiteResult = z.infer<typeof MultiAssetSuiteResult>;

