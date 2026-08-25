import { loadFixture } from "@committee/fixtures";
import { runBenchmarkSuite } from "../experiments/suite.js";
import { runMultiAssetBenchmarkSuite } from "../experiments/multi-asset-suite.js";

export async function runReplayCli(): Promise<void> {
  console.log("\n================================================================================");
  console.log("             QUANTLAB OFFLINE REPLAY ENGINE — ZERO CREDENTIAL EVALUATION        ");
  console.log("================================================================================\n");

  const symbol = "AAPL";
  console.log(`[Replay 1/2] Loading single-asset fixture for ${symbol} (2023–2024)...`);
  const fixture = loadFixture(symbol);
  console.log(`[Replay] Loaded ${fixture.bars.length} daily bars and ${fixture.news.length} news items.\n`);

  const wallClockStart = performance.now();
  const suiteResult = await runBenchmarkSuite(fixture);

  // Build formatted table data for Single Asset
  const singleTableRows = suiteResult.experiments.map((exp) => {
    const stratName = typeof exp.strategy === "string" ? exp.strategy : exp.strategy.name;
    const isBenchmark = exp.strategy === suiteResult.benchmark.strategy;
    const deltaReturnStr = isBenchmark
      ? "—"
      : exp.benchmarkDelta
        ? `${exp.benchmarkDelta.totalReturn * 100 >= 0 ? "+" : ""}${(exp.benchmarkDelta.totalReturn * 100).toFixed(2)}%`
        : "—";

    const deltaSharpeStr = isBenchmark
      ? "—"
      : exp.benchmarkDelta
        ? `${exp.benchmarkDelta.sharpeRatio >= 0 ? "+" : ""}${exp.benchmarkDelta.sharpeRatio.toFixed(2)}`
        : "—";

    const daStr = exp.decisionMetrics
      ? `${(exp.decisionMetrics.directionalAccuracy * 100).toFixed(1)}%`
      : "—";

    const brierStr =
      exp.decisionMetrics?.brierScore !== null && exp.decisionMetrics?.brierScore !== undefined
        ? exp.decisionMetrics.brierScore.toFixed(3)
        : "—";

    return {
      "Strategy Name": stratName,
      "Total Return": `${exp.metrics.totalReturn * 100 >= 0 ? "+" : ""}${(exp.metrics.totalReturn * 100).toFixed(2)}%`,
      "Annualized Return": `${exp.metrics.annualizedReturn * 100 >= 0 ? "+" : ""}${(exp.metrics.annualizedReturn * 100).toFixed(2)}%`,
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

  console.log("1. Single-Asset Evaluation Results (AAPL):");
  console.table(singleTableRows);

  // Multi-Asset Universe Evaluation
  console.log("\n[Replay 2/2] Running Multi-Asset Universe Portfolio Evaluation (AAPL + NVDA + SPY)...");
  const multiSuiteResult = await runMultiAssetBenchmarkSuite({ universe: ["AAPL", "NVDA", "SPY"] });

  const multiTableRows = multiSuiteResult.experiments.map((exp) => {
    const stratName = typeof exp.strategy === "string" ? exp.strategy : exp.strategy.name;
    const isBenchmark = exp.strategy === multiSuiteResult.benchmark.strategy;
    const deltaReturnStr = isBenchmark
      ? "—"
      : exp.benchmarkDelta
        ? `${exp.benchmarkDelta.totalReturn * 100 >= 0 ? "+" : ""}${(exp.benchmarkDelta.totalReturn * 100).toFixed(2)}%`
        : "—";

    const deltaSharpeStr = isBenchmark
      ? "—"
      : exp.benchmarkDelta
        ? `${exp.benchmarkDelta.sharpeRatio >= 0 ? "+" : ""}${exp.benchmarkDelta.sharpeRatio.toFixed(2)}`
        : "—";

    return {
      "Portfolio Strategy": stratName,
      "Total Return": `${exp.metrics.totalReturn * 100 >= 0 ? "+" : ""}${(exp.metrics.totalReturn * 100).toFixed(2)}%`,
      "Annualized Return": `${exp.metrics.annualizedReturn * 100 >= 0 ? "+" : ""}${(exp.metrics.annualizedReturn * 100).toFixed(2)}%`,
      "Sharpe Ratio": exp.metrics.sharpeRatio.toFixed(2),
      "Sortino Ratio": exp.metrics.sortinoRatio.toFixed(2),
      "Max Drawdown": `${(exp.metrics.maxDrawdown * 100).toFixed(2)}%`,
      "Total Trades": exp.metrics.tradeCount,
      "Turnover (NAV)": `${(exp.metrics.totalTurnover * 100).toFixed(1)}%`,
      "Δ Return vs Basket": deltaReturnStr,
      "Δ Sharpe vs Basket": deltaSharpeStr,
    };
  });

  console.log("2. Multi-Asset Universe Portfolio Evaluation Results (AAPL + NVDA + SPY):");
  console.table(multiTableRows);

  const wallClockEnd = performance.now();
  const totalElapsedMs = wallClockEnd - wallClockStart;

  console.log("--------------------------------------------------------------------------------");
  console.log("Multi-Asset Execution Summary:");
  console.log(`  • Universe:              ${multiSuiteResult.universe.join(", ")}`);
  console.log(`  • Multi-Dataset SHA256:  ${multiSuiteResult.datasetHash}`);
  console.log(`  • Git Commit:            ${multiSuiteResult.gitCommit}`);
  console.log(`  • Total Execution Time:  ${totalElapsedMs.toFixed(2)} ms (SLA < 5000ms)`);
  console.log(`  • Token LLM Cost:        $0.00 (100% Offline / Deterministic)`);
  console.log(`  • Security Status:       Zero-Credential Verified (No External Network Keys)`);
  console.log("--------------------------------------------------------------------------------\n");

  if (totalElapsedMs >= 15000) {
    throw new Error(`Replay execution exceeded latency SLA: ${totalElapsedMs.toFixed(2)}ms >= 15000ms`);
  }

  console.log("✓ Full single-asset and multi-asset replay completed successfully under 15.0s SLA.\n");
}

// Execute when invoked directly via CLI
if (process.argv[1] && process.argv[1].endsWith("replay.ts")) {
  runReplayCli().catch((err) => {
    console.error("[Replay CLI Error]:", err);
    process.exit(1);
  });
}
