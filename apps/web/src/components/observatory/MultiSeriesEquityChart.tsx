/**
 * Multi-Series Equity Curves and Drawdown Chart for the Observatory.
 *
 * Impeccable Operate Mode & Dataviz Discipline:
 *  1. FORM: Comparative time series. Allows researchers to track alpha generation,
 *     drawdown divergence, and flatlining during market shifts.
 *  2. COLOR & STROKES: High-contrast categorical series tokens. Benchmark uses a distinct
 *     dashed hairline so it's readable even in monochrome / grayscale.
 *  3. HOVER & SYNCHRONIZATION: Crosshair snaps to date; tooltip displays sorted equities
 *     with computed alpha spreads against Buy & Hold.
 *  4. ACCESSIBILITY & WCAG: Ships an interactive "View as table" twin so values are never
 *     locked behind hover interactions.
 */
import { useState, useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExperimentManifest, VarianceEquityPoint } from "@committee/contracts";
import type { StrategyOption } from "./ObservatoryControls";
import { formatDate, formatDayShort, formatMoney, formatMoneyCompact, formatSignedMoney } from "../../lib/format";
import { cn } from "../../lib/cn";

const PLOT_HEIGHT = 360;

interface MultiSeriesEquityChartProps {
  experiments: ExperimentManifest[];
  benchmark: ExperimentManifest;
  strategies: StrategyOption[];
  visibleStrategyIds: Set<string>;
  varianceBands?: VarianceEquityPoint[];
  isVarianceSweepActive?: boolean;
  onInspectPoint?: (ts: string) => void;
}

interface MergedPoint {
  asOf: string;
  upperBand?: number;
  lowerBand?: number;
  meanEquity?: number;
  [key: string]: string | number | undefined;
}

