import { z } from "zod";
import { Direction } from "./enums";

/**
 * Short-term working memory: recent decision consensus results, active positions,
 * and recent specialist debate history.
 */
export const ShortTermDecisionItem = z.object({
  id: z.string().uuid(),
  decisionTs: z.string().datetime(),
  symbol: z.string(),
  direction: Direction,
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  asOf: z.string().datetime(),
});
export type ShortTermDecisionItem = z.infer<typeof ShortTermDecisionItem>;

export const ShortTermMemory = z.object({
  recentDecisions: z.array(ShortTermDecisionItem).default([]),
  activePosition: z
    .object({
      symbol: z.string(),
      qty: z.number(),
      marketValue: z.number(),
      unrealizedPl: z.number(),
      entryPrice: z.number().optional(),
      entryTs: z.string().datetime().optional(),
    })
    .optional(),
  asOf: z.string().datetime(),
});
export type ShortTermMemory = z.infer<typeof ShortTermMemory>;

/**
 * Long-term semantic knowledge item (company facts, risk rules, market regime guidelines).
 */
export const LongTermMemoryCategory = z.enum([
  "company_fact",
  "risk_rule",
  "market_regime",
  "guidance",
]);
export type LongTermMemoryCategory = z.infer<typeof LongTermMemoryCategory>;

export const LongTermMemoryItem = z.object({
  id: z.string().uuid(),
  category: LongTermMemoryCategory,
  symbol: z.string().nullable().optional(), // null for cross-market rules
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  embedding: z.array(z.number()).optional(), // vector embedding for pgvector / cosine similarity
  metadata: z.record(z.string(), z.unknown()).default({}),
  asOf: z.string().datetime(), // moment this fact became knowable
});
export type LongTermMemoryItem = z.infer<typeof LongTermMemoryItem>;

/**
 * Post-trade episodic reflection: critique and lessons learned from past trade outcomes.
 */
export const EpisodicReflection = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  tradeId: z.string().optional(),
  decisionTs: z.string().datetime(), // timestamp of the original trade entry decision
  reviewTs: z.string().datetime(), // timestamp of the post-trade reflection analysis
  initialDirection: Direction,
  initialConfidence: z.number().min(0).max(1),
  outcomeReturnPct: z.number(), // e.g. +0.052 (+5.2%) or -0.031 (-3.1%)
  holdingBars: z.number().int().nonnegative(),
  critique: z.string(),
  lessonLearned: z.string(),
  contradictionDetected: z.boolean().default(false), // e.g. Bullish sentiment but price crashed
  contradictionDetails: z.string().optional(),
  asOf: z.string().datetime(), // reviewTs <= asOf <= current decisionTs
});
export type EpisodicReflection = z.infer<typeof EpisodicReflection>;

/**
 * Unified Memory Context payload provided to AgentInput.memory.
 * Every contained item is guaranteed to satisfy `asOf <= decisionTs`.
 */
export const MemoryContext = z.object({
  shortTerm: ShortTermMemory.optional(),
  longTerm: z.array(LongTermMemoryItem).default([]),
  reflections: z.array(EpisodicReflection).default([]),
  asOf: z.string().datetime(),
});
export type MemoryContext = z.infer<typeof MemoryContext>;
