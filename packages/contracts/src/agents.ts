import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AgentName, Direction, Timeframe } from "./enums";
import { PriceBar, IndicatorSnapshot, NewsItem } from "./signals";
import { PredictionMarketEvent } from "./polymarket";
import { FundamentalReport } from "./fundamentals";

/**
 * L2 agent I/O contracts. Raw model text is UNTRUSTED until it parses against `AgentOutput`.
 *
 * Contract-change protocol: any edit to `AgentInput`/`AgentOutput` is a cross-team event.
 * Bump `CONTRACTS_VERSION`, note it in spec 02's changelog, and ping owners of specs 01/06/07/08.
 */

/**
 * Semantic version of the agent I/O contracts. Bump on any breaking change to
 * `AgentInput` / `AgentOutput`. Consumers may assert compatibility against this.
 */
export const CONTRACTS_VERSION = "1.5.0";

/**
 * What the orchestrator hands an agent. Bounded to what is knowable at `decisionTs`:
 * every `bars[i].asOf` and `indicators.asOf` must be <= `decisionTs` (enforced upstream).
 */
export const AgentInput = z.object({
  runId: z.string().uuid(),
  symbol: z.string(),
  timeframe: Timeframe,
  decisionTs: z.string().datetime(),
  bars: z.array(PriceBar), // as_of <= decisionTs, enforced upstream
  indicators: IndicatorSnapshot.nullable(),
  news: z.array(NewsItem).optional(), // as_of <= decisionTs, optional point-in-time news
  predictionMarkets: z.array(PredictionMarketEvent).optional(), // as_of <= decisionTs, optional prediction market events
  fundamentals: z.array(FundamentalReport).optional(), // as_of <= decisionTs, optional point-in-time financial statements
  memory: z.unknown().optional(), // filled in Sprint 3
});
export type AgentInput = z.infer<typeof AgentInput>;

/**
 * What every agent MUST return. Untrusted model text is parsed against this; a validation
 * failure is a handled error, not a crash.
 *
 * `evidence` is the anti-hallucination hook: the agent fills it with the *already-computed*
 * facts (indicator values) it reasoned over, so a reviewer can check narration against numbers.
 * `confidence` is always [0,1]; `rationale` length is bounded so a runaway response can't bloat storage.
 */
export const AgentOutput = z.object({
  agent: AgentName,
  direction: Direction,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(2000),
  // agent-specific evidence the LLM narrated over (never numbers it invented):
  evidence: z
    .record(z.string(), z.union([z.number(), z.string(), z.boolean()]))
    .default({}),
});
export type AgentOutput = z.infer<typeof AgentOutput>;

/**
 * JSON-Schema (draft-07) export of `AgentOutput`, derived from the Zod schema so there is a
 * single source of truth. Used by the technical agent (spec 07) to request structured LLM
 * output and by the quant service to validate the same payload.
 */
export const AgentOutputJsonSchema = zodToJsonSchema(AgentOutput, "AgentOutput");

/**
 * `GET /agents/latest` response: the run envelope plus its validated outputs.
 * An absent run is signalled by a 404 (`no_runs_for_symbol`), not an empty envelope.
 */
export const AgentRunEnvelope = z.object({
  runId: z.string().uuid(),
  symbol: z.string(),
  timeframe: Timeframe,
  decisionTs: z.string().datetime(),
  status: z.string(),
  outputs: z.array(AgentOutput),
});
export type AgentRunEnvelope = z.infer<typeof AgentRunEnvelope>;
