/**
 * Interactive Decision Lineage DAG Inspector & Telemetry HUD.
 *
 * Impeccable Operate Mode:
 *  - Deep inspection slide-over drawer with crisp hairline borders and keyboard accessibility
 *  - Point-in-time provenance audit: OHLCV bar window, indicators snapshot, news filtered to <= T
 *  - Multi-agent debate transcript visualizer: specialist votes, consensus check, and debate synthesis
 *  - Rendered prompt texts and raw LLM completions with copy-to-clipboard affordances
 *  - Operational Telemetry HUD: Cost per 100 Decisions, Median Latency, and Fallback Rate
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import type {
  ExperimentManifest,
} from "@committee/contracts";
import { formatDayShort, formatMoney } from "../../lib/format";
import { EmptyState } from "../ui/States";
import { cn } from "../../lib/cn";

export interface DecisionInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: ExperimentManifest;
  initialDecisionTs?: string;
}

type InspectorTab = "inputs" | "debate" | "prompts" | "execution";

export function DecisionInspector({
  isOpen,
  onClose,
  manifest,
  initialDecisionTs,
}: DecisionInspectorProps) {
  // Provenance law: only real server-recorded lineage is inspectable.
  // Deterministic baselines (buy-and-hold, SMA/RSI) replay rule-based logic
  // with zero per-bar LLM calls, so their manifests carry NO lineageRecords —
  // the drawer must say so honestly instead of fabricating records
  // client-side (fake OHLC wicks / volumes would poison point-in-time audits).
  const lineageRecords = manifest.lineageRecords ?? [];

  // Selected index in the lineage list
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<InspectorTab>("inputs");
  const [activePromptAgent, setActivePromptAgent] = useState<string>("technical");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync to the requested decision when the drawer opens
  useEffect(() => {
    if (!isOpen || lineageRecords.length === 0) return;

    if (initialDecisionTs) {
      // Alignment law: equityCurve points and lineageRecords are both
      // emitted once per bar, in order, so an equity point's INDEX selects
      // the same-index lineage record. The two series use DIFFERENT
      // timestamps for the same bar (bar close vs decision time), so direct
      // ts→decisionTs equality is only a defensive fallback — never the
      // primary lookup.
      const equityIdx = manifest.equityCurve.findIndex(
        (pt) => pt.ts === initialDecisionTs,
      );
      if (equityIdx !== -1 && equityIdx < lineageRecords.length) {
        setSelectedIndex(equityIdx);
        return;
      }

      const exactDecisionIdx = lineageRecords.findIndex(
        (r) => r.decisionTs === initialDecisionTs,
      );
      if (exactDecisionIdx !== -1) {
        setSelectedIndex(exactDecisionIdx);
        return;
      }
    }
    // Explicit fallback: open on the most recent recorded decision
    setSelectedIndex(lineageRecords.length - 1);
  }, [isOpen, initialDecisionTs, lineageRecords, manifest.equityCurve]);

  // ESC key listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setSelectedIndex((prev) => Math.min(lineageRecords.length - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, lineageRecords.length]);

  const currentRecord = lineageRecords[selectedIndex];

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  // Compute operational telemetry HUD metrics across the experiment
  const telemetry = useMemo(() => {
    const totalDecisions = lineageRecords.length || 1;
    const totalCost = manifest.tokenCost ?? 0;
    const costPer100 = (totalCost / totalDecisions) * 100;
    const medianLatency = manifest.latencyMs ?? 0;
    const fallbackRate = manifest.fallbackRate ?? 0;
    const debatesCount = lineageRecords.filter(
      (r) => r.consensusResult.mode === "debate_synthesis",
    ).length;

    return {
      totalDecisions,
      totalCost,
      costPer100,
      medianLatency,
      fallbackRate,
      debatesCount,
    };
  }, [lineageRecords, manifest]);

  if (!isOpen) return null;

  const strategyName =
    typeof manifest.strategy === "string" ? manifest.strategy : manifest.strategy.name;

  // Deterministic baselines record no per-decision LLM lineage (see law at
  // the top of this component): say so honestly rather than rendering
  // fabricated bars, prompts, or consensus transcripts.
  if (lineageRecords.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
      >
        {/* Click outside backdrop to close */}
        <div className="flex-1 cursor-pointer" onClick={onClose} aria-hidden="true" />

        {/* Slide-over Drawer */}
        <div className="relative flex h-full w-full max-w-3xl flex-col border-l border-hairline bg-surface shadow-2xl overflow-hidden enter">
          <div className="border-b border-hairline bg-surface-well px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-series/10 px-2 py-0.5 text-xs font-mono font-semibold uppercase tracking-wide text-series">
                  Lineage DAG
                </span>
                <h2 id="inspector-title" className="text-base font-bold tracking-tight text-ink">
                  Decision Provenance Inspector
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface hover:text-ink"
                aria-label="Close Inspector (ESC)"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-mono text-ink-2">
              <span>Strategy: <strong className="text-ink">{strategyName}</strong></span>
              <span>•</span>
              <span>Symbol: <strong className="text-ink">{manifest.symbol ?? "—"}</strong></span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-y-auto p-5">
            <EmptyState
              title="No decision lineage recorded"
              detail={`${strategyName} is a deterministic baseline: it replays rule-based logic over frozen fixtures with zero per-bar LLM calls, so there are no prompts, completions, or consensus records to inspect. Audit a multi-agent experiment row to inspect committee decision lineage.`}
              className="max-w-md"
            />
          </div>
        </div>
      </div>
    );
  }

  if (!currentRecord) return null;

  const consensus = currentRecord.consensusResult;
  const synthesis = consensus.synthesis;
  const isDebateMode = consensus.mode === "debate_synthesis";
  const isShortCircuit = consensus.mode === "consensus_short_circuit";
  const isAblationFallback = consensus.mode === "ablation_neutral_fallback";

  const availablePromptAgents = Object.keys(currentRecord.specialistPrompts);
  const promptKey = availablePromptAgents.includes(activePromptAgent)
    ? activePromptAgent
    : availablePromptAgents[0] ?? "";

  const renderedPrompt = promptKey ? currentRecord.specialistPrompts[promptKey] ?? "" : "";
  // Honesty law: only claim schema validation for a completion that actually
  // exists for the selected agent. Records with no completions (e.g. neutral
  // fallback outputs or empty payloads) were never parsed from an LLM
  // response, so they must not wear a green "validated" check.
  const selectedCompletion = promptKey
    ? currentRecord.specialistCompletions[promptKey]
    : undefined;
  const rawCompletion =
    selectedCompletion !== undefined ? JSON.stringify(selectedCompletion, null, 2) : "";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-title"
    >
      {/* Click outside backdrop to close */}
      <div className="flex-1 cursor-pointer" onClick={onClose} aria-hidden="true" />

      {/* Slide-over Drawer */}
      <div className="relative flex h-full w-full max-w-3xl flex-col border-l border-hairline bg-surface shadow-2xl overflow-hidden enter">
        {/* Top Bar Header */}
        <div className="border-b border-hairline bg-surface-well px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-series/10 px-2 py-0.5 text-xs font-mono font-semibold uppercase tracking-wide text-series">
                Lineage DAG
              </span>
              <h2 id="inspector-title" className="text-base font-bold tracking-tight text-ink">
                Decision Provenance Inspector
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface hover:text-ink"
              aria-label="Close Inspector (ESC)"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-ink-2">
            <div className="flex items-center gap-2">
              <span>Strategy: <strong className="text-ink">{strategyName}</strong></span>
              <span>•</span>
              <span>Symbol: <strong className="text-ink">{currentRecord.symbol}</strong></span>
            </div>
            <div className="text-ink-3">
              Press <kbd className="rounded border border-hairline bg-surface px-1 text-[10px]">←</kbd> /{" "}
              <kbd className="rounded border border-hairline bg-surface px-1 text-[10px]">→</kbd> to step bars
            </div>
          </div>
        </div>

        {/* Operational Telemetry HUD Bar */}
        <div className="grid grid-cols-2 border-b border-hairline bg-surface px-5 py-3 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="rounded-lg border border-hairline bg-surface-well/50 p-2.5">
            <div className="text-[11px] text-ink-3">Cost / 100 Decisions</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
              ${telemetry.costPer100.toFixed(4)}
            </div>
            <div className="text-[10px] text-ink-3">Est. API tokens</div>
          </div>

          <div className="rounded-lg border border-hairline bg-surface-well/50 p-2.5">
            <div className="text-[11px] text-ink-3">Median Latency</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
              {telemetry.medianLatency} ms
            </div>
            <div className="text-[10px] text-ink-3">Per inference step</div>
          </div>

          <div className="rounded-lg border border-hairline bg-surface-well/50 p-2.5">
            <div className="text-[11px] text-ink-3">Fallback / Error Rate</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
              {(telemetry.fallbackRate * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-ink-3">Schema rejections</div>
          </div>

          <div className="rounded-lg border border-hairline bg-surface-well/50 p-2.5">
            <div className="text-[11px] text-ink-3">Debate Reconciliations</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
              {telemetry.debatesCount} / {telemetry.totalDecisions}
            </div>
            <div className="text-[10px] text-ink-3">Disagreements resolved</div>
          </div>
        </div>

        {/* Timeline Stepper & Decision Summary Ribbon */}
        <div className="border-b border-hairline bg-surface px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Stepper Navigation */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIndex((prev) => Math.max(0, prev - 1))}
                disabled={selectedIndex === 0}
                className="rounded border border-hairline bg-surface-well px-2.5 py-1 text-xs font-semibold text-ink-2 hover:text-ink disabled:opacity-40"
              >
                ← Prev Bar
              </button>
              <div className="text-xs font-mono font-medium text-ink">
                Bar {selectedIndex + 1} of {lineageRecords.length}
              </div>
              <button
                type="button"
                onClick={() => setSelectedIndex((prev) => Math.min(lineageRecords.length - 1, prev + 1))}
                disabled={selectedIndex === lineageRecords.length - 1}
                className="rounded border border-hairline bg-surface-well px-2.5 py-1 text-xs font-semibold text-ink-2 hover:text-ink disabled:opacity-40"
              >
                Next Bar →
              </button>
            </div>

            {/* Decision Status Badges */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="rounded bg-surface-well px-2 py-0.5 border border-hairline text-ink-2">
                T = <strong>{currentRecord.decisionTs}</strong>
              </span>

              <span
                className={cn(
                  "rounded px-2 py-0.5 font-bold uppercase tracking-wider",
                  consensus.finalBias === "bullish"
                    ? "bg-delta-pos/15 text-delta-pos border border-delta-pos/30"
                    : consensus.finalBias === "bearish"
                    ? "bg-delta-neg/15 text-delta-neg border border-delta-neg/30"
                    : "bg-surface-well text-ink-3 border border-hairline",
                )}
              >
                {consensus.finalBias} ({(consensus.finalConfidence * 100).toFixed(0)}% conf)
              </span>

              {isShortCircuit ? (
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold">
                  ⚡ Short-Circuit ($0.00)
                </span>
              ) : isDebateMode ? (
                <span className="rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[11px] font-semibold">
                  💬 Debate Synthesized
                </span>
              ) : isAblationFallback ? (
                <span className="rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 text-[11px] font-semibold">
                  🛡️ Ablation Fallback
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-hairline bg-surface-well px-5">
          <button
            type="button"
            onClick={() => setActiveTab("inputs")}
            className={cn(
              "border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors duration-150",
              activeTab === "inputs"
                ? "border-ink text-ink"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            1. Historical Inputs (≤ T)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("debate")}
            className={cn(
              "border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors duration-150",
              activeTab === "debate"
                ? "border-ink text-ink"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            2. Multi-Agent Debate
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("prompts")}
            className={cn(
              "border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors duration-150",
              activeTab === "prompts"
                ? "border-ink text-ink"
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
                ? "border-ink text-ink"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            4. Execution Fill {currentRecord.executionFill ? "⚡" : ""}
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: HISTORICAL INPUTS */}
          {activeTab === "inputs" ? (
            <div className="space-y-5">
              {/* OHLCV Bar Window */}
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                    OHLCV Bar Window (Input State ≤ {formatDayShort(currentRecord.decisionTs)})
                  </h4>
                  <span className="text-[11px] font-mono text-ink-3">
                    Total Bars in Window: {currentRecord.inputBars.length}
                  </span>
                </div>
                <div className="max-h-48 overflow-auto rounded-lg border border-hairline font-mono text-xs">
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

              {/* Point-in-Time Technical Indicators */}
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-2">
                  Point-in-Time Indicators Snapshot (asOf ≤ T)
                </h4>
                {currentRecord.indicators ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                    <IndicatorCard
                      label="Wilder RSI (14)"
                      value={currentRecord.indicators.rsi?.toFixed(2) ?? "—"}
                      sub={
                        (currentRecord.indicators.rsi ?? 50) >= 70
                          ? "Overbought (Bearish)"
                          : (currentRecord.indicators.rsi ?? 50) <= 30
                          ? "Oversold (Bullish)"
                          : "Neutral Band"
                      }
                    />
                    <IndicatorCard
                      label="SMA (20)"
                      value={currentRecord.indicators.sma20 ? formatMoney(currentRecord.indicators.sma20) : "—"}
                      sub="Short Trend"
                    />
                    <IndicatorCard
                      label="SMA (50)"
                      value={currentRecord.indicators.sma50 ? formatMoney(currentRecord.indicators.sma50) : "—"}
                      sub="Intermediate Trend"
                    />
                    {(() => {
                      const macdHist =
                        currentRecord.indicators.macd !== null && currentRecord.indicators.macdSignal !== null
                          ? currentRecord.indicators.macd - currentRecord.indicators.macdSignal
                          : null;
                      return (
                        <IndicatorCard
                          label="MACD Signal / Hist"
                          value={`${currentRecord.indicators.macd?.toFixed(2) ?? "—"} / ${macdHist !== null ? macdHist.toFixed(2) : "—"}`}
                          sub={
                            (macdHist ?? 0) > 0
                              ? "Bullish Momentum"
                              : "Bearish Momentum"
                          }
                        />
                      );
                    })()}
                  </div>
                ) : (
                  <div className="rounded-lg border border-hairline bg-surface-well p-4 text-xs font-mono text-ink-3">
                    Deterministic indicators snapshot not precomputed for this baseline replay step.
                  </div>
                )}
              </div>

              {/* Point-in-Time News Headlines (≤ T) */}
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                    Benzinga News Stream (Strictly Filtered to publishedAt ≤ {currentRecord.decisionTs})
                  </h4>
                  <span className="text-[11px] font-mono text-ink-3">
                    Items: {currentRecord.news.length}
                  </span>
                </div>
                {currentRecord.news.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {currentRecord.news.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-hairline bg-surface-well/50 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-ink">{item.headline}</span>
                          <span className="shrink-0 font-mono text-[10px] text-ink-3">
                            {item.publishedAt}
                          </span>
                        </div>
                        {item.summary ? (
                          <p className="mt-1 text-[11px] text-ink-2 line-clamp-2">{item.summary}</p>
                        ) : null}
                        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-ink-3">
                          <span>Source: {item.source ?? "Benzinga"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-hairline bg-surface-well p-4 text-xs font-mono text-ink-3">
                    Zero news articles published prior to this decision timestamp ({currentRecord.decisionTs}). Anti-leakage guard verified.
                  </div>
                )}
              </div>

              {/* Point-in-Time SEC EDGAR Fundamentals Disclosures (filedAt ≤ T) */}
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
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
                      <div className="space-y-3">
                        <div className="rounded-lg border border-hairline bg-surface-well/50 p-3 text-xs">
                          <div className="flex items-center justify-between border-b border-hairline pb-2 mb-2">
                            <span className="font-bold text-ink">
                              SEC Form {latestReport.form} ({latestReport.fiscalYear} {latestReport.fiscalPeriod})
                            </span>
                            <span className="font-mono text-[11px] text-ink-3">
                              Filed: {latestReport.filedAt.slice(0, 10)} (Period End: {latestReport.periodEndDate})
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-[11px]">
                            <div>
                              <span className="text-ink-3">Revenue:</span>{" "}
                              <span className="font-semibold text-ink">${(latestReport.revenue / 1e9).toFixed(2)}B</span>
                            </div>
                            <div>
                              <span className="text-ink-3">YoY Growth:</span>{" "}
                              <span className={cn("font-semibold", (latestReport.revenueGrowthYoY ?? 0) >= 0 ? "text-delta-pos" : "text-delta-neg")}>
                                {latestReport.revenueGrowthYoY != null ? `${(latestReport.revenueGrowthYoY * 100).toFixed(1)}%` : "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="text-ink-3">Operating Margin:</span>{" "}
                              <span className="font-semibold text-ink">{(latestReport.operatingMargin * 100).toFixed(1)}%</span>
                            </div>
                            <div>
                              <span className="text-ink-3">Free Cash Flow:</span>{" "}
                              <span className="font-semibold text-ink">${(latestReport.freeCashFlow / 1e9).toFixed(2)}B</span>
                            </div>
                            <div>
                              <span className="text-ink-3">Net Margin:</span>{" "}
                              <span className="font-semibold text-ink">{(latestReport.netMargin * 100).toFixed(1)}%</span>
                            </div>
                            <div>
                              <span className="text-ink-3">Debt/Equity:</span>{" "}
                              <span className="font-semibold text-ink">{latestReport.debtToEquity.toFixed(2)}</span>
                            </div>
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
            </div>
          ) : null}

          {/* TAB 2: DEBATE & CONSENSUS */}
          {activeTab === "debate" ? (
            <div className="space-y-5">
              {/* Specialist Stances Breakdown */}
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                    Specialist Signal Evaluations
                  </h4>
                  <span className="text-[11px] font-mono text-ink-3">
                    Active Specialists: {Object.keys(consensus.specialistVotes).length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(consensus.specialistVotes).map(([agentName, vote]) => {
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
                        className="flex flex-col justify-between rounded-lg border border-hairline bg-surface-well/50 p-3.5 space-y-2.5 overflow-hidden"
                      >
                        <div>
                          <div className="flex items-center justify-between border-b border-hairline pb-2 mb-2">
                            <span className="font-bold text-xs capitalize text-ink">
                              {agentName} Specialist
                            </span>
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 text-[11px] font-mono font-bold uppercase",
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
                          <div className="mt-2 rounded-lg bg-surface p-2.5 font-mono text-[10px] text-ink-3 border border-hairline/60 space-y-1.5 overflow-hidden">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-ink-2 text-[10px] uppercase tracking-wider">
                                Facts & Evidence:
                              </span>
                              <span className="text-[9px] text-ink-3">Ground Truth</span>
                            </div>
                            <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto pr-0.5">
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
                                    className="flex items-baseline justify-between gap-1.5 rounded bg-surface-well/70 px-2 py-0.5 text-[10px] overflow-hidden"
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
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-2">
                  L3 Coordinator Reconciliation Outcome
                </h4>

                {isShortCircuit ? (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs">
                    <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                      <span>✓ Unanimous Consensus Short-Circuit</span>
                    </div>
                    <p className="mt-1 text-ink-2 leading-relaxed">
                      Both Technical and Sentiment specialists aligned on directional bias ({consensus.finalBias}). Reconciled immediately with zero extra LLM token cost ($0.00).
                    </p>
                  </div>
                ) : isDebateMode && synthesis ? (
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                      <div className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <span>💬 Single-Pass Debate Synthesis</span>
                        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-mono uppercase">
                          Driver: {synthesis.primaryDriver}
                        </span>
                      </div>
                      <div className="font-mono text-ink-2">
                        Final Bias: <strong className="uppercase">{synthesis.direction}</strong> ({(synthesis.confidence * 100).toFixed(0)}% conf)
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-ink mb-1">Synthesis Rationale:</div>
                      <p className="text-ink-2 leading-relaxed">{synthesis.rationale}</p>
                    </div>

                    {synthesis.dissentingView ? (
                      <div className="rounded bg-surface p-3 border border-hairline">
                        <div className="font-semibold text-ink-3 text-[11px] mb-1">Dissenting Stance Analysis:</div>
                        <p className="text-ink-2 italic text-[11px]">{synthesis.dissentingView}</p>
                      </div>
                    ) : null}
                  </div>
                ) : isAblationFallback ? (
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 text-xs">
                    <div className="font-bold text-purple-600 dark:text-purple-400">
                      🛡️ Control Ablation Mode (Debate Disabled)
                    </div>
                    <p className="mt-1 text-ink-2 leading-relaxed">
                      Specialists disagreed on directional bias. In debate-off control mode, the coordinator defaulted to neutral abstention (0.0 allocation) to quantify debate value add.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* TAB 3: PROMPTS & RAW COMPLETIONS */}
          {activeTab === "prompts" ? (
            <div className="space-y-4">
              {/* Agent Selector */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                    Agent Target:
                  </span>
                  {availablePromptAgents.map((agentKey) => (
                    <button
                      key={agentKey}
                      type="button"
                      onClick={() => setActivePromptAgent(agentKey)}
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-mono font-medium transition-colors",
                        promptKey === agentKey
                          ? "bg-ink text-page font-bold shadow-xs"
                          : "border border-hairline bg-surface-well text-ink-2 hover:text-ink",
                      )}
                    >
                      {agentKey}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(renderedPrompt, "prompt")}
                    className="rounded border border-hairline bg-surface-well px-2.5 py-1 text-xs font-mono text-ink-2 hover:text-ink transition-colors"
                  >
                    {copiedKey === "prompt" ? "✓ Copied Prompt" : "Copy Prompt"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(rawCompletion, "completion")}
                    className="rounded border border-hairline bg-surface-well px-2.5 py-1 text-xs font-mono text-ink-2 hover:text-ink transition-colors"
                  >
                    {copiedKey === "completion" ? "✓ Copied Completion" : "Copy JSON"}
                  </button>
                </div>
              </div>

              {/* Rendered Prompt Box */}
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                    Exact Rendered User & System Prompt Text
                  </h4>
                  <span className="text-[10px] font-mono text-ink-3">
                    {renderedPrompt.length} characters
                  </span>
                </div>
                <pre className="max-h-56 overflow-auto rounded-lg border border-hairline bg-surface-well p-3 font-mono text-xs text-ink-1 whitespace-pre-wrap leading-relaxed">
                  {renderedPrompt || "// No prompt text recorded for this step."}
                </pre>
              </div>

              {/* Raw Completion / Zod Result Box */}
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                    Raw LLM Completion String & Zod Parsed Schema Contract
                  </h4>
                  {selectedCompletion !== undefined ? (
                    <span className="rounded bg-status-good/15 text-status-good border border-status-good/30 px-1.5 py-0.5 text-[10px] font-mono font-semibold">
                      ✓ Validated @committee/contracts
                    </span>
                  ) : (
                    <span className="rounded bg-surface-well text-ink-3 border border-hairline px-1.5 py-0.5 text-[10px] font-mono font-semibold">
                      No model completions recorded
                    </span>
                  )}
                </div>
                <pre className="max-h-56 overflow-auto rounded-lg border border-hairline bg-surface-well p-3 font-mono text-xs text-ink-1 whitespace-pre leading-relaxed">
                  {rawCompletion || "// No completion payload recorded for this step."}
                </pre>
              </div>
            </div>
          ) : null}

          {/* TAB 4: EXECUTION FILL */}
          {activeTab === "execution" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-2">
                  Simulated Portfolio Order & Execution Fill
                </h4>
                {currentRecord.executionFill ? (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="rounded-lg border border-hairline bg-surface-well p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <div className="text-ink-3 text-[11px]">Execution Time</div>
                        <div className="font-semibold text-ink mt-0.5">{currentRecord.executionFill.ts}</div>
                      </div>
                      <div>
                        <div className="text-ink-3 text-[11px]">Fill Price</div>
                        <div className="font-semibold text-ink mt-0.5">{formatMoney(currentRecord.executionFill.price)}</div>
                      </div>
                      <div>
                        <div className="text-ink-3 text-[11px]">Shares Transacted</div>
                        <div className="font-semibold text-ink mt-0.5">{currentRecord.executionFill.shares.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-ink-3 text-[11px]">Trade Value ($ USD)</div>
                        <div className="font-semibold text-ink mt-0.5">{formatMoney(currentRecord.executionFill.value)}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-well/50 p-3">
                      <div>
                        Position Shift: <span className="text-ink font-semibold">{currentRecord.executionFill.fromPosition}</span> → <span className="text-series font-semibold">{currentRecord.executionFill.toPosition}</span>
                      </div>
                      <div className="text-ink-3">
                        Fee: {formatMoney(currentRecord.executionFill.fee)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-hairline bg-surface-well p-6 text-center text-xs font-mono text-ink-3 space-y-1">
                    <div className="text-ink-2 font-semibold">Position Unchanged (No Trade Emitted)</div>
                    <p>The coordinator signal matched the existing target allocation; zero turnover occurred on this bar.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IndicatorCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-well/60 p-3">
      <div className="text-[11px] text-ink-3 truncate">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] text-ink-3 truncate">{sub}</div>
    </div>
  );
}
