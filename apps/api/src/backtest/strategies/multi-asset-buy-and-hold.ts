import type {
  MultiAssetStrategy,
  PriceBar,
  SignalType,
} from "@committee/contracts";

/**
 * Multi-Asset 1/N Equal-Weight Buy & Hold Benchmark.
 * Allocates 1/N equal weight to each asset in the universe on day 1 and holds.
 */
export class MultiAssetBuyAndHoldStrategy implements MultiAssetStrategy {
  readonly name: string;

  constructor(name = "multi-asset-equal-weight-basket") {
    this.name = name;
  }

  generateMultiAssetSignals(
    universeBars: Record<string, PriceBar[]>,
  ): Record<string, SignalType>[] {
    const symbols = Object.keys(universeBars).sort();
    const n = symbols.length;
    if (n === 0) return [];

    // Find the longest series of timestamps
    const timestampSet = new Set<string>();
    for (const sym of symbols) {
      const bars = universeBars[sym] ?? [];
      for (const b of bars) timestampSet.add(b.ts);
    }
    const sortedTimestamps = Array.from(timestampSet).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

    const equalWeight = 1.0 / n;
    const signalMap: Record<string, SignalType> = {};
    for (const sym of symbols) {
      signalMap[sym] = equalWeight;
    }

    return sortedTimestamps.map(() => ({ ...signalMap }));
  }
}
