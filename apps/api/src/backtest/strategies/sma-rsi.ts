import { computeIndicatorSnapshots } from "../indicators";
import type { IndicatorSnapshot, PriceBar, SignalType, Strategy } from "../types";

export interface SmaRsiStrategyOptions {
  rsiOverbought?: number;
  rsiOversold?: number;
}

/**
 * Deterministic SMA(20/50) + RSI(14) Baseline Strategy.
 *
 * Rules:
 * - Long (1.0) when `sma20 > sma50` AND `rsi < 70`
 * - Flat (0.0) when `sma20 <= sma50` OR `rsi >= 70`
 * - Flat (0.0) during warmup when indicators are null
 */
export class SmaRsiStrategy implements Strategy {
  public readonly name: string = "sma-rsi";
  private readonly rsiOverbought: number;

  constructor(options?: SmaRsiStrategyOptions) {
    this.rsiOverbought = options?.rsiOverbought ?? 70;
  }

  public generateSignals(
    bars: PriceBar[],
    snapshots?: IndicatorSnapshot[],
  ): SignalType[] {
    if (bars.length === 0) {
      return [];
    }

    // Resolve snapshots: use provided snapshots if length matches, else compute on the fly
    const effectiveSnapshots =
      snapshots && snapshots.length === bars.length
        ? snapshots
        : computeIndicatorSnapshots(bars);

    const snapshotMap = new Map<string, IndicatorSnapshot>();
    for (const snap of effectiveSnapshots) {
      snapshotMap.set(snap.ts, snap);
    }

    return bars.map((bar, i) => {
      const snap = snapshotMap.get(bar.ts) ?? effectiveSnapshots[i];
      if (!snap) {
        return 0.0;
      }

      const { sma20, sma50, rsi } = snap;

      // Null check during warmup period
      if (
        sma20 === null ||
        sma50 === null ||
        rsi === null ||
        Number.isNaN(sma20) ||
        Number.isNaN(sma50) ||
        Number.isNaN(rsi)
      ) {
        return 0.0;
      }

      if (sma20 > sma50 && rsi < this.rsiOverbought) {
        return 1.0;
      }

      return 0.0;
    });
  }
}

export function createSmaRsiStrategy(options?: SmaRsiStrategyOptions): SmaRsiStrategy {
  return new SmaRsiStrategy(options);
}
