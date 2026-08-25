import * as crypto from "node:crypto";
import {
  type BacktestOptions,
  type DatasetFixture,
  type FundamentalReport,
  type MultiAssetStrategy,
  type MultiAssetExperimentManifest,
  type BenchmarkDelta,
  MultiAssetSuiteResult,
} from "@committee/contracts";
import { loadFixture } from "@committee/fixtures";
import { runMultiAssetBacktest } from "../backtest/multi-asset-simulator.js";
import { MultiAssetBuyAndHoldStrategy } from "../backtest/strategies/multi-asset-buy-and-hold.js";
import { MultiAssetSmaRsiStrategy } from "../backtest/strategies/multi-asset-sma-rsi.js";
import { MultiAssetCoordinatorStrategy } from "../agents/coordinator/multi-asset-strategy.js";
import { safeRound } from "../backtest/metrics.js";
import { computeDatasetHash, getGitCommitHash } from "./hash.js";

export interface MultiAssetSuiteOptions {
  universe?: string[];
  backtestOptions?: BacktestOptions;
  customStrategies?: MultiAssetStrategy[];
}

export function computeMultiAssetDatasetHash(fixtures: Record<string, DatasetFixture>): string {
  const sortedSymbols = Object.keys(fixtures).sort();
  const hashes = sortedSymbols.map((sym) => computeDatasetHash(fixtures[sym]!));
  return crypto.createHash("sha256").update(hashes.join("|")).digest("hex");
}

function computeBenchmarkDelta(
  metrics: MultiAssetExperimentManifest["metrics"],
  benchmark: MultiAssetExperimentManifest["metrics"],
): BenchmarkDelta {
  const deltaTotalReturn = safeRound(metrics.totalReturn - benchmark.totalReturn, 4);
  const deltaAnnualizedReturn = safeRound(metrics.annualizedReturn - benchmark.annualizedReturn, 4);
  const deltaSharpeRatio = safeRound(metrics.sharpeRatio - benchmark.sharpeRatio, 4);
  const deltaSortinoRatio = safeRound(metrics.sortinoRatio - benchmark.sortinoRatio, 4);
  const deltaMaxDrawdown = safeRound(metrics.maxDrawdown - benchmark.maxDrawdown, 4);
  const deltaWinRate = safeRound(metrics.winRate - benchmark.winRate, 4);

  return {
    totalReturn: deltaTotalReturn,
    annualizedReturn: deltaAnnualizedReturn,
    sharpeRatio: deltaSharpeRatio,
    sortinoRatio: deltaSortinoRatio,
    maxDrawdown: deltaMaxDrawdown,
    winRate: deltaWinRate,
    deltaTotalReturn,
    deltaAnnualizedReturn,
    deltaSharpeRatio,
    deltaSortinoRatio,
    deltaMaxDrawdown,
    deltaWinRate,
  };
}

/**
 * Runs a multi-asset universe evaluation suite across deterministic baselines and multi-agent strategies.
 * Benchmarked against a 1/N Equal-Weight Buy & Hold Basket.
 */
