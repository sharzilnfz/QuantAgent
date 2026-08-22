import { randomUUID } from "node:crypto";
import {
  PositionAllocation,
  AllocationConfig,
  type RiskAssessment,
  type PortfolioState,
  type Direction,
  type SizingMethod,
  type PriceBar,
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
  bars?: PriceBar[];
  assetVolatility?: number;
  payoffRatio?: number;
  sizingMethod?: SizingMethod;
  decisionTs: string;
}

/**
 * Calculates rolling annualized sample standard deviation of log returns from historical price bars.
 * σ_annualized = std(ln(P_t / P_{t-1})) * sqrt(252)
 */
export function computeRollingAnnualizedVolatility(
  bars: PriceBar[],
  lookback: number = 20,
): number {
  if (!bars || bars.length < 3) {
    return 0.25; // 25% default baseline annualized volatility
  }

  // Use the most recent (lookback + 1) bars
  const windowBars = bars.slice(-(lookback + 1));
  if (windowBars.length < 3) {
    return 0.25;
  }

  const logReturns: number[] = [];
  for (let i = 1; i < windowBars.length; i += 1) {
    const prevClose = windowBars[i - 1]?.close;
    const currClose = windowBars[i]?.close;
    if (prevClose && currClose && prevClose > 0 && currClose > 0) {
      logReturns.push(Math.log(currClose / prevClose));
    }
  }

  if (logReturns.length < 2) {
    return 0.25;
  }

  const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
  const variance =
    logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);
  const dailyStdDev = Math.sqrt(variance);

  // Annualize daily standard deviation across 252 trading days
  const annualizedVol = dailyStdDev * Math.sqrt(252);
  return Number.isFinite(annualizedVol) && annualizedVol > 0.01
    ? Math.round(annualizedVol * 10000) / 10000
    : 0.25;
}

export class PositionAllocatorEngine {
  public readonly config: AllocationConfig;

  constructor(options: AllocatorOptions = {}) {
    this.config = AllocationConfig.parse(options.config ?? {});
  }

  /**
   * Deterministically calculates position sizing and share quantity for a single symbol.
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
      bars,
      assetVolatility,
      payoffRatio = this.config.defaultPayoffRatio,
      sizingMethod = this.config.defaultMethod,
      decisionTs,
    } = input;

    // Temporal Point-in-Time discipline
    TemporalGuard.assertNoLeakage([portfolio], decisionTs, "PortfolioState");
    TemporalGuard.assertNoLeakage([riskAssessment], decisionTs, "RiskAssessment");
    if (bars && bars.length > 0) {
      TemporalGuard.assertNoLeakage(bars, decisionTs, "PriceBar");
    }

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

    // Dynamic Realized Volatility Calculation
    const effectiveVol =
      assetVolatility && assetVolatility > 0
        ? assetVolatility
        : bars && bars.length > 0
          ? computeRollingAnnualizedVolatility(bars, this.config.volatilityLookback)
          : 0.25;

    // Case 3: Bullish sizing calculation
    let rawWeight = 0;
    const sizingParams: Record<string, number | string | boolean> = {
      method: sizingMethod,
      confidence,
      assetVol: effectiveVol,
    };

    if (sizingMethod === "fractional_kelly") {
      // Conservative Kelly: win rate p from calibrated confidence, payoff ratio b
      const p = Math.max(0.50, Math.min(0.95, confidence));
      const b = Math.max(0.5, payoffRatio);
      const fullKelly = Math.max(0, (p * (b + 1) - 1) / b);
      rawWeight = fullKelly * this.config.kellyFraction;

      sizingParams.winRate = p;
      sizingParams.payoffRatio = b;
      sizingParams.fullKelly = Math.round(fullKelly * 10000) / 10000;
      sizingParams.fraction = this.config.kellyFraction;
    } else if (sizingMethod === "volatility_parity") {
      const volRatio = this.config.targetVolatility / effectiveVol;
      rawWeight = Math.min(this.config.maxWeightCap, volRatio * confidence);

      sizingParams.targetVol = this.config.targetVolatility;
      sizingParams.volRatio = Math.round(volRatio * 10000) / 10000;
    } else {
      // fixed_percentage
      rawWeight = this.config.fixedPercentage * (0.5 + confidence * 0.5);
      sizingParams.basePct = this.config.fixedPercentage;
    }

    // Apply single-asset maxWeightCap
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
      rationale: `Bullish allocation: ${targetQty} shares ($${effectiveNotional.toFixed(2)}, ${(effectiveWeight * 100).toFixed(1)}% NAV) sized via ${sizingMethod} (vol: ${(effectiveVol * 100).toFixed(1)}%).`,
      asOf: decisionTs,
      allocatedAt: new Date().toISOString(),
    });
  }

  /**
   * Concurrently sizes a multi-asset basket while enforcing total portfolio gross exposure limits and cash buffers.
   */
  allocatePortfolio(
    inputs: AllocationInput[],
    portfolio: PortfolioState,
  ): PositionAllocation[] {
    const rawAllocations = inputs.map((inp) => this.allocate(inp));
    const totalEquity = Math.max(0, portfolio.equity);

    if (totalEquity <= 0 || rawAllocations.length === 0) {
      return rawAllocations;
    }

    // Calculate total bullish target weight
    const bullishAllocations = rawAllocations.filter((a) => a.direction === "bullish");
    const totalBullishWeight = bullishAllocations.reduce((sum, a) => sum + a.targetWeight, 0);

    const maxAllowedGrossWeight = 1.0 - this.config.cashBuffer;

    // If total allocated weight exceeds maximum allowed gross exposure (leaving cash buffer), scale down
    if (totalBullishWeight > maxAllowedGrossWeight && totalBullishWeight > 0) {
      const scaleFactor = maxAllowedGrossWeight / totalBullishWeight;

      return rawAllocations.map((alloc) => {
        if (alloc.direction !== "bullish") return alloc;

        const scaledWeight = alloc.targetWeight * scaleFactor;
        const scaledNotional = scaledWeight * totalEquity;
        const scaledQty = Math.floor(scaledNotional / alloc.estimatedPrice);
        const effectiveNotional = scaledQty * alloc.estimatedPrice;
        const effectiveWeight = effectiveNotional / totalEquity;

        return PositionAllocation.parse({
          ...alloc,
          allocationId: randomUUID(),
          targetWeight: Number(effectiveWeight.toFixed(4)),
          targetQty: scaledQty,
          targetNotional: Number(effectiveNotional.toFixed(2)),
          sizingParameters: {
            ...alloc.sizingParameters,
            portfolioScaled: true,
            scaleFactor: Math.round(scaleFactor * 10000) / 10000,
            cashBufferPreserved: this.config.cashBuffer,
          },
          rationale: `${alloc.rationale} [Scaled by ${(scaleFactor * 100).toFixed(1)}% to preserve ${(this.config.cashBuffer * 100).toFixed(0)}% cash buffer].`,
        });
      });
    }

    return rawAllocations;
  }
}
