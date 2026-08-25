import { randomUUID } from "node:crypto";
import {
  RiskAssessment,
  RiskConfig,
  type Direction,
  type PortfolioState,
  type AdjustedRiskConstraints,
  type RiskRuleResult,
} from "@committee/contracts";
import { TemporalGuard } from "@committee/fixtures";

import type { RiskEvaluationContext, RiskRuleEvaluator } from "./types.js";
import {
  evaluateConfidenceThresholdRule,
  evaluateDrawdownCircuitBreakerRule,
  evaluateMinCashReserveRule,
  evaluateMaxExposureRule,
  evaluateVolatilityCeilingRule,
} from "./rules/index.js";

export interface RiskGateOptions {
  config?: Partial<RiskConfig>;
  customRules?: RiskRuleEvaluator[];
}

export class RiskGateEngine {
  public readonly config: RiskConfig;
  private readonly rules: RiskRuleEvaluator[];

  constructor(options: RiskGateOptions = {}) {
    this.config = RiskConfig.parse(options.config ?? {});
    this.rules = options.customRules ?? [
      evaluateConfidenceThresholdRule,
      evaluateDrawdownCircuitBreakerRule,
      evaluateMinCashReserveRule,
      evaluateMaxExposureRule,
      evaluateVolatilityCeilingRule,
    ];
  }

  /**
   * Deterministically evaluates risk for a proposed committee decision.
   * NEVER uses an LLM. 100% deterministic code.
   */
  assess(input: {
    symbol: string;
    direction: Direction;
    confidence: number;
    currentPrice: number;
    portfolio: PortfolioState;
    portfolioHistory?: { asOf: string; equity: number }[];
    assetVolatility?: number;
    decisionTs: string;
  }): RiskAssessment {
    const {
      symbol,
      direction,
      confidence,
      currentPrice,
      portfolio,
      portfolioHistory,
      assetVolatility,
      decisionTs,
    } = input;

    // Temporal Point-in-Time discipline: verify portfolio snapshot is knowable at decisionTs
    TemporalGuard.assertNoLeakage([portfolio], decisionTs, "PortfolioState");

    const ctx: RiskEvaluationContext = {
      symbol,
      direction,
      confidence,
      currentPrice,
      portfolio,
      portfolioHistory,
      assetVolatility,
      decisionTs,
      config: this.config,
    };

    const evaluatedRules: RiskRuleResult[] = [];
    const violations: RiskRuleResult[] = [];
    let hasBlockingFailure = false;
    let hasWarningModification = false;

    let consolidatedMaxNotional: number | undefined = undefined;
    let consolidatedMaxWeight: number | undefined = undefined;

    for (const rule of this.rules) {
      const outcome = rule(ctx);
      const { adjustedConstraints, ...ruleResult } = outcome;

      evaluatedRules.push(ruleResult);

      if (!ruleResult.passed) {
        violations.push(ruleResult);
        if (ruleResult.severity === "BLOCKING") {
          hasBlockingFailure = true;
        } else if (ruleResult.severity === "WARNING") {
          hasWarningModification = true;
        }
      }

      if (adjustedConstraints) {
        if (adjustedConstraints.maxAllowedNotional !== undefined) {
          consolidatedMaxNotional =
            consolidatedMaxNotional === undefined
              ? adjustedConstraints.maxAllowedNotional
              : Math.min(consolidatedMaxNotional, adjustedConstraints.maxAllowedNotional);
        }
        if (adjustedConstraints.maxAllowedWeight !== undefined) {
          consolidatedMaxWeight =
            consolidatedMaxWeight === undefined
              ? adjustedConstraints.maxAllowedWeight
              : Math.min(consolidatedMaxWeight, adjustedConstraints.maxAllowedWeight);
        }
      }
    }

    let status: RiskAssessment["status"] = "APPROVED";
    let executionAllowed = true;

    if (direction === "neutral") {
      status = "APPROVED";
      executionAllowed = true;
    } else if (hasBlockingFailure) {
      status = "REJECTED";
      executionAllowed = false;
      consolidatedMaxNotional = 0;
      consolidatedMaxWeight = 0;
    } else if (hasWarningModification || consolidatedMaxWeight !== undefined) {
      status = "MODIFIED";
      executionAllowed = true;
    }

    const finalConstraints: AdjustedRiskConstraints = {
      maxAllowedNotional: consolidatedMaxNotional,
      maxAllowedWeight: consolidatedMaxWeight,
    };

    return RiskAssessment.parse({
      assessmentId: randomUUID(),
      symbol,
      direction,
      status,
      executionAllowed,
      evaluatedRules,
      violations,
      adjustedConstraints: finalConstraints,
      asOf: decisionTs,
      evaluatedAt: new Date().toISOString(),
    });
  }
}
