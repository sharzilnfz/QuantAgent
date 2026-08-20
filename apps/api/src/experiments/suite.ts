import * as crypto from "node:crypto";
import {
  ExperimentSuiteResult,
  type BacktestOptions,
  type DatasetFixture,
  type Strategy,
  type ExperimentManifest,
} from "@committee/contracts";
import { BuyAndHoldStrategy } from "../backtest/strategies/buy-and-hold";
import { SmaRsiStrategy } from "../backtest/strategies/sma-rsi";
import { MultiAgentCoordinatorStrategy } from "../agents/coordinator/strategy";
import { safeRound } from "../backtest/metrics";
import { computeDatasetHash, getGitCommitHash } from "./hash";
import { runExperiment } from "./orchestrator";

export interface BenchmarkSuiteOptions {
  backtestOptions?: BacktestOptions;
  customStrategies?: Strategy[];
}

/**
 * Runs a standard evaluation suite across deterministic baselines and custom strategies on a frozen dataset.
 * Executes Buy & Hold as the benchmark baseline, calculates comparative deltas for SMA/RSI and all
 * additional strategies, and returns a validated ExperimentSuiteResult.
 */
export async function runBenchmarkSuite(
  fixture: DatasetFixture,
  options?: BenchmarkSuiteOptions,
): Promise<ExperimentSuiteResult> {
  const startTime = performance.now();

  const datasetHash = computeDatasetHash(fixture);
  const gitCommit = getGitCommitHash();

  // 1. Run Buy & Hold Baseline Benchmark
  const buyAndHoldStrategy = new BuyAndHoldStrategy();
  const benchmarkManifest = await runExperiment(buyAndHoldStrategy, fixture, {
    options: options?.backtestOptions,
    strategyConfig: {
      name: buyAndHoldStrategy.name,
      type: "baseline",
      description: "Passive 100% long buy-and-hold benchmark",
      parameters: {},
    },
  });

  const benchmarkResult = benchmarkManifest.metrics;

  // Run all evaluated strategies concurrently
  const [smaRsiManifest, debateOnManifest, debateOffManifest, polymarketManifest, ...customManifests] =
    await Promise.all([
      // 2. SMA(20/50) + RSI(14) Baseline Strategy
      (async () => {
        const smaRsiStrategy = new SmaRsiStrategy();
        return runExperiment(smaRsiStrategy, fixture, {
          options: options?.backtestOptions,
          benchmarkResult,
          strategyConfig: {
            name: smaRsiStrategy.name,
            type: "baseline",
            description:
              "Deterministic SMA(20/50) trend filter + Wilder RSI(14) oversold/overbought baseline",
            parameters: {},
          },
        });
      })(),

      // 3. Multi-Agent Debate ON Strategy
      (async () => {
        const debateOnStrategy = new MultiAgentCoordinatorStrategy({
          name: "multi-agent-debate-on",
          debateEnabled: true,
          deterministicOffline: true,
          news: fixture.news,
          fundamentals: fixture.fundamentals,
          logger: () => {},
        });
        return runExperiment(debateOnStrategy, fixture, {
          options: options?.backtestOptions,
          benchmarkResult,
          strategyConfig: {
            name: debateOnStrategy.name,
            type: "multi-agent",
            description:
              "Multi-agent committee with conditional debate synthesis on specialist disagreement",
            parameters: { debateEnabled: true },
          },
        });
      })(),

      // 4. Multi-Agent Debate OFF (Ablation) Strategy
      (async () => {
        const debateOffStrategy = new MultiAgentCoordinatorStrategy({
          name: "multi-agent-debate-off",
          debateEnabled: false,
          deterministicOffline: true,
          news: fixture.news,
          fundamentals: fixture.fundamentals,
          logger: () => {},
        });
        return runExperiment(debateOffStrategy, fixture, {
          options: options?.backtestOptions,
          benchmarkResult,
          strategyConfig: {
            name: debateOffStrategy.name,
            type: "multi-agent-ablation",
            description:
              "Multi-agent committee with neutral ablation fallback on specialist disagreement",
            parameters: { debateEnabled: false },
          },
        });
      })(),

      // 5. Multi-Agent + Polymarket Macro Specialist Strategy
      (async () => {
        const polymarketStrategy = new MultiAgentCoordinatorStrategy({
          name: "multi-agent-polymarket",
          debateEnabled: true,
          deterministicOffline: true,
          includePolymarket: true,
          news: fixture.news,
          fundamentals: fixture.fundamentals,
          predictionMarkets: fixture.predictionMarkets,
          logger: () => {},
        });
        return runExperiment(polymarketStrategy, fixture, {
          options: options?.backtestOptions,
          benchmarkResult,
          strategyConfig: {
            name: polymarketStrategy.name,
            type: "multi-agent-macro",
            description:
              "Multi-agent committee with Polymarket crowdsourced macro prediction probability curves",
            parameters: { includePolymarket: true, debateEnabled: true },
          },
        });
      })(),

      // Custom strategies
      ...(options?.customStrategies ?? []).map(async (customStrategy) =>
        runExperiment(customStrategy, fixture, {
          options: options?.backtestOptions,
          benchmarkResult,
          strategyConfig: {
            name: customStrategy.name,
            type: "custom",
            parameters: {},
          },
        }),
      ),
    ]);

  const experimentManifests: ExperimentManifest[] = [
    benchmarkManifest,
    smaRsiManifest!,
    debateOnManifest!,
    debateOffManifest!,
    polymarketManifest!,
    ...customManifests,
  ];

  const elapsedMs = performance.now() - startTime;
  const totalCost = experimentManifests.reduce((acc, exp) => acc + (exp.tokenCost ?? 0), 0);

  const suiteId = crypto.randomUUID();
  const suiteResultPayload: ExperimentSuiteResult = {
    id: suiteId,
    suiteId,
    symbol: fixture.symbol,
    datasetHash,
    gitCommit,
    createdAt: new Date().toISOString(),
    benchmark: benchmarkManifest,
    experiments: experimentManifests,
    totalDurationMs: safeRound(elapsedMs, 2),
    totalCost: safeRound(totalCost, 4),
  };

  return ExperimentSuiteResult.parse(suiteResultPayload);
}
