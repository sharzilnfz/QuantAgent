import type { Direction, FundamentalReport } from "@committee/contracts";

export interface FundamentalClassification {
  readonly direction: Direction;
  readonly confidence: number;
  readonly score: number;
  readonly latestReport?: FundamentalReport;
  readonly priorReport?: FundamentalReport;
  readonly rationale: string;
  readonly evidence: Record<string, string | number | boolean>;
}

/**
 * Deterministically classify fundamental corporate health from point-in-time SEC filings.
 *
 * Scoring methodology (Facts vs Narration):
 * - Profitability (Operating Margin, Net Margin, FCF) -> 40% weight
 * - Growth (YoY Revenue Growth) -> 30% weight
 * - Solvency & Health (Debt-to-Equity, Current Ratio) -> 30% weight
 */
export function classifyFundamentals(
  reports: readonly FundamentalReport[],
): FundamentalClassification {
  if (!reports || reports.length === 0) {
    return {
      direction: "neutral",
      confidence: 0,
      score: 0,
      rationale: "No SEC EDGAR fundamental reports available at or before decision point.",
      evidence: {
        statementsConsidered: 0,
      },
    };
  }

  // Sort ascending by filing date / asOf
  const sorted = [...reports].sort(
    (a, b) => new Date(a.asOf).getTime() - new Date(b.asOf).getTime(),
  );

  const latest = sorted[sorted.length - 1]!;
  const prior = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;

  let bullPoints = 0;
  let bearPoints = 0;

  // 1. Profitability checks
  if (latest.operatingMargin > 0.25) {
    bullPoints += 2;
  } else if (latest.operatingMargin > 0.12) {
    bullPoints += 1;
  } else if (latest.operatingMargin < 0) {
    bearPoints += 2;
  }

  if (latest.netIncome > 0 && latest.freeCashFlow > 0) {
    bullPoints += 1;
  } else if (latest.netIncome < 0 || latest.freeCashFlow < 0) {
    bearPoints += 2;
  }

  // 2. Growth checks (YoY Revenue Growth)
  const growth = latest.revenueGrowthYoY ?? (prior ? (latest.revenue - prior.revenue) / prior.revenue : 0);
  if (growth > 0.15) {
    bullPoints += 3;
  } else if (growth > 0.03) {
    bullPoints += 1;
  } else if (growth < -0.05) {
    bearPoints += 2;
  } else if (growth < 0) {
    bearPoints += 1;
  }

  // 3. Leverage / Solvency
  if (latest.debtToEquity > 0 && latest.debtToEquity < 1.0) {
    bullPoints += 1;
  } else if (latest.debtToEquity > 4.5 && (latest.cashAndEquivalents ?? 0) < latest.totalDebt! * 0.5) {
    bearPoints += 1;
  }

  const netScore = bullPoints - bearPoints;
  let direction: Direction = "neutral";
  let confidence = 0.5;

  if (netScore >= 2) {
    direction = "bullish";
    confidence = Math.min(0.95, Math.round((0.55 + netScore * 0.08) * 100) / 100);
  } else if (netScore <= -2) {
    direction = "bearish";
    confidence = Math.min(0.95, Math.round((0.55 + Math.abs(netScore) * 0.08) * 100) / 100);
  } else {
    direction = "neutral";
    confidence = 0.45;
  }

  const rationaleParts: string[] = [];
  rationaleParts.push(
    `SEC ${latest.form} (${latest.fiscalYear} ${latest.fiscalPeriod}) filed ${latest.filedAt.slice(0, 10)}.`,
  );
  rationaleParts.push(
    `Revenue: $${(latest.revenue / 1e9).toFixed(2)}B (${growth >= 0 ? "+" : ""}${(growth * 100).toFixed(1)}% YoY), Operating Margin: ${(latest.operatingMargin * 100).toFixed(1)}%.`,
  );
  rationaleParts.push(
    `FCF: $${(latest.freeCashFlow / 1e9).toFixed(2)}B, D/E: ${latest.debtToEquity.toFixed(2)}.`,
  );

  return {
    direction,
    confidence,
    score: netScore,
    latestReport: latest,
    priorReport: prior,
    rationale: rationaleParts.join(" "),
    evidence: {
      form: latest.form,
      fiscalYear: latest.fiscalYear,
      fiscalPeriod: latest.fiscalPeriod,
      periodEndDate: latest.periodEndDate,
      filedAt: latest.filedAt,
      revenueBillion: Math.round((latest.revenue / 1e9) * 100) / 100,
      operatingMargin: Math.round(latest.operatingMargin * 1000) / 1000,
      netMargin: Math.round(latest.netMargin * 1000) / 1000,
      freeCashFlowBillion: Math.round((latest.freeCashFlow / 1e9) * 100) / 100,
      debtToEquity: Math.round(latest.debtToEquity * 100) / 100,
      revenueGrowthYoY: Math.round(growth * 1000) / 1000,
      statementsConsidered: reports.length,
    },
  };
}