export function MultiSeriesEquityChart({
  experiments,
  benchmark,
  strategies,
  visibleStrategyIds,
  varianceBands,
  isVarianceSweepActive = false,
  onInspectPoint,
}: MultiSeriesEquityChartProps) {
  const [chartMode, setChartMode] = useState<"equity" | "drawdown">("equity");

  const benchmarkId = typeof benchmark.strategy === "string" ? benchmark.strategy : benchmark.strategy.name;

  // Build merged time-series table indexed by date
  const chartData = useMemo(() => {
    const pointMap = new Map<string, MergedPoint>();

    // Strategy manifests to plot
    const allManifests = [
      benchmark,
      ...experiments.filter((e) => {
        const id = typeof e.strategy === "string" ? e.strategy : e.strategy.name;
        return id !== benchmarkId;
      }),
    ];

    for (const exp of allManifests) {
      const id = typeof exp.strategy === "string" ? exp.strategy : exp.strategy.name;
      if (!visibleStrategyIds.has(id)) continue;

      let peak = 0;
      for (const pt of exp.equityCurve) {
        const pointTs = pt.ts ?? (pt as { asOf?: string }).asOf ?? "";
        let entry = pointMap.get(pointTs);
        if (!entry) {
          entry = { asOf: pointTs };
          pointMap.set(pointTs, entry);
        }

        if (chartMode === "equity") {
          entry[id] = pt.equity;
        } else {
          // Drawdown mode: use pt.drawdown or calculate from peak
          if (typeof pt.drawdown === "number") {
            entry[id] = Number((-Math.abs(pt.drawdown * 100)).toFixed(2));
          } else {
            if (pt.equity > peak) peak = pt.equity;
            const dd = peak > 0 ? ((pt.equity - peak) / peak) * 100 : 0;
            entry[id] = Number((-Math.abs(dd)).toFixed(2));
          }
        }
      }
    }

    // Merge variance bands if active and in equity mode
    if (isVarianceSweepActive && varianceBands && varianceBands.length > 0 && chartMode === "equity") {
      for (const band of varianceBands) {
        let entry = pointMap.get(band.asOf);
        if (!entry) {
          entry = { asOf: band.asOf };
          pointMap.set(band.asOf, entry);
        }
        entry.meanEquity = band.meanEquity;
        entry.upperBand = band.upperBand;
        entry.lowerBand = band.lowerBand;
      }
    }

    // Sort chronologically
    return Array.from(pointMap.values()).sort(
      (a, b) => new Date(a.asOf).getTime() - new Date(b.asOf).getTime(),
    );
  }, [experiments, benchmark, benchmarkId, visibleStrategyIds, chartMode, isVarianceSweepActive, varianceBands]);

  const activeStrategies = strategies.filter((s) => visibleStrategyIds.has(s.id));

  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const range =
    first && last && chartData.length > 1
      ? `${formatDate(first.asOf)} – ${formatDate(last.asOf)}`
      : undefined;

  return (
    <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5">
      {/* Chart Header & Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">
            {chartMode === "equity"
              ? isVarianceSweepActive
                ? "Live Evaluation Variance Sweep ($N=3$, ±1σ Bands)"
                : "Comparative Equity Trajectory ($ USD)"
              : "Underwater Drawdown Profile (%)"}
          </h3>
          <p className="text-xs text-ink-3">
            {chartMode === "equity"
              ? isVarianceSweepActive
                ? "Distribution of live committee trajectories with shaded confidence intervals alongside deterministic baseline overlays"
                : "Time-series growth across active LLM agent configurations vs deterministic baselines"
              : "Peak-to-trough historical drawdowns across evaluated strategies"}
          </p>
        </div>

        <div className="flex items-center rounded-lg border border-hairline bg-surface-well p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setChartMode("equity")}
            className={cn(
              "rounded-md px-3 py-1 transition-colors duration-150",
              chartMode === "equity" ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink",
            )}
          >
            Equity Curve
          </button>
          <button
            type="button"
            onClick={() => setChartMode("drawdown")}
            className={cn(
              "rounded-md px-3 py-1 transition-colors duration-150",
              chartMode === "drawdown" ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink",
            )}
          >
            Drawdown (%)
          </button>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div style={{ height: PLOT_HEIGHT }} aria-hidden="true" className="mt-4">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-3 font-mono">
            No active strategies selected for overlay.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
              onClick={(state) => {
                if (state?.activeLabel && onInspectPoint) {
                  onInspectPoint(String(state.activeLabel));
                }
              }}
            >
              <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="asOf"
                tickFormatter={formatDayShort}
                tickLine={false}
                axisLine={{ stroke: "var(--axis)" }}
                tick={{ fill: "var(--ink-3)", fontSize: 11 }}
                minTickGap={32}
                padding={{ left: 10, right: 10 }}
              />
              <YAxis
                tickFormatter={chartMode === "equity" ? formatMoneyCompact : (v) => `${v}%`}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--ink-3)", fontSize: 11 }}
                width={64}
                domain={chartMode === "equity" ? ["auto", "auto"] : ["auto", 0]}
              />
              <Tooltip
                content={
                  <CustomTooltip
                    benchmarkId={benchmarkId}
                    strategies={strategies}
                    chartMode={chartMode}
                    isVarianceSweepActive={isVarianceSweepActive}
                  />
                }
                cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
                iconType="plainline"
              />

              {/* Shaded variance band when active */}
              {isVarianceSweepActive && chartMode === "equity" && (
                <Area
                  type="monotone"
                  dataKey="upperBand"
                  name="Variance Band (±1σ)"
                  stroke="none"
                  fill="var(--variance-band)"
                  fillOpacity={1}
                  isAnimationActive={false}
                />
              )}

              {/* Mean curve for variance sweep */}
              {isVarianceSweepActive && chartMode === "equity" && (
                <Line
                  type="monotone"
                  dataKey="meanEquity"
                  name="Committee Mean (Live)"
                  stroke="var(--series-polymarket)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "var(--series-polymarket)",
                    stroke: "var(--surface-1)",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              )}

              {activeStrategies.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={s.isBenchmark ? 1.75 : 2.25}
                  strokeDasharray={s.isBenchmark ? "4 4" : undefined}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: s.color,
                    stroke: "var(--surface-1)",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* WCAG Accessible Table-View Twin */}
      <details className="mt-4 group">
        <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-2 transition-colors duration-150 hover:text-ink">
          <Chevron />
          View comparison dataset as table
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-hairline">
          <table className="w-full text-left text-xs font-mono">
            <caption className="sr-only">
              Comparative strategy evaluation over time{range ? `, ${range}` : ""}
            </caption>
            <thead className="sticky top-0 bg-surface-well text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Date
                </th>
                {activeStrategies.map((s) => (
                  <th key={s.id} scope="col" className="px-3 py-2 text-right font-medium">
                    {s.name} {chartMode === "equity" ? "($)" : "(%)"}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-center font-medium">
                  Audit
                </th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((pt) => (
                <tr key={pt.asOf} className="border-t border-hairline hover:bg-surface-well/50">
                  <td className="px-3 py-1.5 text-ink-2 font-sans">{formatDate(pt.asOf)}</td>
                  {activeStrategies.map((s) => {
                    const val = pt[s.id];
                    return (
                      <td key={s.id} className="px-3 py-1.5 text-right tabular-nums text-ink">
                        {typeof val === "number"
                          ? chartMode === "equity"
                            ? formatMoney(val)
                            : `${val.toFixed(2)}%`
                          : "—"}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => onInspectPoint?.(pt.asOf)}
                      className="rounded border border-hairline bg-surface px-1.5 py-0.5 text-[10px] font-sans font-medium text-ink-2 hover:text-ink transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

interface TooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: MergedPoint;
}

function CustomTooltip({
  active,
  payload,
  benchmarkId,
  strategies,
  chartMode,
  isVarianceSweepActive,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  benchmarkId: string;
  strategies: StrategyOption[];
  chartMode: "equity" | "drawdown";
  isVarianceSweepActive?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const firstEntry = payload[0]?.payload;
  if (!firstEntry) return null;

  const dateStr = formatDate(firstEntry.asOf);
  const benchVal = typeof firstEntry[benchmarkId] === "number" ? Number(firstEntry[benchmarkId]) : undefined;
  const upper = firstEntry.upperBand;
  const lower = firstEntry.lowerBand;
  const mean = firstEntry.meanEquity;

  return (
    <div className="min-w-56 rounded-lg border border-hairline bg-surface p-3 shadow-md">
      <div className="flex items-center justify-between border-b border-hairline pb-1.5">
        <p className="text-xs font-semibold text-ink">{dateStr}</p>
        {isVarianceSweepActive && typeof mean === "number" && (
          <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-teal-600 dark:text-teal-400">
            Live N=3 Sweep
          </span>
        )}
      </div>

      {isVarianceSweepActive && typeof upper === "number" && typeof lower === "number" && (
        <div className="mt-2 rounded bg-surface-well p-1.5 font-mono text-[11px] text-ink-2 space-y-0.5">
          <div className="flex justify-between">
            <span>Mean (μ):</span>
            <span className="font-semibold text-ink">{formatMoney(mean ?? 0)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-ink-3">
            <span>±1σ Interval:</span>
            <span>[{formatMoney(lower)} – {formatMoney(upper)}]</span>
          </div>
        </div>
      )}

      <div className="mt-2 space-y-1.5 font-mono text-xs">
        {payload.map((item) => {
          const key = item.dataKey as string;
          const strategyMeta = strategies.find((s) => s.id === key);
          const val = item.value;
          if (val === undefined || typeof val !== "number") return null;

          const deltaVsBench =
            chartMode === "equity" && benchVal !== undefined && key !== benchmarkId
              ? val - benchVal
              : undefined;

          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-ink-2">{strategyMeta?.name ?? key}</span>
              </div>
              <div className="flex items-center gap-1.5 text-right font-medium">
                <span className="text-ink">
                  {chartMode === "equity" ? formatMoney(val) : `${val.toFixed(2)}%`}
                </span>
                {deltaVsBench !== undefined ? (
                  <span
                    className={cn(
                      "text-[10px] tabular-nums",
                      deltaVsBench >= 0 ? "text-delta-pos" : "text-delta-neg",
                    )}
                  >
                    ({formatSignedMoney(deltaVsBench)})
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 transition-transform duration-150 ease-out group-open:rotate-90"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
