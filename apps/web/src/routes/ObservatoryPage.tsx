/**
 * Observatory route: evaluation tearsheet, multi-series equity curves, and multi-asset universe allocation.
 *
 * Impeccable Operate Mode:
 *  - Crisp financial telemetry, dense side-by-side matrices
 *  - Synchronized equity curves with interactive ablation toggles
 *  - Cross-Asset Universe Basket portfolio evaluation (AAPL + NVDA + SPY)
 *  - Responsive layout adapting cleanly across desktop and tablet
 */
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ExperimentManifest, MultiAssetExperimentManifest } from "@committee/contracts";
import { useExperimentSuite, useMultiAssetExperimentSuite, useVarianceSweep } from "../lib/queries";
import { ObservatoryControls, type StrategyOption } from "../components/observatory/ObservatoryControls";
import { MultiSeriesEquityChart } from "../components/observatory/MultiSeriesEquityChart";
import { ExperimentTearsheet } from "../components/observatory/ExperimentTearsheet";
import { AssetAllocationBreakdown } from "../components/observatory/AssetAllocationBreakdown";
import { Spinner } from "../components/ui/States";
import { Button } from "../components/ui/Button";

// Available symbols including Universe Basket option
const AVAILABLE_SYMBOLS = ["AAPL", "NVDA", "SPY", "BASKET"];

