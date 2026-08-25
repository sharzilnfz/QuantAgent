import type { Direction, PredictionMarketEvent, PolymarketEvidence } from "@committee/contracts";

export interface MacroOddsClassification {
  readonly macroRegime: "dovish_easing" | "hawkish_tightening" | "stagflation_risk" | "neutral_macro";
  readonly direction: Direction;
  readonly strength: number;
  readonly rateCutProbability?: number;
  readonly inflationExceedProbability?: number;
  readonly recessionProbability?: number;
  readonly marketsConsidered: number;
  readonly evidence: Record<string, string | number | boolean>;
}

/**
 * Deterministically classify macroeconomic crowdsourced odds from Polymarket probability curves.
 * Assumes events have already been filtered strictly to asOf <= decisionTs.
 */
export function classifyMacroOdds(
  events: readonly PredictionMarketEvent[],
  decisionTs?: string | Date,
): MacroOddsClassification {
  if (!events || events.length === 0) {
    return {
      macroRegime: "neutral_macro",
      direction: "neutral",
      strength: 0,
      marketsConsidered: 0,
      evidence: {
        marketsConsidered: 0,
        macroRegime: "neutral_macro",
        mechanicalDirection: "neutral",
        mechanicalStrength: 0,
      },
    };
  }

  const cutoffMs = decisionTs
    ? typeof decisionTs === "string"
      ? Date.parse(decisionTs)
      : decisionTs.getTime()
    : Date.now();

  let rateCutProb: number | undefined = undefined;
  let inflationProb: number | undefined = undefined;
  let recessionProb: number | undefined = undefined;

  let marketsCount = 0;

  for (const ev of events) {
    let latestPt: (typeof ev.history)[number] | undefined = undefined;
    let latestMs = -Infinity;

    for (let i = 0; i < ev.history.length; i++) {
      const pt = ev.history[i];
      if (!pt) continue;
      const ptMs = Date.parse(pt.asOf ?? pt.ts);
      if (ptMs <= cutoffMs && ptMs > latestMs) {
        latestMs = ptMs;
        latestPt = pt;
      }
    }

    if (!latestPt) continue;

    marketsCount += 1;

    if (ev.category === "fed_rate" || ev.marketSlug.includes("rate-cut") || ev.question.toLowerCase().includes("cut interest rates")) {
      rateCutProb = latestPt.probability;
    } else if (ev.category === "cpi_inflation" || ev.marketSlug.includes("cpi") || ev.question.toLowerCase().includes("cpi")) {
      inflationProb = latestPt.probability;
    } else if (ev.category === "recession" || ev.marketSlug.includes("recession") || ev.question.toLowerCase().includes("recession")) {
      recessionProb = latestPt.probability;
    }
  }

  if (marketsCount === 0) {
    return {
      macroRegime: "neutral_macro",
      direction: "neutral",
      strength: 0,
      marketsConsidered: 0,
      evidence: {
        marketsConsidered: 0,
        macroRegime: "neutral_macro",
        mechanicalDirection: "neutral",
        mechanicalStrength: 0,
      },
    };
  }

  // Evaluate Macro Regime & Quantitative Conviction
  let macroRegime: "dovish_easing" | "hawkish_tightening" | "stagflation_risk" | "neutral_macro" = "neutral_macro";
  let direction: Direction = "neutral";
  let strength = 0.0;

  const rec = recessionProb ?? 0.15;
  const cut = rateCutProb ?? 0.50;
  const inf = inflationProb ?? 0.30;

  if (rec >= 0.35) {
    macroRegime = "stagflation_risk";
    direction = "bearish";
    strength = Math.min(1.0, Math.max(0.3, rec));
  } else if (cut >= 0.65 && inf <= 0.35) {
    macroRegime = "dovish_easing";
    direction = "bullish";
    strength = Math.min(1.0, Math.max(0.4, (cut - 0.5) * 2));
  } else if (inf >= 0.50 || (cut < 0.35 && rec < 0.25)) {
    macroRegime = "hawkish_tightening";
    direction = "bearish";
    strength = Math.min(1.0, Math.max(0.35, Math.abs(0.5 - inf) * 2));
  } else if (cut >= 0.55) {
    macroRegime = "dovish_easing";
    direction = "bullish";
    strength = 0.3;
  } else {
    macroRegime = "neutral_macro";
    direction = "neutral";
    strength = 0.0;
  }

  const evidence: Record<string, string | number | boolean> = {
    marketsConsidered: marketsCount,
    macroRegime,
    mechanicalDirection: direction,
    mechanicalStrength: Math.round(strength * 1000) / 1000,
  };

  if (rateCutProb !== undefined) evidence.rateCutProbability = rateCutProb;
  if (inflationProb !== undefined) evidence.inflationExceedProbability = inflationProb;
  if (recessionProb !== undefined) evidence.recessionProbability = recessionProb;

  return {
    macroRegime,
    direction,
    strength: Math.round(strength * 1000) / 1000,
    rateCutProbability: rateCutProb,
    inflationExceedProbability: inflationProb,
    recessionProbability: recessionProb,
    marketsConsidered: marketsCount,
    evidence,
  };
}
