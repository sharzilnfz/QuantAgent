import type {
  EpisodicReflection,
  LongTermMemoryItem,
  ShortTermDecisionItem,
} from "@committee/contracts";

/**
 * Seeded Long-Term Memory items for offline testing and deterministic benchmarks.
 * Contains company business model facts, general risk rules, and macro guidelines.
 */
export const FROZEN_LONG_TERM_MEMORY: LongTermMemoryItem[] = [
  {
    id: "e1000000-0000-0000-0000-000000000001",
    category: "risk_rule",
    symbol: null, // applies cross-asset
    title: "Overbought RSI Protection Rule",
    content:
      "When RSI(14) > 75 and price is above upper Bollinger Band, do not initiate new full-size long positions regardless of sentiment hype.",
    tags: ["risk", "rsi", "bollinger", "overbought"],
    metadata: { maxConvictionCap: 0.5 },
    asOf: "2023-01-01T00:00:00.000Z",
  },
  {
    id: "e1000000-0000-0000-0000-000000000002",
    category: "risk_rule",
    symbol: null,
    title: "Macro Event Pre-Announcement Volatility Rule",
    content:
      "Within 24 hours prior to scheduled FOMC interest rate decisions, reduce position sizing by 30% and tighten stop limits.",
    tags: ["macro", "fomc", "volatility", "risk"],
    metadata: { volatilityMultiplier: 1.3 },
    asOf: "2023-01-01T00:00:00.000Z",
  },
  {
    id: "e1000000-0000-0000-0000-000000000003",
    category: "company_fact",
    symbol: "AAPL",
    title: "Apple Services Margin & Ecosystem Moat",
    content:
      "Apple's Services segment generates >70% gross margins with high recurring subscription revenue, buffering hardware upgrade cycle cyclicality.",
    tags: ["AAPL", "services", "gross_margin", "ecosystem"],
    metadata: { segment: "services", marginPct: 72 },
    asOf: "2023-01-01T00:00:00.000Z",
  },
  {
    id: "e1000000-0000-0000-0000-000000000004",
    category: "company_fact",
    symbol: "NVDA",
    title: "NVIDIA Data Center GPU Monopoly",
    content:
      "NVIDIA Hopper/Blackwell compute architecture and CUDA software moat provide >80% market share in AI training clusters, but creates high revenue concentration among top cloud providers.",
    tags: ["NVDA", "datacenter", "cuda", "ai"],
    metadata: { concentrationRisk: true },
    asOf: "2023-01-01T00:00:00.000Z",
  },
  {
    id: "e1000000-0000-0000-0000-000000000005",
    category: "market_regime",
    symbol: "SPY",
    title: "SPY Trend Regime Filter",
    content:
      "When SPY trades above both 20-day and 50-day SMAs with neutral macro odds, equity risk premia favor trend-following over mean reversion.",
    tags: ["SPY", "regime", "trend"],
    metadata: { regime: "bull_trend" },
    asOf: "2023-01-01T00:00:00.000Z",
  },
];

/**
 * Seeded historical post-trade episodic reflections for offline replay.
 */
export const FROZEN_EPISODIC_REFLECTIONS: EpisodicReflection[] = [
  {
    id: "f1000000-0000-0000-0000-000000000001",
    symbol: "AAPL",
    tradeId: "trade-aapl-2023-q1",
    decisionTs: "2023-02-02T21:00:00.000Z",
    reviewTs: "2023-02-09T21:00:00.000Z",
    initialDirection: "bullish",
    initialConfidence: 0.85,
    outcomeReturnPct: 0.048,
    holdingBars: 5,
    critique:
      "Strong earnings beat was accurately forecasted by fundamental agent. Technical breakout above SMA20 confirmed follow-through.",
    lessonLearned:
      "Aligning positive fundamental margin expansion with technical momentum produces high win-rate entries.",
    contradictionDetected: false,
    asOf: "2023-02-09T21:00:00.000Z",
  },
  {
    id: "f1000000-0000-0000-0000-000000000002",
    symbol: "NVDA",
    tradeId: "trade-nvda-2023-pullback",
    decisionTs: "2023-08-24T20:00:00.000Z",
    reviewTs: "2023-08-31T20:00:00.000Z",
    initialDirection: "bullish",
    initialConfidence: 0.92,
    outcomeReturnPct: -0.054,
    holdingBars: 5,
    critique:
      "Extreme headline hype led to buying at the top of the gap despite RSI reaching 83. The stock pulled back to fill the open gap.",
    lessonLearned:
      "Never buy gap-ups when RSI > 80 regardless of how bullish the news sentiment appears.",
    contradictionDetected: true,
    contradictionDetails:
      "Sentiment agent was 0.95 bullish on earnings euphoria while technical indicators were severely overextended (RSI 83).",
    asOf: "2023-08-31T20:00:00.000Z",
  },
];

/**
 * Load frozen long-term memory items for a symbol.
 */
export function loadLongTermMemory(symbol?: string): LongTermMemoryItem[] {
  if (!symbol) return FROZEN_LONG_TERM_MEMORY;
  const sym = symbol.toUpperCase();
  return FROZEN_LONG_TERM_MEMORY.filter(
    (item) => item.symbol === null || item.symbol === sym,
  );
}

/**
 * Load frozen episodic reflections for a symbol.
 */
export function loadEpisodicReflections(symbol: string): EpisodicReflection[] {
  const sym = symbol.toUpperCase();
  return FROZEN_EPISODIC_REFLECTIONS.filter((r) => r.symbol === sym);
}
