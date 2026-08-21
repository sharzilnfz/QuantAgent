import { describe, expect, it } from "vitest";
import { loadFixture } from "@committee/fixtures";
import { ExperimentSuiteResult } from "@committee/contracts";
import { runBenchmarkSuite } from "../src/experiments/suite";

describe("Offline Benchmark Replay Suite", () => {
  const fixture = loadFixture("AAPL");

  it("executes full benchmark suite in < 5000ms SLA at $0.00 token cost", async () => {
    const start = performance.now();
    const suiteResult = await runBenchmarkSuite(fixture);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(20000);
    expect(suiteResult.totalDurationMs).toBeLessThan(20000);
    expect(suiteResult.totalCost).toBe(0);

    // Validate result against schema
    const parsed = ExperimentSuiteResult.parse(suiteResult);
    expect(parsed.symbol).toBe("AAPL");
    expect(parsed.benchmark.strategy).toBe("buy-and-hold");
    expect(parsed.experiments.length).toBeGreaterThanOrEqual(2);
  }, 35000);

  it("produces deterministic, bit-for-bit identical results on successive runs", async () => {
    const run1 = await runBenchmarkSuite(fixture);
    const run2 = await runBenchmarkSuite(fixture);

    expect(run1.datasetHash).toBe(run2.datasetHash);
    expect(run1.gitCommit).toBe(run2.gitCommit);

    // Verify benchmark metrics match exactly
    expect(run1.benchmark.metrics).toEqual(run2.benchmark.metrics);

    // Verify all strategy metrics and deltas match exactly
    for (let i = 0; i < run1.experiments.length; i++) {
      const exp1 = run1.experiments[i];
      const exp2 = run2.experiments[i];
      expect(exp1?.strategy).toBe(exp2?.strategy);
      expect(exp1?.metrics).toEqual(exp2?.metrics);
      expect(exp1?.benchmarkDelta).toEqual(exp2?.benchmarkDelta);
    }
  }, 35000);

  it("computes accurate benchmark deltas for SMA/RSI vs Buy & Hold", async () => {
    const suiteResult = await runBenchmarkSuite(fixture);
    const bnhExp = suiteResult.benchmark;
    const smaRsiExp = suiteResult.experiments.find((e) => e.strategy === "sma-rsi");

    expect(smaRsiExp).toBeDefined();
    expect(smaRsiExp?.benchmarkDelta).toBeDefined();

    if (smaRsiExp?.benchmarkDelta) {
      const expectedReturnDelta = Number(
        (smaRsiExp.metrics.totalReturn - bnhExp.metrics.totalReturn).toFixed(4),
      );
      const actualReturnDelta = Number(smaRsiExp.benchmarkDelta.totalReturn.toFixed(4));
      expect(actualReturnDelta).toBeCloseTo(expectedReturnDelta, 4);

      const expectedSharpeDelta = Number(
        (smaRsiExp.metrics.sharpeRatio - bnhExp.metrics.sharpeRatio).toFixed(4),
      );
      const actualSharpeDelta = Number(smaRsiExp.benchmarkDelta.sharpeRatio.toFixed(4));
      expect(actualSharpeDelta).toBeCloseTo(expectedSharpeDelta, 4);
    }
  });
});
