import type { Direction, NewsItem } from "@committee/contracts";

export interface SentimentClassification {
  readonly netScore: number;
  readonly direction: Direction;
  readonly strength: number;
  readonly bullishCount: number;
  readonly bearishCount: number;
  readonly neutralCount: number;
  readonly totalHeadlines: number;
  readonly evidence: Record<string, string | number | boolean>;
}

const BULLISH_KEYWORDS = [
  "surge",
  "surges",
  "surging",
  "surged",
  "jump",
  "jumps",
  "jumped",
  "jumping",
  "rally",
  "rallies",
  "rallied",
  "rallying",
  "soar",
  "soars",
  "soared",
  "soaring",
  "gain",
  "gains",
  "gained",
  "gaining",
  "beat",
  "beats",
  "beating",
  "outperform",
  "outperforms",
  "outperformed",
  "upgrade",
  "upgrades",
  "upgraded",
  "record high",
  "all-time high",
  "record revenue",
  "record profit",
  "bullish",
  "profit",
  "profits",
  "profitable",
  "growth",
  "boost",
  "boosts",
  "boosted",
  "raise",
  "raises",
  "raised",
  "strong",
  "stronger",
  "strength",
  "win",
  "wins",
  "won",
  "winning",
  "buy",
  "buyback",
  "upside",
  "breakout",
  "advance",
  "advances",
  "positive",
  "optimistic",
  "recovery",
  "rebound",
];

const BEARISH_KEYWORDS = [
  "plunge",
  "plunges",
  "plunged",
  "plunging",
  "drop",
  "drops",
  "dropped",
  "dropping",
  "fall",
  "falls",
  "fell",
  "falling",
  "slide",
  "slides",
  "slid",
  "sliding",
  "tumble",
  "tumbles",
  "tumbled",
  "tumbling",
  "miss",
  "misses",
  "missed",
  "missing",
  "underperform",
  "underperforms",
  "underperformed",
  "downgrade",
  "downgrades",
  "downgraded",
  "decline",
  "declines",
  "declined",
  "declining",
  "loss",
  "losses",
  "slump",
  "slumps",
  "slumped",
  "bearish",
  "crash",
  "crashes",
  "crashed",
  "warning",
  "warns",
  "warned",
  "lower",
  "lowers",
  "lowered",
  "weak",
  "weaker",
  "weakness",
  "cut",
  "cuts",
  "cutting",
  "selloff",
  "sell-off",
  "downside",
  "investigation",
  "probe",
  "lawsuit",
  "sued",
  "fraud",
  "negative",
  "pessimistic",
  "recession",
  "default",
  "bankruptcy",
];

function scoreHeadline(text: string): { polarity: "bullish" | "bearish" | "neutral"; posScore: number; negScore: number } {
  const lower = text.toLowerCase();
  let posScore = 0;
  let negScore = 0;

  for (const kw of BULLISH_KEYWORDS) {
    // Regex matches word boundary or phrase
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(lower)) {
      posScore += 1;
    }
  }

  for (const kw of BEARISH_KEYWORDS) {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(lower)) {
      negScore += 1;
    }
  }

  if (posScore > negScore) return { polarity: "bullish", posScore, negScore };
  if (negScore > posScore) return { polarity: "bearish", posScore, negScore };
  return { polarity: "neutral", posScore, negScore };
}

/**
 * Classify sentiment from string headlines deterministically.
 */
export function classifyHeadlines(headlines: readonly string[]): SentimentClassification {
  if (headlines.length === 0) {
    return {
      netScore: 0,
      direction: "neutral",
      strength: 0,
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
      totalHeadlines: 0,
      evidence: {
        headlinesConsidered: 0,
        netSentimentScore: 0,
        bullishCount: 0,
        bearishCount: 0,
        neutralCount: 0,
        mechanicalDirection: "neutral",
        mechanicalStrength: 0,
      },
    };
  }

  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  for (const text of headlines) {
    const { polarity } = scoreHeadline(text);
    if (polarity === "bullish") bullishCount += 1;
    else if (polarity === "bearish") bearishCount += 1;
    else neutralCount += 1;
  }

  const totalHeadlines = headlines.length;
  const netScore = Math.round(((bullishCount - bearishCount) / totalHeadlines) * 1000) / 1000;

  let direction: Direction = "neutral";
  if (netScore > 0.1) {
    direction = "bullish";
  } else if (netScore < -0.1) {
    direction = "bearish";
  }

  const strength = Math.min(1, Math.max(0, Math.round(Math.abs(netScore) * 1000) / 1000));

  return {
    netScore,
    direction,
    strength,
    bullishCount,
    bearishCount,
    neutralCount,
    totalHeadlines,
    evidence: {
      headlinesConsidered: totalHeadlines,
      netSentimentScore: netScore,
      bullishCount,
      bearishCount,
      neutralCount,
      mechanicalDirection: direction,
      mechanicalStrength: strength,
    },
  };
}

/**
 * Deterministic keyword polarity classifier analyzing news items point-in-time.
 */
export function classifySentimentHeadlines(
  headlines: readonly (NewsItem | string)[],
): SentimentClassification {
  const texts = headlines.map((item) => (typeof item === "string" ? item : item.headline));
  return classifyHeadlines(texts);
}
