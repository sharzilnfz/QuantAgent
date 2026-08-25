/**
 * Experiment Tearsheet Comparison Matrix.
 *
 * Impeccable Operate Mode:
 *  - High data density, monospaced tabular numerals, crisp borders
 *  - Side-by-side comparison across all evaluated strategies & deterministic baselines
 *  - Direct visual deltas (Δ Total Return, Δ Sharpe, Δ Sortino, Δ MaxDD, Δ Brier) vs Buy & Hold
 *  - Telemetry: Trade Count, Win Rate, Directional Accuracy, Brier Score, Token Cost, Latency
 */
import type { ExperimentManifest, ExperimentSuiteResult } from "@committee/contracts";
import type { StrategyOption } from "./ObservatoryControls";
import {
  formatBrier,
  formatMoney,
  formatPercent,
  formatRatio,
  formatSignedPercent,
  formatSignedRatio,
} from "../../lib/format";
import { cn } from "../../lib/cn";

interface ExperimentTearsheetProps {
  suite: ExperimentSuiteResult;
  strategies: StrategyOption[];
  visibleStrategyIds: Set<string>;
  onToggleStrategy: (id: string) => void;
  onInspectManifest?: (manifest: ExperimentManifest) => void;
}

export function ExperimentTearsheet({
  suite,
  strategies,
  visibleStrategyIds,
  onToggleStrategy,
  onInspectManifest,
}: ExperimentTearsheetProps) {
  const benchmarkId =
    typeof suite.benchmark.strategy === "string"
      ? suite.benchmark.strategy
      : suite.benchmark.strategy.name;

  // Ordered list of manifests (benchmark first, then others)
  const manifests: ExperimentManifest[] = [
    suite.benchmark,
    ...suite.experiments.filter((e) => {
      const id = typeof e.strategy === "string" ? e.strategy : e.strategy.name;
      return id !== benchmarkId;
    }),
  ];

  return (
    <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">
            Strategy Performance & Evaluation Tearsheet
          </h3>
          <p className="text-xs text-ink-3">
            Deterministic baseline benchmark comparisons with point-in-time decision intelligence & operational telemetry
          </p>
        </div>
        <div className="text-[11px] font-mono text-ink-3">
          Symbol: <span className="font-semibold text-ink">{suite.symbol}</span> | Total Evaluated: {manifests.length}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-hairline">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-surface-well text-ink-2">
            <tr className="border-b border-hairline">
              <th scope="col" className="px-3 py-2.5 font-medium min-w-44">
                Strategy Variant
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium min-w-28">
                Total Return (Δ)
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium min-w-28">
                Annualized (Δ)
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium min-w-24">
                Sharpe (Δ)
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium min-w-24">
                Sortino (Δ)
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium min-w-24">
                Max Drawdown
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium min-w-20">
                Win Rate
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium min-w-24">
                Dir. Accuracy
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium min-w-24">
                Brier Score
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium min-w-24">
                Cost & Latency
              </th>
              <th scope="col" className="px-3 py-2.5 text-center font-medium min-w-24">
                Lineage
              </th>
            </tr>
          </thead>
          <tbody>
            {manifests.map((exp) => {
              const id = typeof exp.strategy === "string" ? exp.strategy : exp.strategy.name;
              const isBenchmark = id === benchmarkId;
              const strategyMeta = strategies.find((s) => s.id === id);
              const isVisible = visibleStrategyIds.has(id);
              const delta = exp.benchmarkDelta;

              return (
                <tr
                  key={id}
                  className={cn(
                    "border-t border-hairline transition-colors duration-150",
                    isVisible ? "hover:bg-surface-well/50" : "opacity-45 bg-surface-well/20",
                  )}
                >
                  {/* Strategy Name & Toggle */}
                  <td className="px-3 py-3 font-sans">
                    <button
                      type="button"
                      onClick={() => onToggleStrategy(id)}
                      className="flex items-center gap-2 text-left group"
                      title={isVisible ? "Hide from overlay" : "Show on overlay"}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-surface"
                        style={{ backgroundColor: strategyMeta?.color ?? "#898781" }}
                        aria-hidden="true"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-ink group-hover:underline">
                            {strategyMeta?.name ?? id}
                          </span>
                          {isBenchmark ? (
                            <span className="rounded bg-ink/10 px-1 py-0.2 text-[9px] font-semibold uppercase tracking-wide text-ink-2">
                              Baseline Benchmark
                            </span>
                          ) : null}
                        </div>
                        {exp.strategyConfig?.description ? (
                          <p className="line-clamp-1 text-[11px] text-ink-3">
                            {exp.strategyConfig.description}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </td>

                  {/* Total Return & Delta */}
                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="font-semibold text-ink">
                      {formatPercent(exp.metrics.totalReturn)}
                    </div>
                    {isBenchmark ? (
                      <span className="text-[10px] text-ink-3">benchmark</span>
                    ) : delta ? (
                      <DeltaBadge
                        value={delta.deltaTotalReturn ?? delta.totalReturn}
                        formatter={formatSignedPercent}
                      />
                    ) : (
                      <span className="text-[10px] text-ink-3">—</span>
                    )}
                  </td>

                  {/* Annualized Return & Delta */}
                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="text-ink">
                      {formatPercent(exp.metrics.annualizedReturn)}
                    </div>
                    {isBenchmark ? (
                      <span className="text-[10px] text-ink-3">benchmark</span>
                    ) : delta ? (
                      <DeltaBadge
                        value={delta.deltaAnnualizedReturn ?? delta.annualizedReturn}
                        formatter={formatSignedPercent}
                      />
                    ) : (
                      <span className="text-[10px] text-ink-3">—</span>
                    )}
                  </td>

                  {/* Sharpe Ratio & Delta */}
                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="text-ink font-medium">
                      {formatRatio(exp.metrics.sharpeRatio)}
                    </div>
                    {isBenchmark ? (
                      <span className="text-[10px] text-ink-3">benchmark</span>
                    ) : delta ? (
                      <DeltaBadge
                        value={delta.deltaSharpeRatio ?? delta.sharpeRatio}
                        formatter={formatSignedRatio}
                      />
                    ) : (
                      <span className="text-[10px] text-ink-3">—</span>
                    )}
                  </td>

                  {/* Sortino Ratio & Delta */}
                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="text-ink font-medium">
                      {formatRatio(exp.metrics.sortinoRatio)}
                    </div>
                    {isBenchmark ? (
                      <span className="text-[10px] text-ink-3">benchmark</span>
                    ) : delta ? (
                      <DeltaBadge
                        value={delta.deltaSortinoRatio ?? delta.sortinoRatio}
                        formatter={formatSignedRatio}
                      />
                    ) : (
                      <span className="text-[10px] text-ink-3">—</span>
                    )}
                  </td>

                  {/* Max Drawdown */}
                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="text-delta-neg font-medium">
                      -{formatPercent(exp.metrics.maxDrawdown)}
                    </div>
                    {isBenchmark ? (
                      <span className="text-[10px] text-ink-3">benchmark</span>
                    ) : delta ? (
                      <span
                        className={cn(
                          "text-[10px]",
                          (delta.deltaMaxDrawdown ?? delta.maxDrawdown) <= 0
                            ? "text-delta-pos"
                            : "text-delta-neg",
                        )}
                      >
                        {formatSignedPercent(delta.deltaMaxDrawdown ?? delta.maxDrawdown)} Δ
                      </span>
                    ) : null}
                  </td>

                  {/* Win Rate & Trades */}
                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="text-ink">{formatPercent(exp.metrics.winRate)}</div>
                    <span className="text-[10px] text-ink-3">{exp.metrics.tradeCount} trades</span>
                  </td>

                  {/* Directional Accuracy */}
                  <td className="px-3 py-3 text-right tabular-nums">
                    {exp.decisionMetrics ? (
                      <>
                        <div className="text-ink font-medium">
                          {formatPercent(exp.decisionMetrics.directionalAccuracy)}
                        </div>
                        <span className="text-[10px] text-ink-3">
                          {exp.decisionMetrics.activeBarCount} act / {exp.decisionMetrics.neutralBarCount} neut
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>

                  {/* Brier Score */}
                  <td className="px-3 py-3 text-right tabular-nums">
                    {exp.decisionMetrics?.brierScore !== null && exp.decisionMetrics?.brierScore !== undefined ? (
                      <>
                        <div className="text-ink font-medium">
                          {formatBrier(exp.decisionMetrics.brierScore)}
                        </div>
                        <span className="text-[10px] text-ink-3">MSE stance</span>
                      </>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>

                  {/* Cost & Latency */}
                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="text-ink">
                      ${(exp.tokenCost ?? 0).toFixed(2)}
                    </div>
                    <span className="text-[10px] text-ink-3">
                      {exp.latencyMs ?? 0}ms
                      {exp.fallbackRate ? ` (${(exp.fallbackRate * 100).toFixed(0)}% fb)` : ""}
                    </span>
                  </td>

                  {/* Audit Lineage */}
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onInspectManifest?.(exp)}
                      className="rounded border border-hairline bg-surface-well px-2 py-1 text-[11px] font-sans font-medium text-ink-2 hover:bg-surface hover:text-ink transition-colors shadow-xs"
                    >
                      Audit Lineage
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeltaBadge({
  value,
  formatter,
}: {
  value: number;
  formatter: (n: number) => string;
}) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-medium",
        isPositive ? "text-delta-pos" : "text-delta-neg",
      )}
    >
      {formatter(value)}
    </span>
  );
}
