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
import { runBacktest } from "../backtest/simulator";
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
  const benchmarkBacktestResult = await runBacktest(
    buyAndHoldStrategy,
    fixture.bars,
    options?.backtestOptions,
  );

  const benchmarkManifest = await runExperiment(buyAndHoldStrategy, fixture, {
    options: options?.backtestOptions,
    strategyConfig: {
      name: buyAndHoldStrategy.name,
      type: "baseline",
      description: "Passive 100% long buy-and-hold benchmark",
      parameters: {},
    },
  });

  // 2. Run SMA(20/50) + RSI(14) Baseline Strategy
  const smaRsiStrategy = new SmaRsiStrategy();
  const smaRsiManifest = await runExperiment(smaRsiStrategy, fixture, {
    options: options?.backtestOptions,
    benchmarkResult: benchmarkBacktestResult,
    strategyConfig: {
      name: smaRsiStrategy.name,
      type: "baseline",
      description: "Deterministic SMA(20/50) trend filter + Wilder RSI(14) oversold/overbought baseline",
      parameters: {},
    },
  });

  const experimentManifests: ExperimentManifest[] = [benchmarkManifest, smaRsiManifest];

  // 3. Run any additional custom strategies
  if (options?.customStrategies && options.customStrategies.length > 0) {
    for (const customStrategy of options.customStrategies) {
      const manifest = await runExperiment(customStrategy, fixture, {
        options: options?.backtestOptions,
        benchmarkResult: benchmarkBacktestResult,
        strategyConfig: {
          name: customStrategy.name,
          type: "custom",
          parameters: {},
        },
      });
      experimentManifests.push(manifest);
    }
  }

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
