/**
 * Controls and Telemetry HUD bar for Observatory evaluation.
 *
 * Impeccable Operate Mode:
 *  - High data density and crisp hairline borders
 *  - Active strategy selection with clear series color swatches
 *  - Ablation comparison presets for quick side-by-side toggling
 *  - System telemetry badges: dataset SHA256, git commit, token cost, execution time
 */
import type { ExperimentSuiteResult } from "@committee/contracts";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

export interface StrategyOption {
  id: string;
  name: string;
  type: string;
  color: string;
  isBenchmark: boolean;
}

interface ObservatoryControlsProps {
  suite: ExperimentSuiteResult;
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  availableSymbols: string[];
  strategies: StrategyOption[];
  visibleStrategyIds: Set<string>;
  onToggleStrategy: (id: string) => void;
  onSetVisibleStrategies: (ids: Set<string>) => void;
  isVarianceSweepActive?: boolean;
  onToggleVarianceSweep?: () => void;
  varianceCost?: number;
  /** True only when the sweep actually spent LLM budget (totalCost > 0). */
  varianceSweepLive?: boolean;
  onOpenInspector?: () => void;
}

export function ObservatoryControls({
  suite,
  selectedSymbol,
  onSelectSymbol,
  availableSymbols,
  strategies,
  visibleStrategyIds,
  onToggleStrategy,
  onSetVisibleStrategies,
  isVarianceSweepActive = false,
  onToggleVarianceSweep,
  varianceCost = 0,
  varianceSweepLive = false,
  onOpenInspector,
}: ObservatoryControlsProps) {
  const selectAll = () => {
    onSetVisibleStrategies(new Set(strategies.map((s) => s.id)));
  };

  const selectMacroAblation = () => {
    const macroIds = strategies
      .filter((s) => s.isBenchmark || s.id.includes("debate") || s.id.includes("polymarket"))
      .map((s) => s.id);
    onSetVisibleStrategies(new Set(macroIds));
  };

  const selectDebateAblation = () => {
    const ablationIds = strategies
      .filter((s) => s.isBenchmark || s.id.includes("debate"))
      .map((s) => s.id);
    onSetVisibleStrategies(new Set(ablationIds));
  };

  const selectBaselinesOnly = () => {
    const baselineIds = strategies
      .filter((s) => s.isBenchmark || s.type === "baseline" || s.id.includes("sma-rsi"))
      .map((s) => s.id);
    onSetVisibleStrategies(new Set(baselineIds));
  };

  return (
    <div className="space-y-4 rounded-xl border border-hairline bg-surface p-4 sm:p-5">
      {/* Top row: Symbol Selector + Ablation Presets + Metadata HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label htmlFor="symbol-select" className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            Dataset Target:
          </label>
          <div className="flex items-center gap-1.5" id="symbol-select">
            {availableSymbols.map((sym) => {
              const active = sym === selectedSymbol;
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => onSelectSymbol(sym)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors duration-150",
                    active
                      ? "bg-ink text-page shadow-sm"
                      : "border border-hairline bg-surface text-ink-2 hover:bg-surface-well hover:text-ink",
                  )}
                >
                  {sym}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick ablation presets & Inspector button */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-ink-3">Presets:</span>
          <Button variant="ghost" onClick={selectAll} className="text-xs px-2.5 py-1">
            All Strategies
          </Button>
          <Button variant="ghost" onClick={selectMacroAblation} className="text-xs px-2.5 py-1 text-teal-600 dark:text-teal-400">
            Macro Ablation
          </Button>
          <Button variant="ghost" onClick={selectDebateAblation} className="text-xs px-2.5 py-1">
            Debate vs Ablation
          </Button>
          <Button variant="ghost" onClick={selectBaselinesOnly} className="text-xs px-2.5 py-1">
            Baselines Only
          </Button>

          {onToggleVarianceSweep && (
            <button
              type="button"
              onClick={onToggleVarianceSweep}
              className={cn(
                "ml-1 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono font-medium transition-all duration-150",
                isVarianceSweepActive
                  ? "border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300 shadow-xs"
                  : "border-hairline bg-surface text-ink-2 hover:border-ink-3 hover:text-ink",
              )}
            >
              {/* Honesty law: only paid inference (totalCost > 0) pulses and
                  earns the "Live" label. A $0.00 sweep is a deterministic
                  offline replay — static dot, deterministic copy. */}
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isVarianceSweepActive
                    ? varianceSweepLive
                      ? "bg-teal-500 animate-pulse"
                      : "bg-teal-500"
                    : "bg-ink-3",
                )}
              />
              {varianceSweepLive
                ? "Live Sweep ($N=3$, <$5.00 Cap)"
                : "Deterministic Sweep ($N=3$, Offline Replay)"}
            </button>
          )}

          {onOpenInspector && (
            <button
              type="button"
              onClick={onOpenInspector}
              className="ml-1 flex items-center gap-1.5 rounded-md border border-series/30 bg-series/10 px-2.5 py-1 text-xs font-semibold text-series hover:bg-series/20 transition-all duration-150 shadow-xs"
              title="Open Decision Lineage & Provenance Inspector"
            >
              <span>📜</span>
              <span>Audit Lineage</span>
            </button>
          )}
        </div>
      </div>

      {/* Strategy Multi-Selection Toggles */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            Active Strategy Overlay ({visibleStrategyIds.size}/{strategies.length})
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {strategies.map((strategy) => {
            const isVisible = visibleStrategyIds.has(strategy.id);
            return (
              <button
                key={strategy.id}
                type="button"
                onClick={() => onToggleStrategy(strategy.id)}
                aria-pressed={isVisible}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all duration-150",
                  isVisible
                    ? "border-hairline bg-surface-well text-ink shadow-xs"
                    : "border-transparent bg-transparent text-ink-3 opacity-60 hover:opacity-100",
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-surface shadow-xs"
                  style={{ backgroundColor: strategy.color }}
                  aria-hidden="true"
                />
                <span className="truncate font-mono text-xs">{strategy.name}</span>
                {strategy.isBenchmark ? (
                  <span className="ml-auto rounded bg-ink/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-2">
                    Bench
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Telemetry HUD chips */}
      <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] font-mono text-ink-3 border-t border-hairline/60">
        <span className="flex items-center gap-1 rounded bg-surface-well px-2 py-0.5 border border-hairline">
          <span className="h-1.5 w-1.5 rounded-full bg-status-good" />
          Offline Replay (Zero Credential)
        </span>
        <span className="rounded bg-surface-well px-2 py-0.5 border border-hairline">
          SHA256: <span className="text-ink-2">{suite.datasetHash.slice(0, 10)}…</span>
        </span>
        <span className="rounded bg-surface-well px-2 py-0.5 border border-hairline">
          Git: <span className="text-ink-2">{suite.gitCommit.slice(0, 7)}</span>
        </span>
        <span className="rounded bg-surface-well px-2 py-0.5 border border-hairline">
          Duration: <span className="text-ink-2 tabular-nums">{suite.totalDurationMs ?? 0}ms</span>
        </span>
        <span className="rounded bg-surface-well px-2 py-0.5 border border-hairline">
          Token Cost: <span className="text-ink-2 tabular-nums">${(suite.totalCost ?? 0).toFixed(2)}</span>
        </span>
        {isVarianceSweepActive && (
          <span className="rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 px-2 py-0.5 border border-teal-500/30">
            Sweep Spend: <span className="font-semibold tabular-nums">${varianceCost.toFixed(3)}</span> / &lt;$5.00 Cap
          </span>
        )}
      </div>
    </div>
  );
}
