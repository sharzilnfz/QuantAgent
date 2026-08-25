import { z } from "zod";
import { PriceBar, IndicatorSnapshot, NewsItem } from "./signals";
import { FundamentalReport } from "./fundamentals";
import { Trade } from "./backtest";
import { ConsensusResult } from "./debate";

/**
 * Full provenance audit trail for a discrete decision timestamp.
 * Allows the Decision Lineage Inspector UI to render exact inputs, prompts, completions, and fills.
 */
export const DecisionLineageRecord = z.object({
  id: z.string().uuid(),
  decisionTs: z.string().datetime(), // Point-in-time boundary: all inputs knowable <= decisionTs
  symbol: z.string(),
  inputBars: z.array(PriceBar),
  indicators: IndicatorSnapshot.nullable(),
  news: z.array(NewsItem).default([]),
  fundamentals: z.array(FundamentalReport).default([]),
  specialistPrompts: z.record(z.string(), z.string()).default({}), // AgentName -> rendered prompt text
  specialistCompletions: z.record(z.string(), z.unknown()).default({}), // AgentName -> raw LLM completion string/object
  consensusResult: ConsensusResult,
  executionFill: Trade.optional(), // Resulting simulated execution trade fill if position changed
  tokenCost: z.number().min(0).default(0).optional(),
  latencyMs: z.number().min(0).default(0).optional(),
});
export type DecisionLineageRecord = z.infer<typeof DecisionLineageRecord>;
