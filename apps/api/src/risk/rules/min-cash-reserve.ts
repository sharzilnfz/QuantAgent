import type { RiskRuleEvaluator } from "../types.js";

/**
 * Rule 2: Minimum Cash Reserve.
 * Ensures the portfolio preserves at least config.minCashReservePct (e.g. 10%) of equity as uncommitted cash buffer.
 */
export const evaluateMinCashReserveRule: RiskRuleEvaluator = (ctx) => {
  const { direction, portfolio, config } = ctx;
  const totalEquity = Math.max(portfolio.equity, 0);

  if (direction !== "bullish") {
    return {
      ruleId: "min_cash_reserve",
      name: "Minimum Cash Reserve",
      passed: true,
      severity: "BLOCKING",
      currentValue: portfolio.cash,
      threshold: totalEquity * config.minCashReservePct,
      message: "Non-buying operations do not deplete cash reserves.",
    };
  }

  const requiredCashReserve = totalEquity * config.minCashReservePct;
  const deployableCash = Math.max(0, portfolio.cash - requiredCashReserve);
  const currentCashRatio = totalEquity > 0 ? portfolio.cash / totalEquity : 0;

  if (portfolio.cash < requiredCashReserve || deployableCash <= 0) {
    return {
      ruleId: "min_cash_reserve",
      name: "Minimum Cash Reserve",
      passed: false,
      severity: "BLOCKING",
      currentValue: currentCashRatio,
      threshold: config.minCashReservePct,
      message: `Available cash ($${portfolio.cash.toFixed(2)}) is below the required ${(config.minCashReservePct * 100).toFixed(1)}% reserve buffer ($${requiredCashReserve.toFixed(2)}).`,
    };
  }

  return {
    ruleId: "min_cash_reserve",
    name: "Minimum Cash Reserve",
    passed: true,
    severity: "BLOCKING",
    currentValue: currentCashRatio,
    threshold: config.minCashReservePct,
    message: `Deployable cash is $${deployableCash.toFixed(2)} above the ${(config.minCashReservePct * 100).toFixed(1)}% reserve buffer.`,
    adjustedConstraints: {
      maxAllowedNotional: deployableCash,
    },
  };
};
