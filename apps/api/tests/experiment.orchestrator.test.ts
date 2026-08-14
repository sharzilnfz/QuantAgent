import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { describe, expect, it } from "vitest";
import { loadFixture } from "@committee/fixtures";
import { ExperimentManifest, type FinancialMetrics } from "@committee/contracts";
import { BuyAndHoldStrategy } from "../src/backtest/strategies/buy-and-hold";
import { SmaRsiStrategy } from "../src/backtest/strategies/sma-rsi";
import { runBacktest } from "../src/backtest/simulator";
import {
  calculateBenchmarkDelta,
  persistManifest,
  runExperiment,
} from "../src/experiments/orchestrator";
import { computeDatasetHash, getGitCommitHash } from "../src/experiments/hash";

describe("Experiment Orchestrator", () => {
  const fixture = loadFixture("AAPL");

  it("computes deterministic dataset hash for fixture", () => {
    const hash1 = computeDatasetHash(fixture);
    const hash2 = computeDatasetHash(fixture);
    expect(hash1).toBeDefined();
    expect(hash1.length).toBe(64);
    expect(hash1).toBe(hash2);
  });

  it("retrieves git commit hash or safe fallback", () => {
    const commit = getGitCommitHash();
    expect(commit).toBeDefined();
    expect(typeof commit).toBe("string");
    expect(commit.length).toBeGreaterThan(0);
  });

  it("calculates accurate benchmark deltas", () => {
    const strategyMetrics: FinancialMetrics = {
      initialCash: 100000,
      finalEquity: 125000,
      totalReturn: 0.25,
      annualizedReturn: 0.25,
      sharpeRatio: 1.85,
      sortinoRatio: 2.15,
      maxDrawdown: -0.08,
      totalTurnover: 4.0,
      tradeCount: 10,
      winRate: 0.6,
      profitFactor: 2.0,
    };

    const benchmarkMetrics: FinancialMetrics = {
      initialCash: 100000,
      finalEquity: 110000,
      totalReturn: 0.10,
      annualizedReturn: 0.10,
      sharpeRatio: 1.10,
      sortinoRatio: 1.30,
      maxDrawdown: -0.15,
      totalTurnover: 1.0,
      tradeCount: 1,
      winRate: 1.0,
      profitFactor: 0,
    };

    const delta = calculateBenchmarkDelta(strategyMetrics, benchmarkMetrics);
    expect(delta.totalReturn).toBe(0.15);
    expect(delta.annualizedReturn).toBe(0.15);
    expect(delta.sharpeRatio).toBe(0.75);
    expect(delta.sortinoRatio).toBe(0.85);
    expect(delta.maxDrawdown).toBe(0.07);
    expect(delta.tradeCount).toBe(9);
    expect(delta.winRate).toBe(-0.4);
    expect(delta.profitFactor).toBe(2.0);
  });

  it("runs experiment for BuyAndHoldStrategy and generates valid manifest", async () => {
    const strategy = new BuyAndHoldStrategy();
    const manifest = await runExperiment(strategy, fixture);

    expect(manifest.id).toBeDefined();
    expect(manifest.strategy).toBe("buy-and-hold");
    expect(manifest.symbol).toBe("AAPL");
    expect(manifest.datasetHash).toBe(computeDatasetHash(fixture));
    expect(manifest.gitCommit).toBeDefined();
    expect(manifest.metrics.initialCash).toBe(100000);
    expect(manifest.metrics.finalEquity).toBeGreaterThan(0);
    expect(manifest.equityCurve.length).toBe(fixture.bars.length);
    expect(manifest.trades.length).toBeGreaterThan(0);

    // Verify it parses cleanly with schema
    const parsed = ExperimentManifest.parse(manifest);
    expect(parsed.id).toBe(manifest.id);
  });

  it("runs experiment for SmaRsiStrategy with benchmark delta", async () => {
    const buyAndHold = new BuyAndHoldStrategy();
    const bnhResult = await runBacktest(buyAndHold, fixture.bars);

    const smaRsi = new SmaRsiStrategy();
    const manifest = await runExperiment(smaRsi, fixture, {
      benchmarkResult: bnhResult,
      strategyConfig: {
        name: "sma-rsi",
        type: "baseline",
        parameters: { rsiOverbought: 70 },
        params: { rsiOverbought: 70 },
      },
    });

    expect(manifest.strategy).toBe("sma-rsi");
    expect(manifest.benchmarkDelta).toBeDefined();
    if (manifest.benchmarkDelta) {
      expect(typeof manifest.benchmarkDelta.totalReturn).toBe("number");
      expect(typeof manifest.benchmarkDelta.sharpeRatio).toBe("number");
      expect(typeof manifest.benchmarkDelta.maxDrawdown).toBe("number");
    }

    const parsed = ExperimentManifest.parse(manifest);
    expect(parsed.strategyConfig?.name).toBe("sma-rsi");
  });

  it("persists manifest to disk as valid JSON matching ExperimentManifest schema", async () => {
    const strategy = new BuyAndHoldStrategy();
    const manifest = await runExperiment(strategy, fixture);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-test-"));
    try {
      const savedPath = await persistManifest(manifest, tmpDir);
      expect(fs.existsSync(savedPath)).toBe(true);

      const raw = fs.readFileSync(savedPath, "utf8");
      const loadedJson = JSON.parse(raw);
      const parsed = ExperimentManifest.parse(loadedJson);
      expect(parsed.id).toBe(manifest.id);
      expect(parsed.datasetHash).toBe(manifest.datasetHash);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
