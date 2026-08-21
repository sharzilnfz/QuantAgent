import type { RiskRuleEvaluator } from "../types.js";

/**
 * Rule 1: Max Position Exposure.
 * Prevents allocating more than config.maxPositionWeight (e.g. 20%) of total NAV to a single asset.
 */
export const evaluateMaxExposureRule: RiskRuleEvaluator = (ctx) => {
  const { symbol, direction, portfolio, config } = ctx;
  const totalEquity = Math.max(portfolio.equity, 0);

  // If equity is zero or neutral/bearish sell, exposure rule does not block
  if (totalEquity <= 0 || direction !== "bullish") {
    return {
      ruleId: "max_exposure",
      name: "Max Single-Asset Exposure",
      passed: true,
      severity: "BLOCKING",
      currentValue: 0,
      threshold: config.maxPositionWeight,
      message: "Max exposure constraint satisfied.",
    };
  }

  const existingPosition = portfolio.positions.find((p) => p.symbol === symbol);
  const currentMarketValue = existingPosition ? existingPosition.marketValue : 0;
  const currentWeight = currentMarketValue / totalEquity;

  const maxAllowedNotional = totalEquity * config.maxPositionWeight;
  const remainingHeadroomNotional = Math.max(0, maxAllowedNotional - currentMarketValue);

  if (currentWeight >= config.maxPositionWeight) {
    return {
      ruleId: "max_exposure",
      name: "Max Single-Asset Exposure",
      passed: false,
      severity: "BLOCKING",
      currentValue: currentWeight,
      threshold: config.maxPositionWeight,
      message: `Current exposure to ${symbol} is ${(currentWeight * 100).toFixed(1)}%, which meets or exceeds the ${(config.maxPositionWeight * 100).toFixed(1)}% maximum NAV ceiling.`,
    };
  }

  // If there is headroom, we pass but set the ceiling constraint
  return {
    ruleId: "max_exposure",
    name: "Max Single-Asset Exposure",
    passed: true,
    severity: "BLOCKING",
    currentValue: currentWeight,
    threshold: config.maxPositionWeight,
    message: `Current exposure to ${symbol} is ${(currentWeight * 100).toFixed(1)}% (cap: ${(config.maxPositionWeight * 100).toFixed(1)}%).`,
    adjustedConstraints: {
      maxAllowedNotional: remainingHeadroomNotional,
      maxAllowedWeight: config.maxPositionWeight - currentWeight,
    },
  };
};
