import { z } from "zod";

/**
 * Historical probability data point from Polymarket Gamma API.
 * Point-in-time discipline: `asOf` is strictly the knowable observation timestamp.
 */
export const PolymarketProbabilityPoint = z.object({
  ts: z.string().datetime(),
  probability: z.number().min(0).max(1),
  volume24h: z.number().nonnegative().optional(),
  asOf: z.string().datetime(),
});
export type PolymarketProbabilityPoint = z.infer<typeof PolymarketProbabilityPoint>;

/**
 * Macro category for prediction market events.
 */
export const MacroCategory = z.enum([
  "fed_rate",
  "cpi_inflation",
  "recession",
  "macro_geopolitical",
]);
export type MacroCategory = z.infer<typeof MacroCategory>;

/**
 * Polymarket prediction market event with historical probability curve.
 */
export const PredictionMarketEvent = z.object({
  id: z.string(),
  marketSlug: z.string(),
  question: z.string(),
  category: MacroCategory,
  outcomes: z.array(z.string()),
  history: z.array(PolymarketProbabilityPoint),
  asOf: z.string().datetime(),
});
export type PredictionMarketEvent = z.infer<typeof PredictionMarketEvent>;

/**
 * Fact-locked evidence extracted from Polymarket crowdsourced probability curves.
 */
export const PolymarketEvidence = z.object({
  marketsConsidered: z.number().int().nonnegative(),
  rateCutProbability: z.number().min(0).max(1).optional(),
  inflationExceedProbability: z.number().min(0).max(1).optional(),
  recessionProbability: z.number().min(0).max(1).optional(),
  macroRegime: z.enum(["dovish_easing", "hawkish_tightening", "stagflation_risk", "neutral_macro"]),
  mechanicalDirection: z.enum(["bullish", "bearish", "neutral"]),
  mechanicalStrength: z.number().min(0).max(1),
});
export type PolymarketEvidence = z.infer<typeof PolymarketEvidence>;
