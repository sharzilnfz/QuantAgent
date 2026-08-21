/**
 * Live Market Signals & Indicator Radar (`/signals`).
 *
 * Impeccable Operate Mode:
 *  - Real-time technical indicator gauges (Wilder RSI, MACD, Bollinger Bands, SMA 20/50)
 *  - Live specialist agent stance matrix (Technical, Sentiment, Fundamental, Polymarket)
 *  - Multi-agent consensus resolution outcome and deterministic risk gate preview
 *  - On-demand deliberation trigger with live feedback
 *  - High data density, accessible table twins, and crisp hairline styling
 */
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import type { LiveSignalRadarItem } from "@committee/contracts";
import { useSignalsRadar, useEvaluateSignalMutation } from "../lib/queries";
import { useMarketStream } from "../lib/useMarketStream";
import { DaemonControlCard } from "../components/daemon/DaemonControlCard";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner, ErrorState } from "../components/ui/States";
import { formatDayShort, formatMoney } from "../lib/format";
import { cn } from "../lib/cn";

const AVAILABLE_SYMBOLS = ["AAPL", "NVDA", "SPY"];

export function SignalsPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>("AAPL");
  const [evaluateSuccess, setEvaluateSuccess] = useState(false);

  const { data: radarData, isLoading, error, refetch, isFetching } = useSignalsRadar(AVAILABLE_SYMBOLS);
  const evaluateMutation = useEvaluateSignalMutation();
  const stream = useMarketStream({ symbols: AVAILABLE_SYMBOLS, enabled: true });

  const currentItem: LiveSignalRadarItem | undefined = useMemo(() => {
    if (!radarData?.items) return undefined;
    return radarData.items.find((it) => it.symbol.toUpperCase() === selectedSymbol.toUpperCase()) ?? radarData.items[0];
  }, [radarData, selectedSymbol]);

  const handleEvaluate = async () => {
    if (!currentItem) return;
    try {
      await evaluateMutation.mutateAsync({
        symbol: currentItem.symbol,
        debateEnabled: true,
      });
      setEvaluateSuccess(true);
      setTimeout(() => setEvaluateSuccess(false), 3000);
      void refetch();
    } catch {
      // Error handled by mutation state
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 rounded-xl border border-hairline bg-surface p-8">
        <Spinner className="h-7 w-7 text-series" />
        <p className="text-sm font-medium text-ink-2">Loading live market signals & indicator telemetry…</p>
        <p className="text-xs text-ink-3">Computing Wilder RSI, MACD, Bollinger Bands, and specialist stances</p>
      </div>
    );
  }

  if (error || !radarData) {
    return (
      <ErrorState
        title="Failed to load live signals radar"
        detail={error instanceof Error ? error.message : "Unable to retrieve indicator radar feed."}
        onRetry={() => void refetch()}
      />
    );
  }

  const ind = currentItem?.indicators;
  const bar = currentItem?.currentBar;
  const consensus = currentItem?.consensus;

  // Derived indicator values for display
  const rsi = ind?.rsi ?? 50;
  const macdVal = ind?.macd ?? 0;
  const macdSig = ind?.macdSignal ?? 0;
  const macdHist = macdVal - macdSig;
  const bbUpper = ind?.bbUpper ?? (bar ? bar.close * 1.05 : 0);
  const bbLower = ind?.bbLower ?? (bar ? bar.close * 0.95 : 0);
  const sma20 = ind?.sma20;
  const sma50 = ind?.sma50;

  return (
    <div className="space-y-6 pb-12 enter">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Live Signals & Indicator Radar
            </h1>
            <span className="rounded bg-series/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-series">
              Real-Time Radar
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-2 sm:text-sm">
            Point-in-time technical indicator gauges, specialist agent readings, and on-demand deliberation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {stream.connected && (
            <div className="flex items-center gap-1.5 rounded-full bg-delta-pos/10 border border-delta-pos/30 px-2.5 py-1 text-xs font-mono text-delta-pos">
              <span className="h-1.5 w-1.5 rounded-full bg-delta-pos animate-pulse" />
              <span>WebSocket Stream Active</span>
            </div>
          )}

          {isFetching && !isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-ink-3">
              <Spinner className="h-3.5 w-3.5" />
              <span>Streaming updates…</span>
            </div>
          )}

          {evaluateSuccess && (
            <span className="flex items-center gap-1 text-xs font-semibold text-status-good">
              ✓ Deliberation completed
            </span>
          )}

          <Button
            variant="primary"
            onClick={() => void handleEvaluate()}
            disabled={evaluateMutation.isPending}
            className="flex items-center gap-1.5 text-xs shadow-xs"
          >
            {evaluateMutation.isPending ? (
              <>
                <Spinner className="h-3.5 w-3.5" />
                <span>Evaluating Committee…</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Evaluate {selectedSymbol} On-Demand</span>
              </>
            )}
          </Button>

          <Link to="/observatory">
            <Button variant="ghost" className="text-xs">
              Observatory Lab →
            </Button>
          </Link>
        </div>
      </div>

      {/* Autonomous Background Trading Daemon HUD */}
      <DaemonControlCard />

      {/* Asset Selector Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Active Asset:</span>
          <div className="flex gap-1.5">
            {AVAILABLE_SYMBOLS.map((sym) => {
              const active = sym.toUpperCase() === selectedSymbol.toUpperCase();
              const itemForSym = radarData.items.find((it) => it.symbol.toUpperCase() === sym.toUpperCase());
              const bias = itemForSym?.consensus.finalBias ?? "neutral";

              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setSelectedSymbol(sym)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                    active
                      ? "border-series/50 bg-series/10 text-series shadow-xs"
                      : "border-hairline bg-surface-well/60 text-ink-2 hover:bg-surface-well hover:text-ink",
                  )}
                >
                  <span>{sym}</span>
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      bias === "bullish"
                        ? "bg-delta-pos"
                        : bias === "bearish"
                        ? "bg-delta-neg"
                        : "bg-ink-3/40",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {bar && (
          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-ink-3">Last Close: </span>
              <strong className="text-ink text-sm">{formatMoney(bar.close)}</strong>
            </div>
            <div>
              <span className="text-ink-3">Volume: </span>
              <span className="text-ink-2">{bar.volume.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-ink-3">As Of: </span>
              <span className="text-ink-2">{formatDayShort(bar.asOf)}</span>
            </div>
          </div>
        )}
      </div>

      {currentItem ? (
        <div className="space-y-6">
          {/* Top Row: Technical Indicator Gauges */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-3">
              1. Technical Indicator Telemetry (L1 Deterministic Math)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Gauge 1: Wilder RSI */}
              <Card>
                <CardHeader
                  title="Wilder RSI (14)"
                  description="Momentum & exhaustion oscillator"
                  actions={
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase",
                        currentItem.rsiZone === "oversold"
                          ? "bg-delta-pos/15 text-delta-pos"
                          : currentItem.rsiZone === "overbought"
                          ? "bg-delta-neg/15 text-delta-neg"
                          : "bg-surface-well text-ink-3 border border-hairline",
                      )}
                    >
                      {currentItem.rsiZone}
                    </span>
                  }
                />
                <CardBody className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono text-ink">
                      {rsi.toFixed(1)}
                    </span>
                    <span className="text-xs font-mono text-ink-3">Range: 0–100</span>
                  </div>

                  {/* Visual RSI bar */}
                  <div className="space-y-1">
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-well border border-hairline">
                      {/* Oversold zone highlight (<30) */}
                      <div className="absolute left-0 top-0 bottom-0 w-[30%] bg-delta-pos/20 border-r border-delta-pos/40" />
                      {/* Overbought zone highlight (>70) */}
                      <div className="absolute right-0 top-0 bottom-0 w-[30%] bg-delta-neg/20 border-l border-delta-neg/40" />
                      {/* Current marker */}
                      <div
                        className="absolute top-0 bottom-0 w-1.5 bg-ink rounded-full transition-all duration-300 -ml-0.5"
                        style={{ left: `${Math.min(100, Math.max(0, rsi))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-ink-3">
                      <span>0 (Oversold ≤30)</span>
                      <span>50</span>
                      <span>100 (Overbought ≥70)</span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Gauge 2: MACD Trend */}
              <Card>
                <CardHeader
                  title="MACD (12, 26, 9)"
                  description="Moving Average Convergence"
                  actions={
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase",
                        currentItem.macdCross === "bullish"
                          ? "bg-delta-pos/15 text-delta-pos"
                          : currentItem.macdCross === "bearish"
                          ? "bg-delta-neg/15 text-delta-neg"
                          : "bg-surface-well text-ink-3 border border-hairline",
                      )}
                    >
                      {currentItem.macdCross} cross
                    </span>
                  }
                />
                <CardBody className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between border-b border-hairline pb-1.5">
                    <span className="text-ink-3">MACD Line:</span>
                    <span className="font-semibold text-ink">{macdVal.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between border-b border-hairline pb-1.5">
                    <span className="text-ink-3">Signal Line (EMA9):</span>
                    <span className="font-semibold text-ink">{macdSig.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-0.5">
                    <span className="text-ink-3">Divergence Histogram:</span>
                    <span
                      className={cn(
                        "font-bold",
                        macdHist >= 0 ? "text-delta-pos" : "text-delta-neg",
                      )}
                    >
                      {macdHist >= 0 ? `+${macdHist.toFixed(3)}` : macdHist.toFixed(3)}
                    </span>
                  </div>
                </CardBody>
              </Card>

              {/* Gauge 3: Bollinger Bands */}
              <Card>
                <CardHeader
                  title="Bollinger Bands (20, 2σ)"
                  description="Volatility envelope"
                  actions={
                    <span className="text-[10px] font-mono text-ink-3 uppercase">
                      Population σ
                    </span>
                  }
                />
                <CardBody className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between border-b border-hairline pb-1.5">
                    <span className="text-ink-3">Upper Band (+2σ):</span>
                    <span className="font-semibold text-ink">{formatMoney(bbUpper)}</span>
                  </div>
                  <div className="flex justify-between border-b border-hairline pb-1.5">
                    <span className="text-ink-3">Lower Band (-2σ):</span>
                    <span className="font-semibold text-ink">{formatMoney(bbLower)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-0.5">
                    <span className="text-ink-3">Bandwidth Spread:</span>
                    <span className="font-bold text-ink">
                      {bbLower > 0 ? `${(((bbUpper - bbLower) / bbLower) * 100).toFixed(1)}%` : "N/A"}
                    </span>
                  </div>
                </CardBody>
              </Card>

              {/* Gauge 4: Moving Average Trend */}
              <Card>
                <CardHeader
                  title="Trend Alignment"
                  description="SMA 20 & SMA 50 structure"
                  actions={
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase",
                        currentItem.trend === "bullish"
                          ? "bg-delta-pos/15 text-delta-pos"
                          : currentItem.trend === "bearish"
                          ? "bg-delta-neg/15 text-delta-neg"
                          : "bg-surface-well text-ink-3 border border-hairline",
                      )}
                    >
                      {currentItem.trend}
                    </span>
                  }
                />
                <CardBody className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between border-b border-hairline pb-1.5">
                    <span className="text-ink-3">SMA 20 (Fast):</span>
                    <span className="font-semibold text-ink">
                      {sma20 != null ? formatMoney(sma20) : "Warming up"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-hairline pb-1.5">
                    <span className="text-ink-3">SMA 50 (Slow):</span>
                    <span className="font-semibold text-ink">
                      {sma50 != null ? formatMoney(sma50) : "Warming up"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-0.5">
                    <span className="text-ink-3">Cross Status:</span>
                    <span className="font-bold text-ink">
                      {sma20 && sma50
                        ? sma20 > sma50
                          ? "Golden Crossover"
                          : "Death Crossover"
                        : "Neutral"}
                    </span>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>

          {/* Middle Row: Specialist Agents Live Stances */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                2. Specialist Agent Signal Stances (L2 Specialists)
              </h2>
              <span className="text-xs font-mono text-ink-3">
                Active Specialists: {Object.keys(currentItem.specialistVotes).length}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(currentItem.specialistVotes).map(([agentName, vote]) => (
                <div
                  key={agentName}
                  className="flex flex-col justify-between rounded-xl border border-hairline bg-surface p-4 shadow-xs space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-hairline pb-2 mb-2">
                      <span className="font-bold text-sm capitalize text-ink">
                        {agentName}
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
                        {vote.direction}
                      </span>
                    </div>

                    <div className="space-y-1 mb-2">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-ink-3">Confidence:</span>
                        <span className="font-bold text-ink">{(vote.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-well overflow-hidden border border-hairline">
                        <div
                          className="h-full bg-ink rounded-full"
                          style={{ width: `${Math.round(vote.confidence * 100)}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-ink-2 leading-relaxed line-clamp-3">
                      {vote.rationale}
                    </p>
                  </div>

                  <div className="rounded bg-surface-well/50 p-2 border border-hairline font-mono text-[10px] text-ink-3 flex items-center justify-between">
                    <span>Evidence facts:</span>
                    <span>{Object.keys(vote.evidence).length} metrics</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Row: L3 Coordinator Consensus & News Headline */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Consensus Resolution Card */}
            <Card className="lg:col-span-2">
              <CardHeader
                title="L3 Multi-Agent Coordinator Consensus"
                description="Final synthesized trade stance and resolution mode."
                actions={
                  <span className="rounded bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                    {consensus?.mode === "consensus_short_circuit"
                      ? "⚡ Consensus Fast-Pass"
                      : consensus?.mode === "debate_synthesis"
                      ? "💬 Debate Synthesized"
                      : "Ablation Neutral Fallback"}
                  </span>
                }
              />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-well/50 p-4">
                  <div>
                    <span className="text-xs text-ink-3">Consensus Final Bias:</span>
                    <div className="text-lg font-bold uppercase font-mono text-ink mt-0.5">
                      {consensus?.finalBias} ({(consensus?.finalConfidence ? consensus.finalConfidence * 100 : 0).toFixed(0)}% Confidence)
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-ink-3">Resolution Cost:</span>
                    <div className="text-sm font-bold font-mono text-ink mt-0.5">
                      ${Number(consensus?.metadata?.tokenCost ?? 0).toFixed(4)} USD
                    </div>
                  </div>
                </div>

                {consensus?.synthesis ? (
                  <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs">
                    <div className="font-semibold text-blue-600 dark:text-blue-400">
                      Debate Synthesis Rationale:
                    </div>
                    <p className="text-ink-2 leading-relaxed">{consensus.synthesis.rationale}</p>
                    {consensus.synthesis.dissentingView && (
                      <div className="mt-2 border-t border-blue-500/20 pt-2 text-ink-3 italic">
                        Dissenting View: {consensus.synthesis.dissentingView}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-ink-2">
                    Specialists reached natural majority directional consensus without requiring single-pass LLM debate synthesis.
                  </p>
                )}
              </CardBody>
            </Card>

            {/* News Headline Snapshot */}
            <Card>
              <CardHeader
                title="Latest News Headline"
                description="Benzinga archive headline <= asOf"
              />
              <CardBody className="space-y-3">
                {currentItem.newsHeadline ? (
                  <div className="rounded-lg border border-hairline bg-surface-well/50 p-3.5 text-xs space-y-2">
                    <div className="font-semibold text-ink leading-relaxed">
                      &ldquo;{currentItem.newsHeadline}&rdquo;
                    </div>
                    <div className="font-mono text-[10px] text-ink-3">
                      Source: Benzinga Financial Archive
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-ink-3">
                    Zero headlines recorded prior to this decision timestamp.
                  </p>
                )}

                <div className="border-t border-hairline pt-3">
                  <Link to={`/lineage?symbol=${selectedSymbol}`}>
                    <Button variant="ghost" className="w-full text-xs">
                      Audit Full Input Lineage →
                    </Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Accessible Table Twin (WCAG Compliance) */}
          <details className="rounded-xl border border-hairline bg-surface p-4 text-xs">
            <summary className="font-semibold cursor-pointer text-ink hover:text-series transition-colors">
              Accessible Table View: Raw Indicator & Price Bar Values (WCAG Twin)
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-hairline bg-surface-well text-ink-2">
                    <th className="p-2">Metric</th>
                    <th className="p-2">Value</th>
                    <th className="p-2">Threshold / Range</th>
                    <th className="p-2">Signal Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-hairline">
                    <td className="p-2 font-semibold">Wilder RSI(14)</td>
                    <td className="p-2">{rsi.toFixed(2)}</td>
                    <td className="p-2">&le;30 Oversold, &ge;70 Overbought</td>
                    <td className="p-2 capitalize">{currentItem.rsiZone}</td>
                  </tr>
                  <tr className="border-b border-hairline">
                    <td className="p-2 font-semibold">MACD (12, 26, 9)</td>
                    <td className="p-2">Line: {macdVal.toFixed(3)} | Sig: {macdSig.toFixed(3)}</td>
                    <td className="p-2">Hist: {macdHist.toFixed(3)}</td>
                    <td className="p-2 capitalize">{currentItem.macdCross} Crossover</td>
                  </tr>
                  <tr className="border-b border-hairline">
                    <td className="p-2 font-semibold">Bollinger Bands (20, 2σ)</td>
                    <td className="p-2">Upper: {formatMoney(bbUpper)} | Lower: {formatMoney(bbLower)}</td>
                    <td className="p-2">Price: {formatMoney(bar?.close ?? 0)}</td>
                    <td className="p-2">Within 2σ Envelope</td>
                  </tr>
                  <tr className="border-b border-hairline">
                    <td className="p-2 font-semibold">SMA 20 / 50</td>
                    <td className="p-2">SMA20: {sma20 ? formatMoney(sma20) : "N/A"} | SMA50: {sma50 ? formatMoney(sma50) : "N/A"}</td>
                    <td className="p-2">{sma20 && sma50 && sma20 > sma50 ? "SMA20 > SMA50" : "SMA20 < SMA50"}</td>
                    <td className="p-2 capitalize">{currentItem.trend} Trend</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
