/**
 * Point-in-time Indicator Snapshot Engine.
 *
 * Transforms price bars into IndicatorSnapshot records point-in-time-correctly.
 * Follows the PIT discipline:
 * 1. Filter bars with asOf <= asOfMax BEFORE any calculations run.
 * 2. Sort by ts ascending and deduplicate identical ts (last wins).
 * 3. Each snapshot's asOf is the running maximum of bar.asOf consumed up to that bar.
 */

import type { IndicatorSnapshot, PriceBar, Timeframe } from "@committee/contracts";
import { bollinger, macd, rsi, sma } from "./core.js";

export interface ComputeSnapshotOptions {
  symbol?: string;
  timeframe?: Timeframe;
  asOfMax?: string;
}

export const RSI_LENGTH = 14;
export const MACD_FAST = 12;
export const MACD_SLOW = 26;
export const MACD_SIGNAL = 9;
export const BB_LENGTH = 20;
export const BB_NUM_STD = 2.0;
export const SMA_FAST = 20;
export const SMA_SLOW = 50;

/**
 * Filter, sort, and deduplicate bars before computing indicators.
 */
export function prepareBars(bars: PriceBar[], asOfMax?: string): PriceBar[] {
  if (bars.length === 0) {
    return [];
  }

  let filtered = bars;
  if (asOfMax !== undefined) {
    const boundaryTime = new Date(asOfMax).getTime();
    filtered = bars.filter((bar) => new Date(bar.asOf).getTime() <= boundaryTime);
  }

  if (filtered.length === 0) {
    return [];
  }

  // Stable sort by ts ascending
  const sorted = [...filtered].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  // Deduplicate by ts keeping the last occurrence
  const lastByTs = new Map<string, PriceBar>();
  for (const bar of sorted) {
    lastByTs.set(bar.ts, bar);
  }

  return Array.from(lastByTs.values()).sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  );
}

function nullSafe(val: number | null | undefined): number | null {
  return typeof val === "number" && Number.isFinite(val) ? val : null;
}

/**
 * Computes deterministic indicator snapshots for a list of price bars.
 */
export function computeIndicatorSnapshots(
  bars: PriceBar[],
  options?: ComputeSnapshotOptions,
): IndicatorSnapshot[] {
  const prepared = prepareBars(bars, options?.asOfMax);
  if (prepared.length === 0) {
    return [];
  }

  const firstBar = prepared[0];
  if (!firstBar) {
    return [];
  }

  const resolvedSymbol = options?.symbol ?? firstBar.symbol;
  const resolvedTimeframe = options?.timeframe ?? firstBar.timeframe;

  const closes = prepared.map((bar) => bar.close);

  const rsiSeries = rsi(closes, RSI_LENGTH);
  const macdRes = macd(closes, MACD_FAST, MACD_SLOW, MACD_SIGNAL);
  const bbRes = bollinger(closes, BB_LENGTH, BB_NUM_STD);
  const sma20Series = sma(closes, SMA_FAST);
  const sma50Series = sma(closes, SMA_SLOW);

  // Running max of asOf: snapshot at i has asOf = max(bar.asOf for bar in bars[0..i])
  const runningMaxAsOf: string[] = [];
  let maxAsOfTime = -Infinity;
  let maxAsOfString = firstBar.asOf;

  for (let i = 0; i < prepared.length; i++) {
    const bar = prepared[i];
    if (!bar) continue;
    const barTime = new Date(bar.asOf).getTime();
    if (barTime > maxAsOfTime) {
      maxAsOfTime = barTime;
      maxAsOfString = bar.asOf;
    }
    runningMaxAsOf.push(maxAsOfString);
  }

  const snapshots: IndicatorSnapshot[] = [];
  for (let i = 0; i < prepared.length; i++) {
    const bar = prepared[i];
    if (!bar) continue;
    const asOfStr = runningMaxAsOf[i] ?? maxAsOfString;
    snapshots.push({
      symbol: resolvedSymbol,
      timeframe: resolvedTimeframe,
      ts: bar.ts,
      rsi: nullSafe(rsiSeries[i]),
      macd: nullSafe(macdRes.macd[i]),
      macdSignal: nullSafe(macdRes.signal[i]),
      bbUpper: nullSafe(bbRes.upper[i]),
      bbLower: nullSafe(bbRes.lower[i]),
      sma20: nullSafe(sma20Series[i]),
      sma50: nullSafe(sma50Series[i]),
      asOf: asOfStr,
    });
  }

  return snapshots;
}
