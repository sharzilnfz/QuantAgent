import { calculateFinancialMetrics, safeRound } from "./metrics.js";
import {
  type BacktestOptions,
  type MultiAssetBacktestResult,
  type MultiAssetEquityPoint,
  type MultiAssetStrategy,
  type MultiAssetTrade,
  type PriceBar,
  type SignalType,
  type AssetPositionSnapshot,
} from "@committee/contracts";

function normalizeSignal(signal: SignalType | undefined): number {
  if (signal === undefined) return 0.0;
  if (typeof signal === "number") {
    return Math.max(-1, Math.min(1, signal));
  }
  if (signal === "buy") return 1.0;
  if (signal === "sell") return 0.0;
  if (signal === "neutral") return 0.0;
  return 0.0;
}

export interface MultiAssetSimulatorInput {
  strategy: MultiAssetStrategy;
  universeBars: Record<string, PriceBar[]>;
  options?: BacktestOptions;
}

/**
 * Executes a deterministic point-in-time multi-asset portfolio backtest simulation.
 *
 * Enforces:
 * - Multi-asset chronological bar alignment along a shared timeline.
 * - 1-bar execution delay: signals computed at bar T fill at bar T+1 open prices.
 * - Portfolio-level capital budgeting & cash reserve constraint (sum(targetWeights) <= 1 - cashReserve).
 * - Per-asset 5 bps transaction fees (0.05%) and slippage.
 * - Accurate tracking of cash, per-symbol shares, equity, drawdown, and per-symbol turnover.
 */
