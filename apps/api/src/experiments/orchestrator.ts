import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import {
  ExperimentManifest,
  type BenchmarkDelta,
  type FinancialMetrics,
  type BacktestOptions,
  type BacktestResult,
  type Strategy,
  type DatasetFixture,
  type ExperimentStrategyConfig,
  type DecisionIntelligenceMetrics,
  type DecisionLineageRecord,
} from "@committee/contracts";
import { TemporalGuard } from "@committee/fixtures";
import { runBacktest } from "../backtest/simulator";
import {
  calculateDecisionIntelligenceMetrics,
  safeRound,
  type DecisionSignal,
} from "../backtest/metrics";
import { computeDatasetHash, getGitCommitHash } from "./hash";

export interface RunExperimentOptions {
  options?: BacktestOptions;
  benchmarkResult?: BacktestResult | FinancialMetrics;
  metadata?: Record<string, unknown>;
  strategyConfig?: ExperimentStrategyConfig;
  tokenCost?: number;
  latencyMs?: number;
  fallbackRate?: number;
}

/**
 * Computes metric deltas between strategy metrics and benchmark metrics.
 * Strategy - Benchmark, with precision rounding to eliminate float noise.
 */
export function calculateBenchmarkDelta(
  strategyMetrics: FinancialMetrics,
  benchmarkMetrics: FinancialMetrics,
  decisionMetrics?: DecisionIntelligenceMetrics,
): BenchmarkDelta {
  return {
    totalReturn: safeRound(strategyMetrics.totalReturn - benchmarkMetrics.totalReturn, 6),
    annualizedReturn: safeRound(
      strategyMetrics.annualizedReturn - benchmarkMetrics.annualizedReturn,
      6,
    ),
    sharpeRatio: safeRound(strategyMetrics.sharpeRatio - benchmarkMetrics.sharpeRatio, 4),
    sortinoRatio: safeRound(strategyMetrics.sortinoRatio - benchmarkMetrics.sortinoRatio, 4),
    maxDrawdown: safeRound(strategyMetrics.maxDrawdown - benchmarkMetrics.maxDrawdown, 6),
    profitFactor: safeRound(strategyMetrics.profitFactor - benchmarkMetrics.profitFactor, 4),
    winRate: safeRound(strategyMetrics.winRate - benchmarkMetrics.winRate, 4),
    tradeCount: strategyMetrics.tradeCount - benchmarkMetrics.tradeCount,
    brierScore: decisionMetrics?.brierScore ?? null,
    directionalAccuracy: decisionMetrics?.directionalAccuracy,
    abstentionQuality: decisionMetrics?.abstentionQuality,
  };
}

/**
 * Runs a strategy against a dataset fixture, validating temporal ordering,
 * computing performance metrics and benchmark deltas, and returning an immutable ExperimentManifest.
 */
