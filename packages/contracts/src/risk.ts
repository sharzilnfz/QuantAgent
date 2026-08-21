import { z } from "zod";
import { Direction } from "./enums.js";

/**
 * High-level approval status emitted by the deterministic Risk Gate (L4).
 * - `APPROVED`: Signal meets all risk parameters; full requested/suggested size permitted.
 * - `MODIFIED`: Signal approved with clamped position/exposure constraints.
 * - `REJECTED`: Signal violates one or more hard/blocking risk constraints; execution halted.
 */
export const RiskStatus = z.enum(["APPROVED", "MODIFIED", "REJECTED"]);
export type RiskStatus = z.infer<typeof RiskStatus>;

/**
 * Severity level of an individual risk rule outcome.
 * - `BLOCKING`: Hard constraint violation that immediately triggers `REJECTED` status.
 * - `WARNING`: Soft constraint violation or cautionary flag that may trigger `MODIFIED` sizing.
 * - `INFO`: Informational observation that does not impede execution.
 */
export const RiskViolationSeverity = z.enum(["BLOCKING", "WARNING", "INFO"]);
export type RiskViolationSeverity = z.infer<typeof RiskViolationSeverity>;

/**
 * Individual risk rule evaluation record.
 */
export const RiskRuleResult = z.object({
  ruleId: z.string(),
  name: z.string(),
  passed: z.boolean(),
  severity: RiskViolationSeverity,
  currentValue: z.number().optional(),
  threshold: z.number().optional(),
  message: z.string(),
});
export type RiskRuleResult = z.infer<typeof RiskRuleResult>;

/**
 * Adjusted constraints imposed by the risk gate when status is `MODIFIED` or `APPROVED`.
 */
export const AdjustedRiskConstraints = z.object({
  maxAllowedNotional: z.number().nonnegative().optional(),
  maxAllowedWeight: z.number().min(0).max(1).optional(),
  maxAllowedQty: z.number().nonnegative().optional(),
  forcedDirection: Direction.optional(),
});
export type AdjustedRiskConstraints = z.infer<typeof AdjustedRiskConstraints>;

/**
 * Complete evaluation output produced by the L4 Risk Gate.
 */
export const RiskAssessment = z.object({
  assessmentId: z.string().uuid(),
  symbol: z.string(),
  direction: Direction,
  status: RiskStatus,
  executionAllowed: z.boolean(),
  evaluatedRules: z.array(RiskRuleResult),
  violations: z.array(RiskRuleResult),
  adjustedConstraints: AdjustedRiskConstraints.default({}),
  asOf: z.string().datetime(),
  evaluatedAt: z.string().datetime(),
});
export type RiskAssessment = z.infer<typeof RiskAssessment>;

/**
 * Configurable thresholds for deterministic risk gate rules.
 */
export const RiskConfig = z.object({
  /** Maximum single-asset exposure as a fraction of total portfolio equity (e.g., 0.20 = 20% NAV). */
  maxPositionWeight: z.number().min(0).max(1).default(0.20),
  /** Minimum cash buffer as a fraction of total equity that cannot be depleted (e.g., 0.10 = 10%). */
  minCashReservePct: z.number().min(0).max(1).default(0.10),
  /** Maximum allowable portfolio peak-to-trough drawdown before circuit breaker halts new buying (e.g., 0.15 = 15%). */
  maxDrawdownCircuitBreaker: z.number().min(0).max(1).default(0.15),
  /** Maximum allowable daily portfolio loss before buying is halted for the day (e.g., 0.03 = 3%). */
  maxDailyLossPct: z.number().min(0).max(1).default(0.03),
  /** Minimum consensus confidence required to permit trade entry (e.g., 0.50). */
  minConfidenceThreshold: z.number().min(0).max(1).default(0.50),
  /** Maximum allowable annualized volatility (or normalized ATR) for an asset before derisking (e.g., 0.60 = 60%). */
  maxAssetVolatility: z.number().positive().default(0.60),
});
export type RiskConfig = z.infer<typeof RiskConfig>;
