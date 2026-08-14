/**
 * Observatory route: evaluation tearsheet and multi-series equity curves.
 *
 * Impeccable Operate Mode:
 *  - Crisp financial telemetry, dense side-by-side matrices
 *  - Synchronized equity curves with interactive ablation toggles
 *  - Responsive layout adapting cleanly across desktop and tablet
 */
import { useState, useMemo, useEffect } from "react";
import type { ExperimentManifest } from "@committee/contracts";
import { useExperimentSuite, useVarianceSweep } from "../lib/queries";
import { ObservatoryControls, type StrategyOption } from "../components/observatory/ObservatoryControls";
import { MultiSeriesEquityChart } from "../components/observatory/MultiSeriesEquityChart";
import { ExperimentTearsheet } from "../components/observatory/ExperimentTearsheet";
import { DecisionInspector } from "../components/lineage/DecisionInspector";
import { Spinner } from "../components/ui/States";
import { Button } from "../components/ui/Button";

const AVAILABLE_SYMBOLS = ["AAPL", "MSFT", "NVDA"];

export function ObservatoryPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [isVarianceSweepActive, setIsVarianceSweepActive] = useState(false);

  const { data: suite, isLoading, error, refetch, isFetching } = useExperimentSuite(selectedSymbol);
  const { data: varianceSweep, isFetching: isFetchingSweep } = useVarianceSweep(
    selectedSymbol,
    25,
    3,
    5.0,
    isVarianceSweepActive,
  );

  // Strategy list with distinct visual palette tokens
  const strategies: StrategyOption[] = useMemo(() => {
    if (!suite) return [];

    const benchmarkId =
      typeof suite.benchmark.strategy === "string"
        ? suite.benchmark.strategy
        : suite.benchmark.strategy.name;

    const list: StrategyOption[] = [];

    // 1. Benchmark (Buy & Hold)
    list.push({
      id: benchmarkId,
      name: "Buy & Hold (Benchmark)",
      type: "benchmark",
      color: "var(--series-bench)",
      isBenchmark: true,
    });

    // 2. All other evaluated experiments
    for (const exp of suite.experiments) {
      const id = typeof exp.strategy === "string" ? exp.strategy : exp.strategy.name;
      if (id === benchmarkId) continue;

      let color = "var(--series-specialist)";
      let displayName = id;

      if (id.includes("sma-rsi")) {
        color = "var(--series-baseline)";
        displayName = "SMA(20/50) + RSI(14)";
      } else if (id.includes("debate-on")) {
        color = "var(--series-debate-on)";
        displayName = "Multi-Agent (Debate ON)";
      } else if (id.includes("debate-off")) {
        color = "var(--series-debate-off)";
        displayName = "Multi-Agent (Debate OFF / Ablation)";
      } else if (id.includes("polymarket")) {
        color = "var(--series-polymarket)";
        displayName = "Technical + Sentiment + Polymarket";
      }

      list.push({
        id,
        name: displayName,
        type: (exp.strategyConfig?.type as string) ?? "experiment",
        color,
        isBenchmark: false,
      });
    }

    return list;
  }, [suite]);

  // Set of currently visible strategy IDs
  const [visibleStrategyIds, setVisibleStrategyIds] = useState<Set<string>>(new Set());

  // Initialize visible strategies whenever strategy list changes
  useEffect(() => {
    if (strategies.length > 0) {
      setVisibleStrategyIds(new Set(strategies.map((s) => s.id)));
    }
  }, [strategies]);

  const handleToggleStrategy = (id: string) => {
    setVisibleStrategyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Prevent deselecting everything
        if (next.size > 1) {
          next.delete(id);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // State for Decision Lineage Inspector modal/drawer
  const [inspectorManifest, setInspectorManifest] = useState<ExperimentManifest | null>(null);
  const [inspectorTs, setInspectorTs] = useState<string | undefined>(undefined);

  const handleInspectManifest = (manifest: ExperimentManifest) => {
    setInspectorManifest(manifest);
    setInspectorTs(undefined);
  };

  const handleInspectPoint = (ts: string) => {
    if (!suite) return;
    // Find active multi-agent debate strategy first or fallback to benchmark
    const activeMultiAgent = suite.experiments.find(
      (e) => {
        const id = typeof e.strategy === "string" ? e.strategy : e.strategy.name;
        return visibleStrategyIds.has(id) && id.includes("debate-on");
      },
    );
    const targetManifest = activeMultiAgent ?? suite.experiments[0] ?? suite.benchmark;
    setInspectorManifest(targetManifest);
    setInspectorTs(ts);
  };

  return (
    <div className="space-y-6 pb-12 enter">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Evaluation Observatory
            </h1>
            <span className="rounded bg-series/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-series">
              Ablation Lab
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-2 sm:text-sm">
            Side-by-side strategy comparison tearsheet, comparative equity curves, and decision intelligence telemetry.
          </p>
        </div>

        {isFetching && !isLoading ? (
          <div className="flex items-center gap-2 text-xs text-ink-3">
            <Spinner className="h-3.5 w-3.5" />
            <span>Updating suite replay…</span>
          </div>
        ) : null}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 rounded-xl border border-hairline bg-surface p-8">
          <Spinner className="h-7 w-7 text-series" />
          <p className="text-sm font-medium text-ink-2">Running offline replay & calculating benchmark deltas…</p>
          <p className="text-xs text-ink-3">Zero-credential offline execution against frozen historical fixtures</p>
        </div>
      ) : null}

      {/* Error state */}
      {error && !isLoading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-delta-neg/30 bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-delta-neg">Failed to load experiment suite replay</p>
          <p className="max-w-md text-xs text-ink-2">
            {error instanceof Error ? error.message : "The evaluation manifest could not be retrieved from the API."}
          </p>
          <Button variant="ghost" onClick={() => refetch()}>
            Retry Evaluation Run
          </Button>
        </div>
      ) : null}

      {/* Main Suite Content */}
      {suite && !isLoading ? (
        <div className="space-y-6">
          {/* Controls & Telemetry HUD */}
          <ObservatoryControls
            suite={suite}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            availableSymbols={AVAILABLE_SYMBOLS}
            strategies={strategies}
            visibleStrategyIds={visibleStrategyIds}
            onToggleStrategy={handleToggleStrategy}
            onSetVisibleStrategies={setVisibleStrategyIds}
            isVarianceSweepActive={isVarianceSweepActive}
            onToggleVarianceSweep={() => setIsVarianceSweepActive((v) => !v)}
            varianceCost={varianceSweep?.totalCost ?? 0}
          />

          {/* Multi-Series Equity Curves & Drawdown Chart */}
          <MultiSeriesEquityChart
            experiments={suite.experiments}
            benchmark={suite.benchmark}
            strategies={strategies}
            visibleStrategyIds={visibleStrategyIds}
            varianceBands={varianceSweep?.equityBands}
            isVarianceSweepActive={isVarianceSweepActive}
            onInspectPoint={handleInspectPoint}
          />

          {/* Strategy Comparison Matrix Tearsheet */}
          <ExperimentTearsheet
            suite={suite}
            strategies={strategies}
            visibleStrategyIds={visibleStrategyIds}
            onToggleStrategy={handleToggleStrategy}
            onInspectManifest={handleInspectManifest}
          />

          {/* Decision Lineage Inspector Slide-Over Drawer */}
          {inspectorManifest ? (
            <DecisionInspector
              isOpen={Boolean(inspectorManifest)}
              onClose={() => setInspectorManifest(null)}
              manifest={inspectorManifest}
              initialDecisionTs={inspectorTs}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