export async function runMultiAssetBacktest(
  input: MultiAssetSimulatorInput,
): Promise<MultiAssetBacktestResult> {
  const { strategy, universeBars, options } = input;
  const initialCash = options?.initialCash ?? 100_000;
  const feeBps = options?.feeBps ?? 5;
  const slippageBps = options?.slippageBps ?? 0;
  const annualTradingDays = options?.annualTradingDays ?? 252;
  const cashReserve = options?.cashReserve ?? 0.05; // 5% minimum cash reserve
  const maxInvestableWeight = Math.max(0, 1.0 - cashReserve);

  const feeRate = feeBps / 10_000;
  const slippageRate = slippageBps / 10_000;

  const symbols = Object.keys(universeBars).sort();
  if (symbols.length === 0) {
    const emptyMetrics = calculateFinancialMetrics([], [], initialCash, annualTradingDays);
    return {
      strategy: strategy.name,
      symbols: [],
      ...emptyMetrics,
      trades: [],
      equityCurve: [],
      perAssetTurnover: {},
      perAssetTradeCount: {},
    };
  }

  // 1. Synchronize all timestamps across all universe assets
  const timestampSet = new Set<string>();
  const barMapBySymbolAndTs: Record<string, Map<string, PriceBar>> = {};

  for (const sym of symbols) {
    const map = new Map<string, PriceBar>();
    const bars = universeBars[sym] ?? [];
    for (const b of bars) {
      timestampSet.add(b.ts);
      map.set(b.ts, b);
    }
    barMapBySymbolAndTs[sym] = map;
  }

  const sortedTimestamps = Array.from(timestampSet).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  if (sortedTimestamps.length === 0) {
    const emptyMetrics = calculateFinancialMetrics([], [], initialCash, annualTradingDays);
    return {
      strategy: strategy.name,
      symbols,
      ...emptyMetrics,
      trades: [],
      equityCurve: [],
      perAssetTurnover: {},
      perAssetTradeCount: {},
    };
  }

  // 2. Generate multi-asset signals
  const rawSignalMaps = await Promise.resolve(
    strategy.generateMultiAssetSignals(universeBars),
  );

  // Map signal array to per-timestamp signal maps
  const signalsByTimestamp: Record<string, Record<string, number>> = {};
  for (let t = 0; t < sortedTimestamps.length; t++) {
    const ts = sortedTimestamps[t]!;
    const rawMap = rawSignalMaps[t] ?? {};
    const normMap: Record<string, number> = {};

    // Collect raw positive weights
    let totalPositiveWeight = 0;
    for (const sym of symbols) {
      const sig = normalizeSignal(rawMap[sym]);
      normMap[sym] = sig;
      if (sig > 0) totalPositiveWeight += sig;
    }

    // Normalize weights to satisfy portfolio budget constraint sum(w_i) <= maxInvestableWeight
    if (totalPositiveWeight > maxInvestableWeight) {
      const scale = maxInvestableWeight / totalPositiveWeight;
      for (const sym of symbols) {
        if (normMap[sym]! > 0) {
          normMap[sym] = normMap[sym]! * scale;
        }
      }
    }

    signalsByTimestamp[ts] = normMap;
  }

  // State
  let cash = initialCash;
  const currentShares: Record<string, number> = {};
  const currentWeights: Record<string, number> = {};
  const lastKnownPrices: Record<string, number> = {};
  const perAssetTurnover: Record<string, number> = {};
  const perAssetTradeCount: Record<string, number> = {};

  for (const sym of symbols) {
    currentShares[sym] = 0;
    currentWeights[sym] = 0;
    perAssetTurnover[sym] = 0;
    perAssetTradeCount[sym] = 0;
  }

  let peakEquity = initialCash;
  const trades: MultiAssetTrade[] = [];
  const equityCurve: MultiAssetEquityPoint[] = [];

  // Simulation Loop
  for (let t = 0; t < sortedTimestamps.length; t++) {
    const ts = sortedTimestamps[t]!;
    const prevTs = t > 0 ? sortedTimestamps[t - 1] : undefined;

    // 1-bar execution delay: execute signals emitted at prevTs at current bar open prices
    if (prevTs && t > 0) {
      const targetWeights = signalsByTimestamp[prevTs] ?? {};

      // Estimate total portfolio value at open
      let openPortfolioValue = cash;
      for (const sym of symbols) {
        const bar = barMapBySymbolAndTs[sym]?.get(ts);
        const openPrice = bar ? (bar.open > 0 ? bar.open : bar.close) : lastKnownPrices[sym] ?? 0;
        openPortfolioValue += (currentShares[sym] ?? 0) * openPrice;
      }

      // Execute Sells first to free up cash
      for (const sym of symbols) {
        const bar = barMapBySymbolAndTs[sym]?.get(ts);
        if (!bar) continue;
        const openPrice = bar.open > 0 ? bar.open : bar.close;
        if (openPrice <= 0) continue;

        const targetWeight = targetWeights[sym] ?? 0;
        const currentWeight = currentWeights[sym] ?? 0;
        if (Math.abs(targetWeight - currentWeight) <= 1e-6) continue;

        const targetValue = openPortfolioValue * Math.max(0, targetWeight);
        const targetShareCount = Math.floor(targetValue / openPrice);
        const currentShareCount = currentShares[sym] ?? 0;
        const deltaShares = targetShareCount - currentShareCount;

        if (deltaShares < -1e-7) {
          const sharesToSell = Math.min(currentShareCount, Math.abs(deltaShares));
          if (sharesToSell > 1e-7) {
            const execPrice = openPrice * (1 - slippageRate);
            const tradeValue = sharesToSell * execPrice;
            const fee = tradeValue * feeRate;
            cash += tradeValue - fee;
            currentShares[sym] = Math.max(0, (currentShares[sym] ?? 0) - sharesToSell);

            trades.push({
              symbol: sym,
              ts,
              price: safeRound(execPrice, 4),
              fromPosition: safeRound(currentWeight, 4),
              toPosition: safeRound(targetWeight, 4),
              shares: safeRound(sharesToSell, 6),
              value: safeRound(tradeValue, 4),
              fee: safeRound(fee, 4),
            });

            perAssetTurnover[sym] = (perAssetTurnover[sym] ?? 0) + tradeValue / initialCash;
            perAssetTradeCount[sym] = (perAssetTradeCount[sym] ?? 0) + 1;
            currentWeights[sym] = targetWeight;
          }
        }
      }

      // Execute Buys second with available cash
      for (const sym of symbols) {
        const bar = barMapBySymbolAndTs[sym]?.get(ts);
        if (!bar) continue;
        const openPrice = bar.open > 0 ? bar.open : bar.close;
        if (openPrice <= 0) continue;

        const targetWeight = targetWeights[sym] ?? 0;
        const currentWeight = currentWeights[sym] ?? 0;
        if (Math.abs(targetWeight - currentWeight) <= 1e-6) continue;

        const targetValue = openPortfolioValue * Math.max(0, targetWeight);
        const targetShareCount = Math.floor(targetValue / openPrice);
        const currentShareCount = currentShares[sym] ?? 0;
        const deltaShares = targetShareCount - currentShareCount;

        if (deltaShares > 1e-7) {
          const execPrice = openPrice * (1 + slippageRate);
          const maxSharesAffordable = cash > 0 ? Math.floor(cash / (execPrice * (1 + feeRate))) : 0;
          const sharesToBuy = Math.min(deltaShares, Math.max(0, maxSharesAffordable));

          if (sharesToBuy > 1e-7) {
            const tradeValue = sharesToBuy * execPrice;
            const fee = tradeValue * feeRate;
            cash -= tradeValue + fee;
            currentShares[sym] = (currentShares[sym] ?? 0) + sharesToBuy;

            trades.push({
              symbol: sym,
              ts,
              price: safeRound(execPrice, 4),
              fromPosition: safeRound(currentWeight, 4),
              toPosition: safeRound(targetWeight, 4),
              shares: safeRound(sharesToBuy, 6),
              value: safeRound(tradeValue, 4),
              fee: safeRound(fee, 4),
            });

            perAssetTurnover[sym] = (perAssetTurnover[sym] ?? 0) + tradeValue / initialCash;
            perAssetTradeCount[sym] = (perAssetTradeCount[sym] ?? 0) + 1;
            currentWeights[sym] = targetWeight;
          }
        }
      }
    }

    // Close of Bar T: calculate portfolio market value and equity point
    let totalInvestedValue = 0;
    const positionsMap: Record<string, AssetPositionSnapshot> = {};

    for (const sym of symbols) {
      const bar = barMapBySymbolAndTs[sym]?.get(ts);
      if (bar) {
        lastKnownPrices[sym] = bar.close;
      }
      const closePrice = lastKnownPrices[sym] ?? 0;
      const sh = currentShares[sym] ?? 0;
      const mktVal = sh * closePrice;
      totalInvestedValue += mktVal;

      positionsMap[sym] = {
        symbol: sym,
        shares: sh,
        price: safeRound(closePrice, 4),
        marketValue: safeRound(mktVal, 4),
        weight: 0, // calculated below after total equity
      };
    }

    const totalEquity = cash + totalInvestedValue;
    if (totalEquity > peakEquity) {
      peakEquity = totalEquity;
    }

    const drawdown = peakEquity > 0 ? (totalEquity - peakEquity) / peakEquity : 0;
    const cashWeight = totalEquity > 0 ? cash / totalEquity : 1.0;

    // Update weights in positions map
    for (const sym of symbols) {
      const p = positionsMap[sym]!;
      p.weight = totalEquity > 0 ? safeRound(p.marketValue / totalEquity, 4) : 0;
    }

    equityCurve.push({
      ts,
      cash: safeRound(cash, 4),
      cashWeight: safeRound(cashWeight, 4),
      totalEquity: safeRound(totalEquity, 4),
      drawdown: safeRound(drawdown, 6),
      positions: positionsMap,
    });
  }

  // Convert multi-asset equity curve format to standard format for financial metrics calculation
  const simpleEquityCurve = equityCurve.map((pt) => ({
    ts: pt.ts,
    cash: pt.cash,
    position: 1.0 - pt.cashWeight,
    price: pt.totalEquity,
    equity: pt.totalEquity,
    drawdown: pt.drawdown,
  }));

  const metrics = calculateFinancialMetrics(
    simpleEquityCurve,
    trades,
    initialCash,
    annualTradingDays,
  );

  return {
    strategy: strategy.name,
    symbols,
    ...metrics,
    trades,
    equityCurve,
    perAssetTurnover,
    perAssetTradeCount,
  };
}
