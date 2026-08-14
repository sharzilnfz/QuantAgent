import type { IndicatorSnapshot, PriceBar, SignalType, Strategy } from "../types";

/**
 * Buy & Hold Baseline Strategy.
 * Stance is always 1.0 (100% long) across all historical bars.
 */
export class BuyAndHoldStrategy implements Strategy {
  public readonly name: string = "buy-and-hold";

  public generateSignals(bars: PriceBar[], _snapshots?: IndicatorSnapshot[]): SignalType[] {
    return bars.map(() => 1.0);
  }
}

export function createBuyAndHoldStrategy(): BuyAndHoldStrategy {
  return new BuyAndHoldStrategy();
}
