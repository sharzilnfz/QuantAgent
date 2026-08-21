import type { RiskRuleEvaluator } from "../types.js";

/**
 * Rule 5: Volatility Ceiling.
 * Checks annualized volatility or normalized ATR. If the asset is in an extreme regime (> config.maxAssetVolatility),
 * marks warning/modification to scale back sizing.
 */
export const evaluateVolatilityCeilingRule: RiskRuleEvaluator = (ctx) => {
  const { symbol, assetVolatility, config } = ctx;

  if (assetVolatility === undefined || assetVolatility === null) {
    return {
      ruleId: "volatility_ceiling",
      name: "Asset Volatility Ceiling",
      passed: true,
      severity: "INFO",
      message: "No volatility metric provided; rule skipped.",
    };
  }

  if (assetVolatility > config.maxAssetVolatility) {
    // Soft constraint (WARNING): scale maxAllowedWeight down by ratio of limit / current vol
    const scaleFactor = config.maxAssetVolatility / assetVolatility;
    const clampedWeight = config.maxPositionWeight * scaleFactor;

    return {
      ruleId: "volatility_ceiling",
      name: "Asset Volatility Ceiling",
      passed: false,
      severity: "WARNING",
      currentValue: assetVolatility,
      threshold: config.maxAssetVolatility,
      message: `Asset ${symbol} volatility ${(assetVolatility * 100).toFixed(1)}% exceeds the ${(config.maxAssetVolatility * 100).toFixed(1)}% ceiling. Allocation scaling factor applied (${(scaleFactor * 100).toFixed(0)}%).`,
      adjustedConstraints: {
        maxAllowedWeight: clampedWeight,
      },
    };
  }

  return {
    ruleId: "volatility_ceiling",
    name: "Asset Volatility Ceiling",
    passed: true,
    severity: "INFO",
    currentValue: assetVolatility,
    threshold: config.maxAssetVolatility,
    message: `Asset volatility ${(assetVolatility * 100).toFixed(1)}% is within acceptable bounds.`,
  };
};
