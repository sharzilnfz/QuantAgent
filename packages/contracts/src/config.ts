import { z } from "zod";

/**
 * Specialist agent tuning configuration schema.
 */
export const SpecialistConfig = z.object({
  enabled: z.boolean(),
  weight: z.number().min(0).max(2).default(1.0),
  modelTier: z.enum(["cheap", "standard", "flagship"]).default("cheap"),
  temperature: z.number().min(0).max(1).default(0.2),
});
export type SpecialistConfig = z.infer<typeof SpecialistConfig>;

/**
 * Deterministic risk gate thresholds schema.
 */
export const RiskGateConfig = z.object({
  maxPositionPct: z.number().min(1).max(50).default(20), // Max % of portfolio in one ticker
  maxConcentrationPct: z.number().min(10).max(100).default(80), // Max total equity invested
  stopLossPct: z.number().min(0.5).max(30).default(5), // Stop loss % per trade
  takeProfitPct: z.number().min(1).max(100).default(15), // Take profit % per trade
  requireApprovalAboveUsd: z.number().min(0).default(10000), // Sizing above this triggers manual confirmation
});
export type RiskGateConfig = z.infer<typeof RiskGateConfig>;

/**
 * Consensus debate and synthesis policy schema.
 */
export const ConsensusConfig = z.object({
  protocol: z
    .enum(["single_pass_synthesis", "majority_fast_pass", "multi_round_critique"])
    .default("majority_fast_pass"),
  agreementThreshold: z.number().min(0.5).max(1.0).default(0.67), // 2-of-3 ratio
  synthesisModelTier: z.enum(["cheap", "standard", "flagship"]).default("standard"),
});
export type ConsensusConfig = z.infer<typeof ConsensusConfig>;

/**
 * Telegram notification preferences schema.
 */
export const TelegramAlertPreferences = z.object({
  enabled: z.boolean().default(false),
  sendTradeAlerts: z.boolean().default(true),
  sendEodDigest: z.boolean().default(true),
  chatId: z.string().optional(),
});
export type TelegramAlertPreferences = z.infer<typeof TelegramAlertPreferences>;

/**
 * Root Committee system configuration schema.
 */
export const CommitteeSystemConfig = z.object({
  version: z.string().default("1.0.0"),
  updatedAt: z.string().datetime(),
  specialists: z.object({
    technical: SpecialistConfig,
    sentiment: SpecialistConfig,
    fundamental: SpecialistConfig,
    polymarket: SpecialistConfig,
  }),
  risk: RiskGateConfig,
  consensus: ConsensusConfig,
  telegram: TelegramAlertPreferences,
});
export type CommitteeSystemConfig = z.infer<typeof CommitteeSystemConfig>;

/**
 * Canonical default baseline configuration.
 */
export const DEFAULT_COMMITTEE_CONFIG: CommitteeSystemConfig = {
  version: "1.0.0",
  updatedAt: "2024-01-01T00:00:00.000Z",
  specialists: {
    technical: { enabled: true, weight: 1.0, modelTier: "cheap", temperature: 0.1 },
    sentiment: { enabled: true, weight: 1.0, modelTier: "cheap", temperature: 0.2 },
    fundamental: { enabled: true, weight: 1.0, modelTier: "cheap", temperature: 0.1 },
    polymarket: { enabled: true, weight: 0.8, modelTier: "cheap", temperature: 0.1 },
  },
  risk: {
    maxPositionPct: 20,
    maxConcentrationPct: 80,
    stopLossPct: 5,
    takeProfitPct: 15,
    requireApprovalAboveUsd: 10000,
  },
  consensus: {
    protocol: "majority_fast_pass",
    agreementThreshold: 0.67,
    synthesisModelTier: "standard",
  },
  telegram: {
    enabled: false,
    sendTradeAlerts: true,
    sendEodDigest: true,
  },
};
