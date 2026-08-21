import type {
  Direction,
  PortfolioState,
  RiskConfig,
  RiskRuleResult,
  AdjustedRiskConstraints,
} from "@committee/contracts";

export interface RiskEvaluationContext {
  symbol: string;
  direction: Direction;
  confidence: number;
  currentPrice: number;
  portfolio: PortfolioState;
  portfolioHistory?: { asOf: string; equity: number }[];
  assetVolatility?: number; // e.g. 0.25 = 25% annualized
  decisionTs: string;
  config: RiskConfig;
}

export interface EvaluatedRuleOutcome extends RiskRuleResult {
  adjustedConstraints?: AdjustedRiskConstraints;
}

export type RiskRuleEvaluator = (
  ctx: RiskEvaluationContext,
) => EvaluatedRuleOutcome;