export async function runMultiAssetBenchmarkSuite(
  options?: MultiAssetSuiteOptions,
): Promise<MultiAssetSuiteResult> {
  const startTime = performance.now();
  const symbols = options?.universe ?? ["AAPL", "NVDA", "SPY"];
  const gitCommit = getGitCommitHash();

  // Load fixtures for universe
  const fixturesBySymbol: Record<string, DatasetFixture> = {};
  const universeBars: Record<string, DatasetFixture["bars"]> = {};
  const newsBySymbol: Record<string, DatasetFixture["news"]> = {};
  const fundamentalsBySymbol: Record<string, FundamentalReport[]> = {};
  let predictionMarkets: DatasetFixture["predictionMarkets"] = [];

  for (const sym of symbols) {
    const fixture = loadFixture(sym);
    fixturesBySymbol[sym] = fixture;
    universeBars[sym] = fixture.bars;
    newsBySymbol[sym] = fixture.news;
    fundamentalsBySymbol[sym] = fixture.fundamentals ?? [];
    if (fixture.predictionMarkets && fixture.predictionMarkets.length > 0) {
      predictionMarkets = [...predictionMarkets, ...fixture.predictionMarkets];
    }
  }

  const datasetHash = computeMultiAssetDatasetHash(fixturesBySymbol);

  // 1. Run Benchmark: Multi-Asset Equal-Weight Buy & Hold Basket
  const benchmarkStrategy = new MultiAssetBuyAndHoldStrategy();
  const benchmarkBacktest = await runMultiAssetBacktest({
    strategy: benchmarkStrategy,
    universeBars,
    options: options?.backtestOptions,
  });

  const benchmarkManifest: MultiAssetExperimentManifest = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    gitCommit,
    datasetHash,
    symbols,
    timeframe: "1Day",
    strategy: {
      name: benchmarkStrategy.name,
      type: "benchmark",
      description: "1/N Equal-Weight Buy & Hold Universe Basket",
      parameters: {},
    },
    strategyConfig: {
      name: benchmarkStrategy.name,
      type: "benchmark",
      description: "1/N Equal-Weight Buy & Hold Universe Basket",
      parameters: {},
    },
    metrics: {
      initialCash: benchmarkBacktest.initialCash,
      finalEquity: benchmarkBacktest.finalEquity,
      totalReturn: benchmarkBacktest.totalReturn,
      annualizedReturn: benchmarkBacktest.annualizedReturn,
      sharpeRatio: benchmarkBacktest.sharpeRatio,
      sortinoRatio: benchmarkBacktest.sortinoRatio,
      maxDrawdown: benchmarkBacktest.maxDrawdown,
      totalTurnover: benchmarkBacktest.totalTurnover,
      tradeCount: benchmarkBacktest.tradeCount,
      winRate: benchmarkBacktest.winRate,
      profitFactor: benchmarkBacktest.profitFactor,
    },
    trades: benchmarkBacktest.trades,
    equityCurve: benchmarkBacktest.equityCurve,
    perAssetTurnover: benchmarkBacktest.perAssetTurnover,
    perAssetTradeCount: benchmarkBacktest.perAssetTradeCount,
    tokenCost: 0,
    latencyMs: 0,
    fallbackRate: 0,
  };

  // 2. Evaluated Strategies in Universe
  const [smaRsiManifest, debateOnManifest, debateOffManifest, polymarketManifest, ...customManifests] =
    await Promise.all([
      // A. Multi-Asset SMA/RSI Baseline
      (async (): Promise<MultiAssetExperimentManifest> => {
        const smaStrategy = new MultiAssetSmaRsiStrategy();
        const res = await runMultiAssetBacktest({
          strategy: smaStrategy,
          universeBars,
          options: options?.backtestOptions,
        });

        const delta = computeBenchmarkDelta(res, benchmarkManifest.metrics);

        return {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          gitCommit,
          datasetHash,
          symbols,
          timeframe: "1Day",
          strategy: {
            name: smaStrategy.name,
            type: "baseline",
            description: "Multi-Asset independent SMA(20/50) + RSI(14) rule-based strategy",
            parameters: {},
          },
          strategyConfig: {
            name: smaStrategy.name,
            type: "baseline",
            description: "Multi-Asset independent SMA(20/50) + RSI(14) rule-based strategy",
            parameters: {},
          },
          metrics: {
            initialCash: res.initialCash,
            finalEquity: res.finalEquity,
            totalReturn: res.totalReturn,
            annualizedReturn: res.annualizedReturn,
            sharpeRatio: res.sharpeRatio,
            sortinoRatio: res.sortinoRatio,
            maxDrawdown: res.maxDrawdown,
            totalTurnover: res.totalTurnover,
            tradeCount: res.tradeCount,
            winRate: res.winRate,
            profitFactor: res.profitFactor,
          },
          benchmarkDelta: delta,
          trades: res.trades,
          equityCurve: res.equityCurve,
          perAssetTurnover: res.perAssetTurnover,
          perAssetTradeCount: res.perAssetTradeCount,
          tokenCost: 0,
          latencyMs: 0,
          fallbackRate: 0,
        };
      })(),

      // B. Multi-Asset Coordinator (Debate ON)
      (async (): Promise<MultiAssetExperimentManifest> => {
        const debateOnStrat = new MultiAssetCoordinatorStrategy({
          name: "multi-asset-debate-on",
          debateEnabled: true,
          deterministicOffline: true,
          newsBySymbol,
          fundamentalsBySymbol,
          sizingMethod: "conviction_weighted",
          logger: () => {},
        });

        const res = await runMultiAssetBacktest({
          strategy: debateOnStrat,
          universeBars,
          options: options?.backtestOptions,
        });

        const telemetry = debateOnStrat.getTelemetry();
        const delta = computeBenchmarkDelta(res, benchmarkManifest.metrics);

        return {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          gitCommit,
          datasetHash,
          symbols,
          timeframe: "1Day",
          strategy: {
            name: debateOnStrat.name,
            type: "multi-agent",
            description: "Multi-Asset Committee with conditional debate synthesis & conviction-weighted allocation",
            parameters: { debateEnabled: true, sizingMethod: "conviction_weighted" },
          },
          strategyConfig: {
            name: debateOnStrat.name,
            type: "multi-agent",
            description: "Multi-Asset Committee with conditional debate synthesis & conviction-weighted allocation",
            parameters: { debateEnabled: true, sizingMethod: "conviction_weighted" },
          },
          metrics: {
            initialCash: res.initialCash,
            finalEquity: res.finalEquity,
            totalReturn: res.totalReturn,
            annualizedReturn: res.annualizedReturn,
            sharpeRatio: res.sharpeRatio,
            sortinoRatio: res.sortinoRatio,
            maxDrawdown: res.maxDrawdown,
            totalTurnover: res.totalTurnover,
            tradeCount: res.tradeCount,
            winRate: res.winRate,
            profitFactor: res.profitFactor,
          },
          benchmarkDelta: delta,
          trades: res.trades,
          equityCurve: res.equityCurve,
          perAssetTurnover: res.perAssetTurnover,
          perAssetTradeCount: res.perAssetTradeCount,
          tokenCost: telemetry.tokenCost,
          latencyMs: telemetry.medianLatencyMs,
          fallbackRate: telemetry.fallbackRate,
        };
      })(),

      // C. Multi-Asset Coordinator (Debate OFF / Ablation)
      (async (): Promise<MultiAssetExperimentManifest> => {
        const debateOffStrat = new MultiAssetCoordinatorStrategy({
          name: "multi-asset-debate-off",
          debateEnabled: false,
          deterministicOffline: true,
          newsBySymbol,
          fundamentalsBySymbol,
          sizingMethod: "conviction_weighted",
          logger: () => {},
        });

        const res = await runMultiAssetBacktest({
          strategy: debateOffStrat,
          universeBars,
          options: options?.backtestOptions,
        });

        const telemetry = debateOffStrat.getTelemetry();
        const delta = computeBenchmarkDelta(res, benchmarkManifest.metrics);

        return {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          gitCommit,
          datasetHash,
          symbols,
          timeframe: "1Day",
          strategy: {
            name: debateOffStrat.name,
            type: "multi-agent-ablation",
            description: "Multi-Asset Committee with neutral fallback ablation on specialist disagreement",
            parameters: { debateEnabled: false, sizingMethod: "conviction_weighted" },
          },
          strategyConfig: {
            name: debateOffStrat.name,
            type: "multi-agent-ablation",
            description: "Multi-Asset Committee with neutral fallback ablation on specialist disagreement",
            parameters: { debateEnabled: false, sizingMethod: "conviction_weighted" },
          },
          metrics: {
            initialCash: res.initialCash,
            finalEquity: res.finalEquity,
            totalReturn: res.totalReturn,
            annualizedReturn: res.annualizedReturn,
            sharpeRatio: res.sharpeRatio,
            sortinoRatio: res.sortinoRatio,
            maxDrawdown: res.maxDrawdown,
            totalTurnover: res.totalTurnover,
            tradeCount: res.tradeCount,
            winRate: res.winRate,
            profitFactor: res.profitFactor,
          },
          benchmarkDelta: delta,
          trades: res.trades,
          equityCurve: res.equityCurve,
          perAssetTurnover: res.perAssetTurnover,
          perAssetTradeCount: res.perAssetTradeCount,
          tokenCost: telemetry.tokenCost,
          latencyMs: telemetry.medianLatencyMs,
          fallbackRate: telemetry.fallbackRate,
        };
      })(),

      // D. Multi-Asset Coordinator + Polymarket Macro Odds
      (async (): Promise<MultiAssetExperimentManifest> => {
        const polyStrat = new MultiAssetCoordinatorStrategy({
          name: "multi-asset-polymarket",
          debateEnabled: true,
          deterministicOffline: true,
          includePolymarket: true,
          newsBySymbol,
          fundamentalsBySymbol,
          predictionMarkets,
          sizingMethod: "conviction_weighted",
          logger: () => {},
        });

        const res = await runMultiAssetBacktest({
          strategy: polyStrat,
          universeBars,
          options: options?.backtestOptions,
        });

        const telemetry = polyStrat.getTelemetry();
        const delta = computeBenchmarkDelta(res, benchmarkManifest.metrics);

        return {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          gitCommit,
          datasetHash,
          symbols,
          timeframe: "1Day",
          strategy: {
            name: polyStrat.name,
            type: "multi-agent-macro",
            description: "Multi-Asset Committee with Polymarket macro prediction probability curves",
            parameters: { includePolymarket: true, debateEnabled: true },
          },
          strategyConfig: {
            name: polyStrat.name,
            type: "multi-agent-macro",
            description: "Multi-Asset Committee with Polymarket macro prediction probability curves",
            parameters: { includePolymarket: true, debateEnabled: true },
          },
          metrics: {
            initialCash: res.initialCash,
            finalEquity: res.finalEquity,
            totalReturn: res.totalReturn,
            annualizedReturn: res.annualizedReturn,
            sharpeRatio: res.sharpeRatio,
            sortinoRatio: res.sortinoRatio,
            maxDrawdown: res.maxDrawdown,
            totalTurnover: res.totalTurnover,
            tradeCount: res.tradeCount,
            winRate: res.winRate,
            profitFactor: res.profitFactor,
          },
          benchmarkDelta: delta,
          trades: res.trades,
          equityCurve: res.equityCurve,
          perAssetTurnover: res.perAssetTurnover,
          perAssetTradeCount: res.perAssetTradeCount,
          tokenCost: telemetry.tokenCost,
          latencyMs: telemetry.medianLatencyMs,
          fallbackRate: telemetry.fallbackRate,
        };
      })(),

      // Custom strategies
      ...(options?.customStrategies ?? []).map(async (strat) => {
        const res = await runMultiAssetBacktest({
          strategy: strat,
          universeBars,
          options: options?.backtestOptions,
        });
        const delta = computeBenchmarkDelta(res, benchmarkManifest.metrics);
        return {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          gitCommit,
          datasetHash,
          symbols,
          timeframe: "1Day" as const,
          strategy: {
            name: strat.name,
            type: "custom",
            parameters: {},
          },
          strategyConfig: {
            name: strat.name,
            type: "custom",
            parameters: {},
          },
          metrics: {
            initialCash: res.initialCash,
            finalEquity: res.finalEquity,
            totalReturn: res.totalReturn,
            annualizedReturn: res.annualizedReturn,
            sharpeRatio: res.sharpeRatio,
            sortinoRatio: res.sortinoRatio,
            maxDrawdown: res.maxDrawdown,
            totalTurnover: res.totalTurnover,
            tradeCount: res.tradeCount,
            winRate: res.winRate,
            profitFactor: res.profitFactor,
          },
          benchmarkDelta: delta,
          trades: res.trades,
          equityCurve: res.equityCurve,
          perAssetTurnover: res.perAssetTurnover,
          perAssetTradeCount: res.perAssetTradeCount,
          tokenCost: 0,
          latencyMs: 0,
          fallbackRate: 0,
        };
      }),
    ]);

  const experiments: MultiAssetExperimentManifest[] = [
    benchmarkManifest,
    smaRsiManifest!,
    debateOnManifest!,
    debateOffManifest!,
    polymarketManifest!,
    ...customManifests,
  ];

  const elapsedMs = performance.now() - startTime;
  const totalCost = experiments.reduce((acc, exp) => acc + (exp.tokenCost ?? 0), 0);
  const suiteId = crypto.randomUUID();

  const suiteResult: MultiAssetSuiteResult = {
    id: suiteId,
    suiteId,
    universe: symbols,
    datasetHash,
    gitCommit,
    createdAt: new Date().toISOString(),
    benchmark: benchmarkManifest,
    experiments,
    totalDurationMs: safeRound(elapsedMs, 2),
    totalCost: safeRound(totalCost, 4),
  };

  return MultiAssetSuiteResult.parse(suiteResult);
}
