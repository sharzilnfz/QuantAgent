import type {
  EquityPoint,
  FinancialMetrics,
  Trade,
  PriceBar,
  SignalType,
  DecisionIntelligenceMetrics,
} from "./types";

export interface DecisionSignal {
  signal: SignalType;
  confidence?: number | null;
}

/**
 * Safe rounding helper to eliminate floating point noise (e.g. 0.10000000000000002 -> 0.1).
 */
export function safeRound(val: number, decimals: number = 6): number {
  if (!Number.isFinite(val) || Number.isNaN(val)) {
    return 0;
  }
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

export interface TradePnL {
  pnl: number;
  grossProfit: number;
  grossLoss: number;
}

/**
 * Calculate closed-trade PnL records using FIFO accounting from a sequence of trades.
 */
export function calculateClosedTradePnLs(trades: Trade[]): TradePnL[] {
  const pnlList: TradePnL[] = [];
  const buyQueue: { price: number; shares: number; feePerShare: number }[] = [];

  for (const trade of trades) {
    if (trade.shares <= 0) continue;

    const isBuy = trade.toPosition > trade.fromPosition;
    const feePerShare = trade.shares > 0 ? trade.fee / trade.shares : 0;

    if (isBuy) {
      buyQueue.push({
        price: trade.price,
        shares: trade.shares,
        feePerShare,
      });
    } else {
      // Selling / closing long position
      let sharesToClose = trade.shares;
      let totalCostBasis = 0;
      const totalExitProceeds = trade.shares * trade.price;
      let totalEntryFees = 0;
      const totalExitFees = trade.fee;

      while (sharesToClose > 1e-7 && buyQueue.length > 0) {
        const top = buyQueue[0];
        if (!top) break;

        const matchShares = Math.min(sharesToClose, top.shares);
        totalCostBasis += matchShares * top.price;
        totalEntryFees += matchShares * top.feePerShare;
        top.shares -= matchShares;
        sharesToClose -= matchShares;

        if (top.shares <= 1e-7) {
          buyQueue.shift();
        }
      }

      const netPnl = totalExitProceeds - totalCostBasis - totalEntryFees - totalExitFees;
      pnlList.push({
        pnl: netPnl,
        grossProfit: netPnl > 0 ? netPnl : 0,
        grossLoss: netPnl < 0 ? Math.abs(netPnl) : 0,
      });
    }
  }

  return pnlList;
}

/**
 * Calculate financial performance metrics from equity curve and trades.
 */
export function calculateFinancialMetrics(
  equityCurve: EquityPoint[],
  trades: Trade[],
  initialCash: number,
  annualTradingDays: number = 252,
): FinancialMetrics {
  if (equityCurve.length === 0 || initialCash <= 0) {
    return {
      initialCash,
      finalEquity: initialCash,
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      totalTurnover: 0,
      tradeCount: trades.length,
      winRate: 0,
      profitFactor: 0,
    };
  }

  const lastPoint = equityCurve[equityCurve.length - 1];
  const finalEquity = lastPoint ? lastPoint.equity : initialCash;
  const totalReturn = (finalEquity - initialCash) / initialCash;

  // Annualized return
  const N = equityCurve.length;
  let annualizedReturn = 0;
  if (N > 0) {
    if (1 + totalReturn <= 0) {
      annualizedReturn = -1.0;
    } else {
      annualizedReturn = Math.pow(1 + totalReturn, annualTradingDays / N) - 1;
    }
  }

  // Daily returns
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevPoint = equityCurve[i - 1];
    const currPoint = equityCurve[i];
    const prevEquity = prevPoint ? prevPoint.equity : 0;
    const currEquity = currPoint ? currPoint.equity : 0;

    if (prevEquity > 0) {
      dailyReturns.push((currEquity - prevEquity) / prevEquity);
    } else {
      dailyReturns.push(0);
    }
  }

  const M = dailyReturns.length;
  let sharpeRatio = 0;
  let sortinoRatio = 0;

  if (M >= 2) {
    const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / M;

    // Sample variance & sample std (ddof = 1)
    const varSum = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0);
    const sampleStd = Math.sqrt(varSum / (M - 1));

    if (sampleStd > 1e-12) {
      sharpeRatio = Math.sqrt(annualTradingDays) * (mean / sampleStd);
    }

    // Downside deviation with respect to 0
    const downsideSqSum = dailyReturns.reduce((sum, r) => {
      const negativeReturn = Math.min(0, r);
      return sum + negativeReturn * negativeReturn;
    }, 0);
    const downsideStd = Math.sqrt(downsideSqSum / M);

    if (downsideStd > 1e-12) {
      sortinoRatio = Math.sqrt(annualTradingDays) * (mean / downsideStd);
    }
  }

  // Max Drawdown (minimum negative float across the equity curve)
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    if (point.drawdown < maxDrawdown) {
      maxDrawdown = point.drawdown;
    }
  }

  // Total turnover
  let totalTurnover = 0;
  for (const trade of trades) {
    totalTurnover += Math.abs(trade.toPosition - trade.fromPosition);
  }

  // Closed trades PnL
  const closedPnLs = calculateClosedTradePnLs(trades);
  let winRate = 0;
  let profitFactor = 0;

  if (closedPnLs.length > 0) {
    const wins = closedPnLs.filter((t) => t.pnl > 0).length;
    winRate = wins / closedPnLs.length;

    const totalGrossProfit = closedPnLs.reduce((sum, t) => sum + t.grossProfit, 0);
    const totalGrossLoss = closedPnLs.reduce((sum, t) => sum + t.grossLoss, 0);

    if (totalGrossLoss > 1e-7) {
      profitFactor = totalGrossProfit / totalGrossLoss;
    } else if (totalGrossProfit > 0) {
      profitFactor = totalGrossProfit;
    } else {
      profitFactor = 0;
    }
  }

  return {
    initialCash: safeRound(initialCash, 4),
    finalEquity: safeRound(finalEquity, 4),
    totalReturn: safeRound(totalReturn, 6),
    annualizedReturn: safeRound(annualizedReturn, 6),
    sharpeRatio: safeRound(sharpeRatio, 4),
    sortinoRatio: safeRound(sortinoRatio, 4),
    maxDrawdown: safeRound(maxDrawdown, 6),
    totalTurnover: safeRound(totalTurnover, 4),
    tradeCount: trades.length,
    winRate: safeRound(winRate, 4),
    profitFactor: safeRound(profitFactor, 4),
  };
}