export async function runExperiment(
  strategy: Strategy,
  fixture: DatasetFixture,
  options?: RunExperimentOptions,
): Promise<ExperimentManifest> {
  // Enforce zero-leakage temporal ordering across fixture bars
  if (fixture.bars.length > 0) {
    const lastBar = fixture.bars[fixture.bars.length - 1];
    if (lastBar) {
      TemporalGuard.assertNoLeakage(fixture.bars, lastBar.asOf, `runExperiment:${strategy.name}`);
    }
  }

  const backtestResult = await runBacktest(strategy, fixture.bars, options?.options);

  let decisionMetrics: DecisionIntelligenceMetrics | undefined = undefined;
  if ("getDecisions" in strategy && typeof (strategy as { getDecisions?: unknown }).getDecisions === "function") {
    const decisions = (strategy as { getDecisions: () => (DecisionSignal)[] }).getDecisions();
    decisionMetrics = calculateDecisionIntelligenceMetrics(fixture.bars, decisions);
  }

  let lineageRecords: DecisionLineageRecord[] = [];
  if ("getLineageRecords" in strategy && typeof (strategy as { getLineageRecords?: unknown }).getLineageRecords === "function") {
    lineageRecords = (strategy as { getLineageRecords: () => DecisionLineageRecord[] }).getLineageRecords();
  }

  // Attach matching simulated execution trade fill if trade occurred at decision timestamp.
  // Signals decided at bar T fill at bar T+1's OPEN (1-bar delay), so a Trade stamped
  // `bars[i].ts` belongs to the decision made at `bars[i-1].asOf` — NOT to a record
  // keyed by the same timestamp as the trade. Map fills through that offset.
  if (lineageRecords.length > 0 && backtestResult.trades.length > 0) {
    const decisionTsByFillTs = new Map<string, string>();
    for (let i = 1; i < fixture.bars.length; i += 1) {
      const fillBar = fixture.bars[i];
      const decisionBar = fixture.bars[i - 1];
      if (fillBar && decisionBar) {
        decisionTsByFillTs.set(fillBar.ts, decisionBar.asOf);
      }
    }

    const fillByDecisionTs = new Map<string, (typeof backtestResult.trades)[number]>();
    for (const trade of backtestResult.trades) {
      const decisionTs = decisionTsByFillTs.get(trade.ts) ?? trade.ts;
      if (!fillByDecisionTs.has(decisionTs)) {
        fillByDecisionTs.set(decisionTs, trade);
      }
    }

    lineageRecords = lineageRecords.map((rec) => {
      const fill = fillByDecisionTs.get(rec.decisionTs);
      return fill ? { ...rec, executionFill: fill } : rec;
    });
  }

  // Operational telemetry: strategies that track it (e.g. the multi-agent
  // coordinator) surface aggregate token cost / latency / fallback rate; explicit
  // options still win so callers can override or inject values for other strategies.
  let telemetry: { tokenCost: number; medianLatencyMs: number; fallbackRate: number } | undefined;
  if (
    "getTelemetry" in strategy &&
    typeof (strategy as { getTelemetry?: unknown }).getTelemetry === "function"
  ) {
    telemetry = (strategy as { getTelemetry: () => NonNullable<typeof telemetry> }).getTelemetry();
  }

  const datasetHash = computeDatasetHash(fixture);
  const gitCommit = getGitCommitHash();

  let benchmarkDelta: BenchmarkDelta | undefined = undefined;
  if (options?.benchmarkResult) {
    benchmarkDelta = calculateBenchmarkDelta(
      backtestResult,
      options.benchmarkResult,
      decisionMetrics,
    );
  }

  const manifestPayload: ExperimentManifest = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    gitCommit,
    datasetHash,
    symbol: fixture.symbol,
    timeframe: fixture.bars[0]?.timeframe ?? "1Day",
    strategy: strategy.name,
    strategyConfig: options?.strategyConfig
      ? {
          name: options.strategyConfig.name,
          type: options.strategyConfig.type,
          description: options.strategyConfig.description,
          parameters: options.strategyConfig.parameters ?? {},
          params: options.strategyConfig.params,
        }
      : {
          name: strategy.name,
          parameters: {},
        },
    metrics: {
      initialCash: backtestResult.initialCash,
      finalEquity: backtestResult.finalEquity,
      totalReturn: backtestResult.totalReturn,
      annualizedReturn: backtestResult.annualizedReturn,
      sharpeRatio: backtestResult.sharpeRatio,
      sortinoRatio: backtestResult.sortinoRatio,
      maxDrawdown: backtestResult.maxDrawdown,
      totalTurnover: backtestResult.totalTurnover,
      tradeCount: backtestResult.tradeCount,
      winRate: backtestResult.winRate,
      profitFactor: backtestResult.profitFactor,
    },
    benchmarkDelta,
    decisionMetrics,
    trades: backtestResult.trades,
    equityCurve: backtestResult.equityCurve,
    lineageRecords,
    tokenCost: options?.tokenCost ?? telemetry?.tokenCost ?? 0,
    latencyMs: options?.latencyMs ?? telemetry?.medianLatencyMs ?? 0,
    fallbackRate: options?.fallbackRate ?? telemetry?.fallbackRate ?? 0,
    metadata: options?.metadata,
  };

  return ExperimentManifest.parse(manifestPayload);
}

/**
 * Persists an ExperimentManifest as a formatted JSON document.
 * Returns the absolute path of the persisted manifest file.
 */
export async function persistManifest(
  manifest: ExperimentManifest,
  outputDir?: string,
): Promise<string> {
  const targetDir = outputDir ?? path.resolve(process.cwd(), ".manifests");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const fileName = `${manifest.strategy}-${manifest.id}.json`;
  const filePath = path.join(targetDir, fileName);

  const content = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(filePath, content, "utf8");

  return filePath;
}
