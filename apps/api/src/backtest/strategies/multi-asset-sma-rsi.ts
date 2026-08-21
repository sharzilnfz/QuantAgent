import { computeIndicatorSnapshots } from "../../indicators/index.js";
import { SmaRsiStrategy, type SmaRsiStrategyOptions } from "./sma-rsi.js";
import type {
  IndicatorSnapshot,
  MultiAssetStrategy,
  PriceBar,
  SignalType,
} from "@committee/contracts";

/**
 * Multi-Asset SMA(20/50) + RSI(14) Baseline Strategy.
 * Generates independent technical signals per asset in the universe and allocates equal fraction of capital across active assets.
 */
export class MultiAssetSmaRsiStrategy implements MultiAssetStrategy {
  readonly name: string;
  private readonly singleStrategies: Record<string, SmaRsiStrategy> = {};

  constructor(options?: SmaRsiStrategyOptions & { name?: string }) {
    this.name = options?.name ?? "multi-asset-sma-rsi";
  }

  generateMultiAssetSignals(
    universeBars: Record<string, PriceBar[]>,
    snapshotsBySymbol?: Record<string, IndicatorSnapshot[]>,
  ): Record<string, SignalType>[] {
    const symbols = Object.keys(universeBars).sort();
    if (symbols.length === 0) return [];

    // Find chronological timeline
    const timestampSet = new Set<string>();
    for (const sym of symbols) {
      const bars = universeBars[sym] ?? [];
      for (const b of bars) timestampSet.add(b.ts);
    }
    const sortedTimestamps = Array.from(timestampSet).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

    // Compute single-asset signals per symbol
    const signalsBySymbolAndTs: Record<string, Map<string, number>> = {};

    for (const sym of symbols) {
      const bars = universeBars[sym] ?? [];
      const snapshots = snapshotsBySymbol?.[sym] ?? computeIndicatorSnapshots(bars);
      const strat = this.singleStrategies[sym] ?? new SmaRsiStrategy();
      this.singleStrategies[sym] = strat;

      const sigs = strat.generateSignals(bars, snapshots);
      const map = new Map<string, number>();
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i]!;
        const s = sigs[i];
        const numVal = typeof s === "number" ? s : s === "buy" ? 1.0 : 0.0;
        map.set(b.ts, numVal);
      }
      signalsBySymbolAndTs[sym] = map;
    }

    // Produce multi-asset signal maps per timestamp
    return sortedTimestamps.map((ts) => {
      const result: Record<string, SignalType> = {};
      let activeCount = 0;

      for (const sym of symbols) {
        const sig = signalsBySymbolAndTs[sym]?.get(ts) ?? 0;
        if (sig > 0) activeCount++;
      }

      const weightPerActive = activeCount > 0 ? 1.0 / activeCount : 0.0;

      for (const sym of symbols) {
        const sig = signalsBySymbolAndTs[sym]?.get(ts) ?? 0;
        result[sym] = sig > 0 ? weightPerActive : 0.0;
      }

      return result;
    });
  }
}