/**
 * Calculate decision intelligence & calibration metrics evaluating LLM reasoning quality.
 * - Directional Accuracy: % of active trade bars where forward price moved in predicted direction.
 * - Brier Score: Mean squared error of predicted probabilistic confidence vs binary realized outcome.
 * - Abstention Quality: Fraction of neutral/cash bars that avoided non-positive (<= 0) forward returns.
 * - Abstention Alpha: Spread between mean active forward return and mean neutral forward market return.
 */
export function calculateDecisionIntelligenceMetrics(
  bars: PriceBar[],
  decisions: (SignalType | DecisionSignal)[],
): DecisionIntelligenceMetrics {
  if (bars.length < 2 || decisions.length === 0) {
    return {
      directionalAccuracy: 0,
      brierScore: null,
      abstentionQuality: 0,
      abstentionAlpha: 0,
      activeBarCount: 0,
      neutralBarCount: 0,
    };
  }

  const N = Math.min(bars.length - 1, decisions.length);
  let activeCount = 0;
  let correctCount = 0;
  let brierSum = 0;
  let brierCount = 0;

  const activeReturns: number[] = [];
  const neutralReturns: number[] = [];

  for (let t = 0; t < N; t++) {
    const bar = bars[t];
    const nextBar = bars[t + 1];
    const dec = decisions[t];
    if (!bar || !nextBar || dec === undefined) continue;

    const rawSignal =
      typeof dec === "object" && dec !== null && "signal" in dec ? dec.signal : dec;
    const confidence =
      typeof dec === "object" && dec !== null && "confidence" in dec ? dec.confidence : 1.0;

    let targetWeight = 0;
    if (typeof rawSignal === "number") targetWeight = rawSignal;
    else if (rawSignal === "buy") targetWeight = 1.0;
    else if (rawSignal === "sell") targetWeight = -1.0;
    else targetWeight = 0.0;

    const forwardReturn = bar.close > 0 ? (nextBar.close - bar.close) / bar.close : 0;

    if (Math.abs(targetWeight) > 1e-6) {
      activeCount++;
      activeReturns.push(forwardReturn);

      const isLong = targetWeight > 0;
      const isCorrect = isLong ? forwardReturn > 0 : forwardReturn < 0;
      if (isCorrect) correctCount++;

      if (confidence !== null && confidence !== undefined && Number.isFinite(confidence)) {
        const outcome = isCorrect ? 1.0 : 0.0;
        brierSum += Math.pow(confidence - outcome, 2);
        brierCount++;
      }
    } else {
      neutralReturns.push(forwardReturn);
    }
  }

  const directionalAccuracy = activeCount > 0 ? safeRound(correctCount / activeCount, 4) : 0;
  const brierScore = brierCount > 0 ? safeRound(brierSum / brierCount, 4) : null;

  // Abstention Quality: fraction of neutral periods that were <= 0 return (successfully avoided)
  const neutralCount = neutralReturns.length;
  const avoidedDownturns = neutralReturns.filter((r) => r <= 0).length;
  const abstentionQuality = neutralCount > 0 ? safeRound(avoidedDownturns / neutralCount, 4) : 0;

  const meanActive =
    activeReturns.length > 0
      ? activeReturns.reduce((a, b) => a + b, 0) / activeReturns.length
      : 0;
  const meanNeutral =
    neutralReturns.length > 0
      ? neutralReturns.reduce((a, b) => a + b, 0) / neutralReturns.length
      : 0;
  const abstentionAlpha = safeRound(meanActive - meanNeutral, 6);

  return {
    directionalAccuracy,
    brierScore,
    abstentionQuality,
    abstentionAlpha,
    activeBarCount: activeCount,
    neutralBarCount: neutralCount,
  };
}

