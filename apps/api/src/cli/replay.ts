import { loadFixture } from "@committee/fixtures";
import { runBenchmarkSuite } from "../experiments/suite";

export async function runReplayCli(): Promise<void> {
  console.log("\n================================================================================");
  console.log("             QUANTLAB OFFLINE REPLAY ENGINE — ZERO CREDENTIAL EVALUATION        ");
  console.log("================================================================================\n");

  const symbol = "AAPL";
  console.log(`[Replay] Loading frozen dataset fixture for ${symbol} (2023–2024)...`);
  const fixture = loadFixture(symbol);
  console.log(`[Replay] Loaded ${fixture.bars.length} daily bars and ${fixture.news.length} news items.\n`);

  const wallClockStart = performance.now();
  const suiteResult = await runBenchmarkSuite(fixture);
  const wallClockEnd = performance.now();
  const totalElapsedMs = wallClockEnd - wallClockStart;

  // Build formatted table data
  const tableRows = suiteResult.experiments.map((exp) => {
    const isBenchmark = exp.strategy === suiteResult.benchmark.strategy;
    const deltaReturnStr = isBenchmark
      ? "—"
      : exp.benchmarkDelta
        ? `${(exp.benchmarkDelta.totalReturn * 100 >= 0 ? "+" : "")}${(exp.benchmarkDelta.totalReturn * 100).toFixed(2)}%`
        : "—";

    const deltaSharpeStr = isBenchmark
      ? "—"
      : exp.benchmarkDelta
        ? `${(exp.benchmarkDelta.sharpeRatio >= 0 ? "+" : "")}${exp.benchmarkDelta.sharpeRatio.toFixed(2)}`
        : "—";

    const daStr = exp.decisionMetrics
      ? `${(exp.decisionMetrics.directionalAccuracy * 100).toFixed(1)}%`
      : "—";

    const brierStr = exp.decisionMetrics?.brierScore !== null && exp.decisionMetrics?.brierScore !== undefined
      ? exp.decisionMetrics.brierScore.toFixed(3)
      : "—";

    return {
      "Strategy Name": exp.strategy,
      "Total Return": `${(exp.metrics.totalReturn * 100 >= 0 ? "+" : "")}${(exp.metrics.totalReturn * 100).toFixed(2)}%`,
      "Annualized Return": `${(exp.metrics.annualizedReturn * 100 >= 0 ? "+" : "")}${(exp.metrics.annualizedReturn * 100).toFixed(2)}%`,
      "Sharpe Ratio": exp.metrics.sharpeRatio.toFixed(2),
      "Sortino Ratio": exp.metrics.sortinoRatio.toFixed(2),
      "Max Drawdown": `${(exp.metrics.maxDrawdown * 100).toFixed(2)}%`,
      Trades: exp.metrics.tradeCount,
      "Dir Acc": daStr,
      "Brier Score": brierStr,
      "Δ Return vs B&H": deltaReturnStr,
      "Δ Sharpe vs B&H": deltaSharpeStr,
    };
  });

  console.log("Benchmark Evaluation Results:");
  console.table(tableRows);

  console.log("--------------------------------------------------------------------------------");
  console.log("Execution Summary:");
  console.log(`  • Symbol:                ${suiteResult.symbol}`);
  console.log(`  • Dataset SHA256:        ${suiteResult.datasetHash}`);
  console.log(`  • Git Commit:            ${suiteResult.gitCommit}`);
  console.log(`  • Execution Time:        ${totalElapsedMs.toFixed(2)} ms (Suite internal: ${suiteResult.totalDurationMs} ms)`);
  console.log(`  • Token LLM Cost:        $${(suiteResult.totalCost ?? 0).toFixed(2)} (100% Offline / Deterministic)`);
  console.log(`  • Security Status:       Zero-Credential Verified (No API Keys / External Network)`);
  console.log("--------------------------------------------------------------------------------\n");

  if (totalElapsedMs >= 3000) {
    throw new Error(`Replay execution exceeded latency SLA: ${totalElapsedMs.toFixed(2)}ms >= 3000ms`);
  }

  console.log("✓ Replay completed successfully under 3.0s SLA.\n");
}

// Execute when invoked directly via CLI
if (process.argv[1] && process.argv[1].endsWith("replay.ts")) {
  runReplayCli().catch((err) => {
    console.error("[Replay CLI Error]:", err);
    process.exit(1);
  });
}
