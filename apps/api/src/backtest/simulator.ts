import { calculateFinancialMetrics, safeRound } from "./metrics";
import type {
  BacktestOptions,
  BacktestResult,
  EquityPoint,
  PriceBar,
  SignalType,
  Strategy,
  Trade,
} from "./types";

function normalizeSignal(signal: SignalType): number {
  if (typeof signal === "number") {
    return Math.max(-1, Math.min(1, signal));
  }
  if (signal === "buy") return 1.0;
  if (signal === "sell") return 0.0;
  if (signal === "neutral") return 0.0;
  return 0.0;
}

/**
 * Execute a deterministic point-in-time backtest simulation.
 *
 * Enforces:
 * - 1-bar execution delay: signal computed at bar T is filled at bar T+1 open price.
 * - Transaction cost deduction: feeBps * tradeValue (default 5 bps = 0.05%).
 * - Slippage modeling if configured.
 * - Point-in-time causal ordering.
 */
export async function runBacktest(
  strategy: Strategy,
  bars: PriceBar[],
  options?: BacktestOptions,
): Promise<BacktestResult> {
  const initialCash = options?.initialCash ?? 100_000;
  const feeBps = options?.feeBps ?? 5;
  const slippageBps = options?.slippageBps ?? 0;
  const annualTradingDays = options?.annualTradingDays ?? 252;
  const feeRate = feeBps / 10_000;
  const slippageRate = slippageBps / 10_000;

  if (bars.length === 0) {
    const emptyMetrics = calculateFinancialMetrics([], [], initialCash, annualTradingDays);
    return {
      strategy: strategy.name,
      ...emptyMetrics,
      trades: [],
      equityCurve: [],
    };
  }

  // Sort bars chronologically
  const sortedBars = [...bars].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  );

  // Strategy generates signals at each bar T
  const rawSignals = await Promise.resolve(strategy.generateSignals(sortedBars));
  const signals = rawSignals.map(normalizeSignal);

  let cash = initialCash;
  let shares = 0;
  let peakEquity = initialCash;
  let currentTargetWeight = 0;

  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];

  for (let t = 0; t < sortedBars.length; t++) {
    const bar = sortedBars[t];
    if (!bar) continue;

    // 1-bar execution delay: execute signal from bar t - 1 at bar t open
    if (t > 0) {
      const prevSignal = signals[t - 1];
      const targetWeight: number = prevSignal !== undefined ? prevSignal : 0;
      const baseOpenPrice = bar.open > 0 ? bar.open : bar.close;

      if (Math.abs(targetWeight - currentTargetWeight) > 1e-6) {
        const portfolioValueBefore = cash + shares * baseOpenPrice;
        const targetValue = Math.max(0, portfolioValueBefore * targetWeight);
        const targetShares = baseOpenPrice > 0 ? targetValue / baseOpenPrice : 0;
        const deltaShares = targetShares - shares;

        if (deltaShares > 1e-7) {
          // BUY
          const execPrice = baseOpenPrice * (1 + slippageRate);
          const maxSharesAffordable =
            cash > 0 ? cash / (execPrice * (1 + feeRate)) : 0;
          const sharesToBuy = Math.min(deltaShares, Math.max(0, maxSharesAffordable));

          if (sharesToBuy > 1e-7) {
            const tradeValue = sharesToBuy * execPrice;
            const fee = tradeValue * feeRate;
            cash -= tradeValue + fee;
            shares += sharesToBuy;

            trades.push({
              ts: bar.ts,
              price: safeRound(execPrice, 4),
              fromPosition: safeRound(currentTargetWeight, 4),
              toPosition: safeRound(targetWeight, 4),
              shares: safeRound(sharesToBuy, 6),
              value: safeRound(tradeValue, 4),
              fee: safeRound(fee, 4),
            });
            currentTargetWeight = targetWeight;
          }
        } else if (deltaShares < -1e-7) {
          // SELL
          const execPrice = baseOpenPrice * (1 - slippageRate);
          const sharesToSell = Math.min(shares, Math.abs(deltaShares));

          if (sharesToSell > 1e-7) {
            const tradeValue = sharesToSell * execPrice;
            const fee = tradeValue * feeRate;
            cash += tradeValue - fee;
            shares -= sharesToSell;
            if (shares < 1e-7) {
              shares = 0;
            }

            trades.push({
              ts: bar.ts,
              price: safeRound(execPrice, 4),
              fromPosition: safeRound(currentTargetWeight, 4),
              toPosition: safeRound(targetWeight, 4),
              shares: safeRound(sharesToSell, 6),
              value: safeRound(tradeValue, 4),
              fee: safeRound(fee, 4),
            });
            currentTargetWeight = targetWeight;
          }
        }
      }
    }

    // Bar Close: evaluate portfolio state and equity
    const closePrice = bar.close;
    const equity = cash + shares * closePrice;

    if (equity > peakEquity) {
      peakEquity = equity;
    }

    const drawdown = peakEquity > 0 ? (equity - peakEquity) / peakEquity : 0;
    const positionFraction = equity > 0 ? (shares * closePrice) / equity : 0;

    equityCurve.push({
      ts: bar.ts,
      cash: safeRound(cash, 4),
      position: safeRound(positionFraction, 4),
      price: safeRound(closePrice, 4),
      equity: safeRound(equity, 4),
      drawdown: safeRound(drawdown, 6),
    });
  }

  const metrics = calculateFinancialMetrics(
    equityCurve,
    trades,
    initialCash,
    annualTradingDays,
  );

  return {
    strategy: strategy.name,
    ...metrics,
    trades,
    equityCurve,
  };
}
