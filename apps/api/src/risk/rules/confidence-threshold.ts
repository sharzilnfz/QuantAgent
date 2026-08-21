import type { RiskRuleEvaluator } from "../types.js";

/**
 * Rule 4: Minimum Confidence Threshold.
 * Filters out low-conviction consensus signals below config.minConfidenceThreshold (e.g. 0.50).
 */
export const evaluateConfidenceThresholdRule: RiskRuleEvaluator = (ctx) => {
  const { direction, confidence, config } = ctx;

  if (direction === "neutral") {
    return {
      ruleId: "confidence_threshold",
      name: "Minimum Confidence Threshold",
      passed: true,
      severity: "BLOCKING",
      currentValue: confidence,
      threshold: config.minConfidenceThreshold,
      message: "Neutral signals do not require directional conviction.",
    };
  }

  if (confidence < config.minConfidenceThreshold) {
    return {
      ruleId: "confidence_threshold",
      name: "Minimum Confidence Threshold",
      passed: false,
      severity: "BLOCKING",
      currentValue: confidence,
      threshold: config.minConfidenceThreshold,
      message: `Committee confidence of ${(confidence * 100).toFixed(1)}% is below the ${(config.minConfidenceThreshold * 100).toFixed(1)}% minimum conviction threshold.`,
    };
  }

  return {
    ruleId: "confidence_threshold",
    name: "Minimum Confidence Threshold",
    passed: true,
    severity: "BLOCKING",
    currentValue: confidence,
    threshold: config.minConfidenceThreshold,
    message: `Committee confidence ${(confidence * 100).toFixed(1)}% meets minimum threshold.`,
  };
};