export function ObservatoryPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [isVarianceSweepActive, setIsVarianceSweepActive] = useState(false);

  const isBasketMode = selectedSymbol === "BASKET";

  // Single-Asset Suite
  const {
    data: singleSuite,
    isLoading: isLoadingSingle,
    error: errorSingle,
    refetch: refetchSingle,
    isFetching: isFetchingSingle,
  } = useExperimentSuite(selectedSymbol);

  // Multi-Asset Suite
  const {
    data: multiSuite,
    isLoading: isLoadingMulti,
    error: errorMulti,
    refetch: refetchMulti,
    isFetching: isFetchingMulti,
  } = useMultiAssetExperimentSuite(["AAPL", "NVDA", "SPY"], isBasketMode);

  const { data: varianceSweep } = useVarianceSweep(
    selectedSymbol,
    25,
    3,
    5.0,
    isVarianceSweepActive && !isBasketMode,
  );

  const suite = isBasketMode ? (multiSuite as unknown as typeof singleSuite) : singleSuite;
  const isLoading = isBasketMode ? isLoadingMulti : isLoadingSingle;
  const isFetching = isBasketMode ? isFetchingMulti : isFetchingSingle;
  const error = isBasketMode ? errorMulti : errorSingle;
  const refetch = isBasketMode ? refetchMulti : refetchSingle;

  const isVarianceSweepLive = (varianceSweep?.totalCost ?? 0) > 0;

  // Strategy list with distinct visual palette tokens
  const strategies: StrategyOption[] = useMemo(() => {
    if (!suite) return [];

    const benchmarkId =
      typeof suite.benchmark.strategy === "string"
        ? suite.benchmark.strategy
        : suite.benchmark.strategy.name;

    const list: StrategyOption[] = [];

    // 1. Benchmark
    list.push({
      id: benchmarkId,
      name: isBasketMode ? "1/N Equal-Weight Basket (Benchmark)" : "Buy & Hold (Benchmark)",
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
        displayName = isBasketMode ? "Multi-Asset SMA(20/50) + RSI(14)" : "SMA(20/50) + RSI(14)";
      } else if (id.includes("debate-on")) {
        color = "var(--series-debate-on)";
        displayName = isBasketMode ? "Multi-Asset Committee (Debate ON)" : "Multi-Agent (Debate ON)";
      } else if (id.includes("debate-off")) {
        color = "var(--series-debate-off)";
        displayName = isBasketMode ? "Multi-Asset Committee (Debate OFF / Ablation)" : "Multi-Agent (Debate OFF / Ablation)";
      } else if (id.includes("polymarket")) {
        color = "var(--series-polymarket)";
        displayName = isBasketMode ? "Multi-Asset Committee + Polymarket" : "Technical + Sentiment + Polymarket";
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
  }, [suite, isBasketMode]);

  // Set of currently visible strategy IDs
  const [visibleStrategyIds, setVisibleStrategyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (strategies.length > 0) {
      setVisibleStrategyIds(new Set(strategies.map((s) => s.id)));
    }
  }, [strategies]);

  const handleToggleStrategy = (id: string) => {
    setVisibleStrategyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const navigate = useNavigate();

  const handleInspectManifest = (manifest: ExperimentManifest | MultiAssetExperimentManifest) => {
    const stratId = typeof manifest.strategy === "string" ? manifest.strategy : manifest.strategy.name;
    const sym = isBasketMode ? "AAPL" : selectedSymbol;
    navigate(`/lineage?symbol=${sym}&strategy=${encodeURIComponent(stratId)}`);
  };

  const handleInspectPoint = (ts?: string) => {
    const sym = isBasketMode ? "AAPL" : selectedSymbol;
    const params = new URLSearchParams({ symbol: sym });
    if (ts) params.set("ts", ts);
    navigate(`/lineage?${params.toString()}`);
  };

  // Currently selected multi-asset manifest for allocation breakdown
  const selectedMultiAssetManifest = useMemo(() => {
    if (!multiSuite || !isBasketMode) return undefined;
    const debateOn = multiSuite.experiments.find((e) => {
      const name = typeof e.strategy === "string" ? e.strategy : e.strategy.name;
      return name.includes("debate-on");
    });
    return debateOn ?? multiSuite.experiments[0];
  }, [multiSuite, isBasketMode]);

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
              {isBasketMode ? "Multi-Asset Universe Lab" : "Ablation Lab"}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-2 sm:text-sm">
            {isBasketMode
              ? "Cross-asset capital allocation, portfolio rebalancing, and multi-asset universe tearsheets (AAPL + NVDA + SPY)."
              : "Side-by-side strategy comparison tearsheet, comparative equity curves, and decision intelligence telemetry."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isFetching && !isLoading ? (
            <div className="flex items-center gap-2 text-xs text-ink-3">
              <Spinner className="h-3.5 w-3.5" />
              <span>Updating suite replay…</span>
            </div>
          ) : null}

          {suite && (
            <button
              type="button"
              onClick={() => handleInspectPoint()}
              className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-well transition-colors shadow-xs"
              title="Open Decision Lineage & Provenance Inspector"
            >
              <span className="text-series">📜</span>
              <span>Audit Lineage</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 rounded-xl border border-hairline bg-surface p-8">
          <Spinner className="h-7 w-7 text-series" />
          <p className="text-sm font-medium text-ink-2">
            {isBasketMode
              ? "Running multi-asset portfolio evaluation across AAPL, NVDA, and SPY…"
              : "Running offline replay & calculating benchmark deltas…"}
          </p>
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
            isVarianceSweepActive={isVarianceSweepActive && !isBasketMode}
            onToggleVarianceSweep={() => setIsVarianceSweepActive((v) => !v)}
            varianceCost={varianceSweep?.totalCost ?? 0}
            varianceSweepLive={isVarianceSweepLive}
            onOpenInspector={() => handleInspectPoint()}
          />

          {/* Cross-Asset Capital Allocation Breakdown (Visible in Multi-Asset Basket Mode) */}
          {isBasketMode && selectedMultiAssetManifest && (
            <AssetAllocationBreakdown manifest={selectedMultiAssetManifest} />
          )}

          {/* Multi-Series Equity Curves & Drawdown Chart */}
          <MultiSeriesEquityChart
            experiments={suite.experiments}
            benchmark={suite.benchmark}
            strategies={strategies}
            visibleStrategyIds={visibleStrategyIds}
            varianceBands={isBasketMode ? undefined : varianceSweep?.equityBands}
            isVarianceSweepActive={isVarianceSweepActive && !isBasketMode}
            isVarianceSweepLive={isVarianceSweepLive}
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
        </div>
      ) : null}
    </div>
  );
}
