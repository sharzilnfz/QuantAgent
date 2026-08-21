import { randomUUID } from "node:crypto";
import {
  PositionAllocation,
  AllocationConfig,
  type RiskAssessment,
  type PortfolioState,
  type Direction,
  type SizingMethod,
} from "@committee/contracts";
import { TemporalGuard } from "@committee/fixtures";

export interface AllocatorOptions {
  config?: Partial<AllocationConfig>;
}

export interface AllocationInput {
  symbol: string;
  direction: Direction;
  confidence: number;
  estimatedPrice: number;
  portfolio: PortfolioState;
  riskAssessment: RiskAssessment;
  assetVolatility?: number;
  sizingMethod?: SizingMethod;
  decisionTs: string;
}

export class PositionAllocatorEngine {
  public readonly config: AllocationConfig;

  constructor(options: AllocatorOptions = {}) {
    this.config = AllocationConfig.parse(options.config ?? {});
  }

  /**
   * Deterministically calculates position sizing and share quantity.
   * NEVER uses an LLM. 100% mathematical formula.
   */
  allocate(input: AllocationInput): PositionAllocation {
    const {
      symbol,
      direction,
      confidence,
      estimatedPrice,
      portfolio,
      riskAssessment,
      assetVolatility,
      sizingMethod = this.config.defaultMethod,
      decisionTs,
    } = input;

    // Temporal Point-in-Time discipline
    TemporalGuard.assertNoLeakage([portfolio], decisionTs, "PortfolioState");
    TemporalGuard.assertNoLeakage([riskAssessment], decisionTs, "RiskAssessment");

    const totalEquity = Math.max(0, portfolio.equity);

    // Case 1: Neutral, Rejected by Risk Gate, or non-viable execution
    if (
      direction === "neutral" ||
      riskAssessment.status === "REJECTED" ||
      !riskAssessment.executionAllowed ||
      totalEquity <= 0 ||
      estimatedPrice <= 0
    ) {
      return PositionAllocation.parse({
        allocationId: randomUUID(),
        symbol,
        direction,
        targetWeight: 0,
        targetQty: 0,
        targetNotional: 0,
        estimatedPrice,
        sizingMethod,
        sizingParameters: {
          confidence,
          rejectionReason: riskAssessment.violations.map((v) => v.message).join("; ") || "Neutral signal",
        },
        rationale:
          direction === "neutral"
            ? `Neutral stance; target allocation 0 shares.`
            : `Risk Gate status: ${riskAssessment.status}. Execution halted; allocation zeroed.`,
        asOf: decisionTs,
        allocatedAt: new Date().toISOString(),
      });
    }

    // Case 2: Bearish (derisking or closing existing long)
    if (direction === "bearish") {
      const existing = portfolio.positions.find((p) => p.symbol === symbol);
      const sharesToLiquidate = existing ? existing.qty : 0;
      const notional = sharesToLiquidate * estimatedPrice;

      return PositionAllocation.parse({
        allocationId: randomUUID(),
        symbol,
        direction,
        targetWeight: 0,
        targetQty: sharesToLiquidate,
        targetNotional: notional,
        estimatedPrice,
        sizingMethod,
        sizingParameters: {
          action: "liquidate_or_short",
          confidence,
        },
        rationale: `Bearish signal with ${(confidence * 100).toFixed(0)}% confidence; target liquidation of existing position (${sharesToLiquidate} shares).`,
        asOf: decisionTs,
        allocatedAt: new Date().toISOString(),
      });
    }

    // Case 3: Bullish sizing calculation
    let rawWeight = 0;
    const sizingParams: Record<string, number | string | boolean> = {
      method: sizingMethod,
      confidence,
    };

    if (sizingMethod === "fractional_kelly") {
      // Conservative Kelly: win rate p from confidence, payoff ratio b = 1.5
      const p = Math.max(0.50, Math.min(0.90, confidence));
      const b = 1.5;
      const fullKelly = Math.max(0, (p * (b + 1) - 1) / b);
      rawWeight = fullKelly * this.config.kellyFraction;

      sizingParams.winRate = p;
      sizingParams.payoffRatio = b;
      sizingParams.fullKelly = fullKelly;
      sizingParams.fraction = this.config.kellyFraction;
    } else if (sizingMethod === "volatility_parity") {
      const assetVol = assetVolatility && assetVolatility > 0 ? assetVolatility : 0.25;
      const volRatio = this.config.targetVolatility / assetVol;
      rawWeight = Math.min(this.config.maxWeightCap, volRatio * confidence);

      sizingParams.targetVol = this.config.targetVolatility;
      sizingParams.assetVol = assetVol;
    } else {
      // fixed_percentage
      rawWeight = this.config.fixedPercentage * (0.5 + confidence * 0.5);
      sizingParams.basePct = this.config.fixedPercentage;
    }

    // Apply global maxWeightCap
    let targetWeight = Math.min(rawWeight, this.config.maxWeightCap);

    // Apply risk-adjusted weight constraint if provided
    if (riskAssessment.adjustedConstraints?.maxAllowedWeight !== undefined) {
      targetWeight = Math.min(targetWeight, riskAssessment.adjustedConstraints.maxAllowedWeight);
    }

    // Calculate dollar notional
    let targetNotional = targetWeight * totalEquity;

    // Apply risk-adjusted notional constraint if provided
    if (riskAssessment.adjustedConstraints?.maxAllowedNotional !== undefined) {
      targetNotional = Math.min(targetNotional, riskAssessment.adjustedConstraints.maxAllowedNotional);
    }

    // Compute whole integer shares
    const targetQty = Math.floor(targetNotional / estimatedPrice);
    const effectiveNotional = targetQty * estimatedPrice;
    const effectiveWeight = totalEquity > 0 ? effectiveNotional / totalEquity : 0;

    return PositionAllocation.parse({
      allocationId: randomUUID(),
      symbol,
      direction: "bullish",
      targetWeight: Number(effectiveWeight.toFixed(4)),
      targetQty,
      targetNotional: Number(effectiveNotional.toFixed(2)),
      estimatedPrice,
      sizingMethod,
      sizingParameters: sizingParams,
      rationale: `Bullish allocation: ${targetQty} shares ($${effectiveNotional.toFixed(2)}, ${(effectiveWeight * 100).toFixed(1)}% NAV) sized via ${sizingMethod}.`,
      asOf: decisionTs,
      allocatedAt: new Date().toISOString(),
    });
  }
}
