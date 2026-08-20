import * as crypto from "node:crypto";
import {
  type DatasetFixture,
  type ExperimentManifest,
  type VarianceMetricStats,
  type VarianceEquityPoint,
  VarianceSweepResult,
  type BacktestOptions,
  type PriceBar,
} from "@committee/contracts";
import { MultiAgentCoordinatorStrategy } from "../agents/coordinator/strategy.js";
import { runExperiment } from "./orchestrator.js";
import { BudgetGuard } from "./budget.js";
import { safeRound } from "../backtest/metrics.js";

export interface VarianceSweepOptions {
  /** Number of independent stochastic runs. Defaults to 3. */
  runsCount?: number;
  /** Number of decision points in the validation window. Defaults to 25 (range 20–30). */
  windowSize?: number;
  /** Hard spend cap ceiling in USD. Defaults to $5.00. */
  budgetLimit?: number;
  /** Backtest simulation parameters. */
  backtestOptions?: BacktestOptions;
  /** Deterministic offline mode for tests ($0.00 cost). Defaults to true. */
  deterministicOffline?: boolean;
}

/**
 * Calculate statistical distribution (mean, sample standard deviation, sample variance, min, max)
 * across an array of numeric samples.
 */
export function calculateMetricStats(values: number[]): VarianceMetricStats {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, variance: 0, min: 0, max: 0 };
  }

  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  let variance = 0;
  if (n > 1) {
    const sumSqDiff = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
    variance = sumSqDiff / (n - 1);
  }

  const stdDev = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    mean: safeRound(mean, 4),
    stdDev: safeRound(stdDev, 4),
    variance: safeRound(variance, 6),
    min: safeRound(min, 4),
    max: safeRound(max, 4),
  };
}

/**
 * Run a budget-capped variance sweep across N runs on a focused validation window.
 */
export async function runVarianceSweep(
  fixture: DatasetFixture,
  options?: VarianceSweepOptions,
): Promise<VarianceSweepResult> {
  const runsCount = options?.runsCount ?? 3;
  const windowSize = Math.min(Math.max(options?.windowSize ?? 25, 10), fixture.bars.length);
  const budgetLimit = options?.budgetLimit ?? 5.0;
  const deterministicOffline = options?.deterministicOffline ?? true;

  const budgetGuard = new BudgetGuard({ maxBudgetUsd: budgetLimit });

  // 1. Extract focused validation window (last windowSize bars)
  const windowBars: PriceBar[] = fixture.bars.slice(-windowSize);
  const windowStartTs = windowBars[0]!.asOf;

  // Filter news & prediction markets to window
  const windowNews = fixture.news.filter((n) => (n.publishedAt ?? n.asOf) >= windowStartTs);
  const windowPredictionMarkets = fixture.predictionMarkets;
  const windowFundamentals = fixture.fundamentals;

  const windowFixture: DatasetFixture = {
    symbol: fixture.symbol,
    bars: windowBars,
    news: windowNews,
    predictionMarkets: windowPredictionMarkets,
    fundamentals: windowFundamentals,
  };

  const runs: ExperimentManifest[] = [];

  // 2. Execute N runs with budget guard verification
  for (let i = 0; i < runsCount; i++) {
    // Assert budget before launching iteration
    budgetGuard.assertBudget(0.01);

    const strategy = new MultiAgentCoordinatorStrategy({
      name: `variance-sweep-run-${i + 1}`,
      debateEnabled: true,
      deterministicOffline,
      includePolymarket: true,
      news: windowFixture.news,
      fundamentals: windowFixture.fundamentals,
      predictionMarkets: windowFixture.predictionMarkets,
      logger: () => {},
    });

    const manifest = await runExperiment(strategy, windowFixture, {
      options: options?.backtestOptions,
      strategyConfig: {
        name: strategy.name,
        type: "variance-sweep",
        description: `Variance sweep run ${i + 1} of ${runsCount}`,
        parameters: { runIndex: i, runsCount, windowSize },
      },
    });

    const cost = manifest.tokenCost ?? (deterministicOffline ? 0 : 0.05);
    budgetGuard.recordSpend(cost);

    runs.push(manifest);
  }

  // 3. Compute statistical metric distributions across all runs
  const extractMetric = (fn: (m: ExperimentManifest) => number | undefined): number[] => {
    return runs.map(fn).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  };

  const metricStats: Record<string, VarianceMetricStats> = {
    totalReturn: calculateMetricStats(extractMetric((r) => r.metrics.totalReturn)),
    annualizedReturn: calculateMetricStats(extractMetric((r) => r.metrics.annualizedReturn)),
    sharpeRatio: calculateMetricStats(extractMetric((r) => r.metrics.sharpeRatio)),
    sortinoRatio: calculateMetricStats(extractMetric((r) => r.metrics.sortinoRatio)),
    maxDrawdown: calculateMetricStats(extractMetric((r) => r.metrics.maxDrawdown)),
    winRate: calculateMetricStats(extractMetric((r) => r.metrics.winRate)),
    directionalAccuracy: calculateMetricStats(extractMetric((r) => r.decisionMetrics?.directionalAccuracy)),
    brierScore: calculateMetricStats(extractMetric((r) => r.decisionMetrics?.brierScore ?? undefined)),
    abstentionQuality: calculateMetricStats(extractMetric((r) => r.decisionMetrics?.abstentionQuality)),
    tokenCost: calculateMetricStats(extractMetric((r) => r.tokenCost)),
    latencyMs: calculateMetricStats(extractMetric((r) => r.latencyMs)),
  };

  // 4. Compute point-in-time equity variance bands: [mean - 1*sigma, mean + 1*sigma]
  const equityPointsByTs = new Map<string, number[]>();

  for (const run of runs) {
    for (const pt of run.equityCurve) {
      const ts = pt.ts ?? (pt as { asOf?: string }).asOf ?? "";
      if (!equityPointsByTs.has(ts)) {
        equityPointsByTs.set(ts, []);
      }
      equityPointsByTs.get(ts)!.push(pt.equity);
    }
  }

  const equityBands: VarianceEquityPoint[] = [];

  for (const [asOf, equities] of equityPointsByTs.entries()) {
    const stats = calculateMetricStats(equities);
    const mean = safeRound(stats.mean, 2);
    const stdDev = safeRound(stats.stdDev, 2);
    equityBands.push({
      asOf,
      meanEquity: mean,
      stdDev,
      upperBand: safeRound(mean + stdDev, 2),
      lowerBand: safeRound(mean - stdDev, 2),
      minEquity: stats.min,
      maxEquity: stats.max,
    });
  }

  // Sort equity bands chronologically
  equityBands.sort((a, b) => new Date(a.asOf).getTime() - new Date(b.asOf).getTime());

  const budgetSnapshot = budgetGuard.getSnapshot();

  const sweepPayload: VarianceSweepResult = {
    id: crypto.randomUUID(),
    symbol: fixture.symbol,
    createdAt: new Date().toISOString(),
    runsCount,
    windowSize,
    totalCost: budgetSnapshot.cumulativeCostUsd,
    budgetLimit,
    budgetExceeded: budgetSnapshot.budgetExceeded,
    runs,
    metricStats,
    equityBands,
  };

  return VarianceSweepResult.parse(sweepPayload);
}
