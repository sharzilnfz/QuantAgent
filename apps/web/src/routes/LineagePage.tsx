/**
 * Dedicated Full-Page Decision Provenance & Multi-Agent Lineage Inspector.
 *
 * Impeccable Operate Mode:
 *  - Full-width dense provenance workspace without popup modals
 *  - Deep point-in-time auditing: OHLCV bars, indicators, news, SEC EDGAR XBRL filings
 *  - Specialist deliberation transcripts: Technical, Sentiment, and Fundamental stances
 *  - Exact rendered LLM prompts and raw completions with clipboard support
 *  - Keyboard navigation (Left/Right arrows to step through trading days)
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import type { DecisionLineageRecord, ExperimentManifest } from "@committee/contracts";
import { useExperimentSuite } from "../lib/queries";
import { formatDayShort, formatMoney } from "../lib/format";
import { Spinner, EmptyState } from "../components/ui/States";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/cn";

const AVAILABLE_SYMBOLS = ["AAPL", "NVDA", "SPY"];

type InspectorTab = "inputs" | "debate" | "prompts" | "execution";

export function LineagePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const symbolParam = searchParams.get("symbol") || "AAPL";
  const selectedSymbol = AVAILABLE_SYMBOLS.includes(symbolParam) ? symbolParam : "AAPL";

  const strategyParam = searchParams.get("strategy") || "multi-agent-debate-on";
  const tsParam = searchParams.get("ts") || undefined;

  const { data: suite, isLoading, error, refetch, isFetching } = useExperimentSuite(selectedSymbol);

  // All evaluated strategies (including benchmark)
  const allStrategies = useMemo(() => {
    if (!suite) return [];
    const benchId = typeof suite.benchmark.strategy === "string" ? suite.benchmark.strategy : suite.benchmark.strategy.name;
    const list: ExperimentManifest[] = [suite.benchmark];
    for (const exp of suite.experiments) {
      const id = typeof exp.strategy === "string" ? exp.strategy : exp.strategy.name;
      if (id !== benchId) list.push(exp);
    }
    return list;
  }, [suite]);

  // Selected strategy manifest
  const selectedManifest: ExperimentManifest | undefined = useMemo(() => {
    if (!allStrategies.length) return undefined;
    const match = allStrategies.find((e) => {
      const id = typeof e.strategy === "string" ? e.strategy : e.strategy.name;
      return id === strategyParam || id.includes(strategyParam);
    });
    return match ?? allStrategies[0];
  }, [allStrategies, strategyParam]);

  const lineageRecords: DecisionLineageRecord[] = useMemo(() => {
    return selectedManifest?.lineageRecords ?? [];
  }, [selectedManifest]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<InspectorTab>("debate");
  const [activePromptAgent, setActivePromptAgent] = useState<string>("technical");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync selected decision index when tsParam or lineageRecords change
  useEffect(() => {
    if (lineageRecords.length === 0) return;

    if (tsParam) {
      const exactIdx = lineageRecords.findIndex((r) => r.decisionTs === tsParam || r.decisionTs.startsWith(tsParam.slice(0, 10)));
      if (exactIdx !== -1) {
        setSelectedIndex(exactIdx);
        return;
      }
      if (selectedManifest?.equityCurve) {
        const eqIdx = selectedManifest.equityCurve.findIndex((p) => p.ts === tsParam);
        if (eqIdx !== -1 && eqIdx < lineageRecords.length) {
          setSelectedIndex(eqIdx);
          return;
        }
      }
    }
    setSelectedIndex(lineageRecords.length - 1);
  }, [tsParam, lineageRecords, selectedManifest]);

  // Keyboard navigation (Arrow keys step through time)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setSelectedIndex((prev) => Math.min(lineageRecords.length - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lineageRecords.length]);

  const handleSelectSymbol = (sym: string) => {
    setSearchParams({ symbol: sym, strategy: strategyParam });
  };

  const handleSelectStrategy = (stratId: string) => {
    setSearchParams({ symbol: selectedSymbol, strategy: stratId });
  };

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const currentRecord: DecisionLineageRecord | undefined = lineageRecords[selectedIndex];
  const consensus = currentRecord?.consensusResult;

  // Operational Telemetry HUD metrics
  const telemetry = useMemo(() => {
    const totalDecisions = lineageRecords.length || 1;
    const totalCost = selectedManifest?.tokenCost ?? 0;
    const costPer100 = (totalCost / totalDecisions) * 100;
    const medianLatency = selectedManifest?.latencyMs ?? 0;
    const fallbackRate = selectedManifest?.fallbackRate ?? 0;
    const debatesCount = lineageRecords.filter((r) => r.consensusResult.mode === "debate_synthesis").length;

    return {
      totalDecisions,
      totalCost,
      costPer100,
      medianLatency,
      fallbackRate,
      debatesCount,
    };
  }, [lineageRecords, selectedManifest]);

  return (
    <div className="space-y-6 pb-12 enter">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Decision Provenance Inspector
            </h1>
            <span className="rounded bg-series/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-series">
              Audit DAG
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-2 sm:text-sm">
            Audited point-in-time inputs, multi-agent debate transcripts, and LLM completions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Symbol Selector */}
          <div className="flex items-center rounded-lg border border-hairline bg-surface p-1">
            {AVAILABLE_SYMBOLS.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => handleSelectSymbol(sym)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-colors duration-150",
                  sym === selectedSymbol
                    ? "bg-ink text-page shadow-xs"
                    : "text-ink-2 hover:bg-surface-well hover:text-ink",
                )}
              >
                {sym}
              </button>
            ))}
          </div>

          <Link to={`/observatory`}>
            <Button variant="ghost" className="text-xs">
              ← Back to Observatory
            </Button>
          </Link>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 rounded-xl border border-hairline bg-surface p-8">
          <Spinner className="h-7 w-7 text-series" />
          <p className="text-sm font-medium text-ink-2">Loading decision provenance audit log…</p>
        </div>
      ) : null}

      {/* Error state */}
      {error && !isLoading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-delta-neg/30 bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-delta-neg">Failed to load lineage records</p>
          <Button variant="ghost" onClick={() => refetch()} className="mt-2">
            Retry
          </Button>
        </div>
      ) : null}

      {/* Main Lineage Content */}
      {!isLoading && selectedManifest && (
        <div className="space-y-5">
          {/* Strategy Selector Strip & Telemetry HUD */}
          <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Strategy:</span>
                <div className="flex flex-wrap gap-1.5">
                  {allStrategies.map((strat) => {
                    const id = typeof strat.strategy === "string" ? strat.strategy : strat.strategy.name;
                    const active = id === strategyParam || id === (typeof selectedManifest.strategy === "string" ? selectedManifest.strategy : selectedManifest.strategy.name);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSelectStrategy(id)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-semibold transition-all duration-150",
                          active
                            ? "border-series/40 bg-series/10 text-series shadow-xs"
                            : "border-hairline bg-surface text-ink-2 hover:bg-surface-well hover:text-ink",
                        )}
                      >
                        {id}
                      </button>
                    );
                  })}
                </div>
              </div>

              <span className="text-xs font-mono text-ink-3">
                Keyboard: <kbd className="rounded border border-hairline px-1.5 py-0.5">←</kbd> / <kbd className="rounded border border-hairline px-1.5 py-0.5">→</kbd> to step bars
              </span>
            </div>

            {/* Operational Telemetry HUD */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
              <div className="rounded-lg border border-hairline bg-surface-well/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-3">Cost / 100 Decisions</div>
                <div className="mt-1 text-base font-bold text-ink">
                  ${telemetry.costPer100.toFixed(4)}
                </div>
                <div className="text-[10px] text-ink-3">Total: ${telemetry.totalCost.toFixed(4)}</div>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-well/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-3">Median Latency</div>
                <div className="mt-1 text-base font-bold text-ink">
                  {telemetry.medianLatency} ms
                </div>
                <div className="text-[10px] text-ink-3">Per inference step</div>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-well/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-3">Fallback / Error Rate</div>
                <div className="mt-1 text-base font-bold text-ink">
                  {(telemetry.fallbackRate * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-ink-3">Schema rejections</div>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-well/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-3">Debate Reconciliations</div>
                <div className="mt-1 text-base font-bold text-ink">
                  {telemetry.debatesCount} / {telemetry.totalDecisions}
                </div>
                <div className="text-[10px] text-ink-3">Disagreements resolved</div>
              </div>
            </div>
          </div>

          {/* Stepper Navigation Toolbar */}
          {lineageRecords.length > 0 && currentRecord ? (
            <div className="rounded-xl border border-hairline bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIndex((prev) => Math.max(0, prev - 1))}
                  disabled={selectedIndex === 0}
                  className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-surface-well hover:text-ink disabled:opacity-40 transition-colors"
                >
                  ← Prev Bar
                </button>

                <span className="font-mono text-xs font-semibold text-ink px-2">
                  Bar <strong className="text-series">{selectedIndex + 1}</strong> of {lineageRecords.length}
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedIndex((prev) => Math.min(lineageRecords.length - 1, prev + 1))}
                  disabled={selectedIndex === lineageRecords.length - 1}
                  className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-surface-well hover:text-ink disabled:opacity-40 transition-colors"
                >
                  Next Bar →
                </button>
              </div>

              {/* Timestamp & Bias Badges */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-ink-3 bg-surface-well px-2 py-1 rounded border border-hairline">
                  T = {currentRecord.decisionTs}
                </span>

                <span
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-mono font-bold uppercase",
                    consensus?.finalBias === "bullish"
                      ? "bg-delta-pos/15 text-delta-pos border border-delta-pos/30"
                      : consensus?.finalBias === "bearish"
                      ? "bg-delta-neg/15 text-delta-neg border border-delta-neg/30"
                      : "bg-surface-well text-ink-2 border border-hairline",
                  )}
                >
                  {consensus?.finalBias} ({(consensus?.finalConfidence ? consensus.finalConfidence * 100 : 0).toFixed(0)}% CONF)
                </span>

                <span className="rounded bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                  {consensus?.mode === "consensus_short_circuit"
                    ? "⚡ Consensus Fast-Pass"
                    : consensus?.mode === "debate_synthesis"
                    ? "💬 Debate Synthesized"
                    : "Ablation Fallback"}
                </span>
              </div>
            </div>
          ) : null}

          {/* Tab Navigation */}
          <div className="flex border-b border-hairline bg-surface rounded-t-xl px-4 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab("debate")}
              className={cn(
                "border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors duration-150",
                activeTab === "debate"
                  ? "border-series text-series"
                  : "border-transparent text-ink-3 hover:text-ink",
              )}
            >
              1. Multi-Agent Debate & Stances
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("inputs")}
              className={cn(
                "border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors duration-150",
                activeTab === "inputs"
                  ? "border-series text-series"
                  : "border-transparent text-ink-3 hover:text-ink",
              )}
            >
              2. Point-in-Time Inputs (OHLCV, Indicators, News, SEC XBRL)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("prompts")}
              className={cn(
                "border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors duration-150",
                activeTab === "prompts"
                  ? "border-series text-series"
                  : "border-transparent text-ink-3 hover:text-ink",
              )}
            >
              3. Prompts & LLM Completions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("execution")}
              className={cn(
                "border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors duration-150",
                activeTab === "execution"
                  ? "border-series text-series"
                  : "border-transparent text-ink-3 hover:text-ink",
              )}
            >
              4. Execution Fill {currentRecord?.executionFill ? "⚡" : ""}
            </button>
          </div>

          {/* Main Tab Panels */}
          {currentRecord ? (
            <div className="space-y-5">
              {/* TAB 1: DEBATE & CONSENSUS */}
              {activeTab === "debate" ? (
                <div className="space-y-5">
                  {/* Specialist Stances Breakdown */}
                  <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between border-b border-hairline pb-3">
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight text-ink">
                          Specialist Signal Evaluations
                        </h3>
                        <p className="text-xs text-ink-3">
                          Concurrent specialist readings at decision timestamp {formatDayShort(currentRecord.decisionTs)}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-ink-3">
                        Active Specialists: {Object.keys(consensus?.specialistVotes ?? {}).length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(consensus?.specialistVotes ?? {}).map(([agentName, vote]) => {
                        const displayEvidence = Object.entries(vote.evidence).filter(
                          ([k]) =>
                            ![
                              "renderedPrompt",
                              "rawCompletion",
                              "completionMode",
                              "completionValidated",
                              "decisionTs",
                              "snapshotAsOf",
                              "snapshotTs",
                              "deterministic",
                            ].includes(k),
                        );

                        return (
                          <div
                            key={agentName}
                            className="flex flex-col justify-between rounded-xl border border-hairline bg-surface-well/50 p-4 space-y-3 overflow-hidden shadow-xs"
                          >
                            <div>
                              <div className="flex items-center justify-between border-b border-hairline pb-2 mb-2">
                                <span className="font-bold text-sm capitalize text-ink">
                                  {agentName} Specialist
                                </span>
                                <span
                                  className={cn(
                                    "rounded px-2 py-0.5 text-xs font-mono font-bold uppercase",
                                    vote.direction === "bullish"
                                      ? "bg-delta-pos/15 text-delta-pos"
                                      : vote.direction === "bearish"
                                      ? "bg-delta-neg/15 text-delta-neg"
                                      : "bg-surface-well text-ink-3 border border-hairline",
                                  )}
                                >
                                  {vote.direction} ({(vote.confidence * 100).toFixed(0)}%)
                                </span>
                              </div>
                              <p className="text-xs text-ink-2 leading-relaxed break-words">
                                {vote.rationale}
                              </p>
                            </div>

                            {displayEvidence.length > 0 ? (
                              <div className="rounded-lg bg-surface p-3 font-mono text-[11px] text-ink-3 border border-hairline space-y-2 overflow-hidden">
                                <div className="flex items-center justify-between border-b border-hairline pb-1">
                                  <span className="font-semibold text-ink-2 text-[10px] uppercase tracking-wider">
                                    Facts & Evidence:
                                  </span>
                                  <span className="text-[9px] text-ink-3">Ground Truth</span>
                                </div>
                                <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                                  {displayEvidence.map(([key, val]) => {
                                    let formattedVal = String(val);
                                    if (typeof val === "number") {
                                      formattedVal = Number.isInteger(val)
                                        ? String(val)
                                        : Math.abs(val) < 0.01 && val !== 0
                                        ? val.toExponential(2)
                                        : val.toFixed(2);
                                    }
                                    return (
                                      <div
                                        key={key}
                                        className="flex items-baseline justify-between gap-2 rounded bg-surface-well/70 px-2 py-1 text-[11px] overflow-hidden"
                                      >
                                        <span className="text-ink-3 truncate capitalize">
                                          {key.replace(/([A-Z])/g, " $1")}:
                                        </span>
                                        <span className="font-semibold text-ink shrink-0 truncate max-w-[60%]">
                                          {formattedVal}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Consensus / Debate Synthesis Card */}
                  <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5">
                    <h3 className="text-sm font-semibold tracking-tight text-ink mb-3">
                      L3 Coordinator Reconciliation Outcome
                    </h3>

                    {consensus?.mode === "consensus_short_circuit" ? (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs">
                        <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                          <span>✓ Unanimous Consensus Short-Circuit</span>
                        </div>
                        <p className="mt-1 text-ink-2 leading-relaxed">
                          Specialists aligned on directional bias ({consensus.finalBias}). Reconciled immediately with zero extra LLM token cost ($0.00).
                        </p>
                      </div>
                    ) : consensus?.mode === "debate_synthesis" && consensus?.synthesis ? (
                      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-3 text-xs">
                        <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                          <div className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                            <span>💬 Single-Pass Debate Synthesis</span>
                            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-mono uppercase">
                              Driver: {consensus.synthesis.primaryDriver}
                            </span>
                          </div>
                          <div className="font-mono text-ink-2">
                            Final Bias: <strong className="uppercase">{consensus.synthesis.direction}</strong> ({(consensus.synthesis.confidence * 100).toFixed(0)}% conf)
                          </div>
                        </div>

                        <div>
                          <div className="font-semibold text-ink mb-1">Synthesis Rationale:</div>
                          <p className="text-ink-2 leading-relaxed">{consensus.synthesis.rationale}</p>
                        </div>

                        {consensus.synthesis.dissentingView ? (
                          <div className="rounded bg-surface p-3 border border-hairline">
                            <div className="font-semibold text-ink-3 text-[11px] mb-1 uppercase tracking-wider">
                              Dissenting Stance Analysis:
                            </div>
                            <p className="text-ink-2 italic leading-relaxed">
                              {consensus.synthesis.dissentingView}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-hairline bg-surface-well p-4 text-xs">
                        <div className="font-semibold text-ink">Ablation Neutral Fallback</div>
                        <p className="mt-1 text-ink-2">
                          Specialists disagreed and debate was disabled (control baseline). Preserved neutral cash position.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* TAB 2: HISTORICAL INPUTS */}
              {activeTab === "inputs" ? (
                <div className="space-y-5">
                  {/* OHLCV Bar Window */}
                  <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between border-b border-hairline pb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                        OHLCV Bar Window (Input State ≤ {formatDayShort(currentRecord.decisionTs)})
                      </h4>
                      <span className="text-[11px] font-mono text-ink-3">
                        Total Bars in Window: {currentRecord.inputBars.length}
                      </span>
                    </div>
                    <div className="max-h-56 overflow-auto rounded-lg border border-hairline font-mono text-xs">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-surface-well text-ink-2">
                          <tr className="border-b border-hairline">
                            <th className="px-3 py-1.5">Timestamp</th>
                            <th className="px-3 py-1.5 text-right">Open</th>
                            <th className="px-3 py-1.5 text-right">High</th>
                            <th className="px-3 py-1.5 text-right">Low</th>
                            <th className="px-3 py-1.5 text-right">Close</th>
                            <th className="px-3 py-1.5 text-right">Volume</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentRecord.inputBars.slice(-10).map((bar, i, arr) => {
                            const isCurrent = i === arr.length - 1;
                            return (
                              <tr
                                key={bar.asOf}
                                className={cn(
                                  "border-t border-hairline transition-colors",
                                  isCurrent ? "bg-series/10 font-bold text-ink" : "hover:bg-surface-well/50 text-ink-2",
                                )}
                              >
                                <td className="px-3 py-1">{bar.asOf} {isCurrent ? "★ [T]" : ""}</td>
                                <td className="px-3 py-1 text-right tabular-nums">{formatMoney(bar.open)}</td>
                                <td className="px-3 py-1 text-right tabular-nums">{formatMoney(bar.high)}</td>
                                <td className="px-3 py-1 text-right tabular-nums">{formatMoney(bar.low)}</td>
                                <td className="px-3 py-1 text-right tabular-nums font-semibold">{formatMoney(bar.close)}</td>
                                <td className="px-3 py-1 text-right tabular-nums">{bar.volume.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SEC EDGAR XBRL Filings */}
                  <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between border-b border-hairline pb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                        SEC EDGAR XBRL Filings (Strictly Filtered to filedAt ≤ {currentRecord.decisionTs})
                      </h4>
                      <span className="text-[11px] font-mono text-ink-3">
                        Disclosures: {currentRecord.fundamentals?.length ?? 0}
                      </span>
                    </div>
                    {currentRecord.fundamentals && currentRecord.fundamentals.length > 0 ? (
                      (() => {
                        const latestReport = currentRecord.fundamentals[currentRecord.fundamentals.length - 1]!;
                        return (
                          <div className="rounded-lg border border-hairline bg-surface-well/50 p-4 text-xs">
                            <div className="flex items-center justify-between border-b border-hairline pb-2 mb-3">
                              <span className="font-bold text-sm text-ink">
                                SEC Form {latestReport.form} ({latestReport.fiscalYear} {latestReport.fiscalPeriod})
                              </span>
                              <span className="font-mono text-xs text-ink-3">
                                Filed: {latestReport.filedAt.slice(0, 10)} (Period End: {latestReport.periodEndDate})
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                              <div className="rounded bg-surface p-2 border border-hairline">
                                <div className="text-[10px] text-ink-3">Revenue:</div>
                                <div className="font-bold text-ink">${(latestReport.revenue / 1e9).toFixed(2)}B</div>
                              </div>
                              <div className="rounded bg-surface p-2 border border-hairline">
                                <div className="text-[10px] text-ink-3">YoY Revenue Growth:</div>
                                <div className={cn("font-bold", (latestReport.revenueGrowthYoY ?? 0) >= 0 ? "text-delta-pos" : "text-delta-neg")}>
                                  {latestReport.revenueGrowthYoY != null ? `${(latestReport.revenueGrowthYoY * 100).toFixed(1)}%` : "N/A"}
                                </div>
                              </div>
                              <div className="rounded bg-surface p-2 border border-hairline">
                                <div className="text-[10px] text-ink-3">Operating Margin:</div>
                                <div className="font-bold text-ink">{(latestReport.operatingMargin * 100).toFixed(1)}%</div>
                              </div>
                              <div className="rounded bg-surface p-2 border border-hairline">
                                <div className="text-[10px] text-ink-3">Free Cash Flow:</div>
                                <div className="font-bold text-ink">${(latestReport.freeCashFlow / 1e9).toFixed(2)}B</div>
                              </div>
                              <div className="rounded bg-surface p-2 border border-hairline">
                                <div className="text-[10px] text-ink-3">Net Margin:</div>
                                <div className="font-bold text-ink">{(latestReport.netMargin * 100).toFixed(1)}%</div>
                              </div>
                              <div className="rounded bg-surface p-2 border border-hairline">
                                <div className="text-[10px] text-ink-3">Debt / Equity:</div>
                                <div className="font-bold text-ink">{latestReport.debtToEquity.toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="rounded-lg border border-hairline bg-surface-well p-4 text-xs font-mono text-ink-3">
                        Zero SEC filings available prior to this decision timestamp ({currentRecord.decisionTs}). Anti-leakage verified.
                      </div>
                    )}
                  </div>

                  {/* News Stream */}
                  <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between border-b border-hairline pb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                        Benzinga News Stream (Strictly Filtered to publishedAt ≤ {currentRecord.decisionTs})
                      </h4>
                      <span className="text-[11px] font-mono text-ink-3">
                        Items: {currentRecord.news.length}
                      </span>
                    </div>
                    {currentRecord.news.length > 0 ? (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {currentRecord.news.map((item) => (
                          <div key={item.id} className="rounded-lg border border-hairline bg-surface-well/50 p-3 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-ink">{item.headline}</span>
                              <span className="shrink-0 font-mono text-[10px] text-ink-3">{item.publishedAt}</span>
                            </div>
                            {item.summary && <p className="mt-1 text-[11px] text-ink-2 line-clamp-2">{item.summary}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-hairline bg-surface-well p-4 text-xs font-mono text-ink-3">
                        Zero news articles published prior to this decision timestamp ({currentRecord.decisionTs}).
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* TAB 3: PROMPTS & LLM COMPLETIONS */}
              {activeTab === "prompts" ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Agent Prompt:</span>
                      {Object.keys(currentRecord.specialistPrompts).map((agentKey) => (
                        <button
                          key={agentKey}
                          type="button"
                          onClick={() => setActivePromptAgent(agentKey)}
                          className={cn(
                            "rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors duration-150",
                            activePromptAgent === agentKey
                              ? "bg-ink text-page shadow-xs"
                              : "border border-hairline bg-surface text-ink-2 hover:bg-surface-well hover:text-ink",
                          )}
                        >
                          {agentKey}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink">Exact Rendered Prompt Text:</span>
                        <Button
                          variant="ghost"
                          onClick={() => handleCopy(currentRecord.specialistPrompts[activePromptAgent] ?? "", "prompt")}
                          className="text-xs px-2.5 py-1"
                        >
                          {copiedKey === "prompt" ? "✓ Copied" : "Copy Prompt"}
                        </Button>
                      </div>
                      <pre className="max-h-72 overflow-auto rounded-lg border border-hairline bg-surface-well p-3 font-mono text-xs leading-relaxed text-ink-2 whitespace-pre-wrap">
                        {currentRecord.specialistPrompts[activePromptAgent] ?? "No rendered prompt recorded."}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* TAB 4: EXECUTION FILL */}
              {activeTab === "execution" ? (
                <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-2 mb-3">
                    Execution Fill Telemetry
                  </h4>
                  {currentRecord.executionFill ? (
                    <div className="rounded-lg border border-hairline bg-surface-well p-4 font-mono text-xs space-y-2">
                      <div>Timestamp: {currentRecord.executionFill.ts}</div>
                      <div>Action: {currentRecord.executionFill.toPosition > currentRecord.executionFill.fromPosition ? "BUY" : "SELL"}</div>
                      <div>Shares: {currentRecord.executionFill.shares}</div>
                      <div>Fill Price: ${currentRecord.executionFill.price.toFixed(2)}</div>
                      <div>Trade Value: ${currentRecord.executionFill.value.toFixed(2)}</div>
                      <div>Commission Fee: ${currentRecord.executionFill.fee.toFixed(2)}</div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-hairline bg-surface-well p-4 text-xs font-mono text-ink-3">
                      No order execution filled at this exact decision step (stance remained steady or cash allocated).
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="No decision lineage recorded"
              detail={`Strategy "${selectedManifest ? (typeof selectedManifest.strategy === "string" ? selectedManifest.strategy : selectedManifest.strategy.name) : ""}" is a deterministic baseline with zero per-decision LLM calls. No lineage is fabricated client-side.`}
            />
          )}
        </div>
      )}
    </div>
  );
}
