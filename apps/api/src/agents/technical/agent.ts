import {
  AgentOutput,
  type AgentInput,
  type AgentName,
  type IndicatorSnapshot,
} from "@committee/contracts";

import { config } from "../../config.js";
import { BaseAgent, NO_OPINION, type BaseAgentOptions } from "../base.js";
import { classify, hasNoUsableFacts, type IndicatorFacts } from "./classify.js";
import { AnthropicLlmClient, type LlmClient } from "./llm-client.js";
import {
  AGENT_OUTPUT_TOOL_NAME,
  TECHNICAL_SYSTEM_PROMPT,
  agentOutputToolSchema,
  buildTechnicalUserPrompt,
} from "./prompt.js";
import {
  resolveDefaultSnapshotProvider,
  type SnapshotProvider,
} from "./snapshots.js";

/**
 * Spec 07 — the Technical Analyst Agent. The first *real* agent.
 *
 * Pipeline (each step is a law being obeyed):
 *
 *   1. POINT-IN-TIME    fetch the latest indicator snapshot with `as_of <= decisionTs`.
 *                       Missing snapshot -> NO_OPINION. Never a fabricated bias.
 *   2. FACTS            `classify()` computes the mechanical read in TypeScript.
 *   3. NARRATION        ONE cheap-tier LLM call weighs and explains those facts.
 *   4. VALIDATION       the reply is untrusted until `AgentOutput.parse` passes;
 *                       parse failure -> one retry -> NO_OPINION. Never a crash.
 *   5. FACTS WIN        `evidence` is rebuilt from the COMPUTED values, spread last,
 *                       so a model that narrates the wrong RSI cannot overwrite it.
 */
export interface TechnicalAgentOptions extends BaseAgentOptions {
  /** Injectable LLM seam. Defaults to the real Claude client. */
  llm?: LlmClient;
  /**
   * `undefined` -> Postgres when `DATABASE_URL` is set, else none.
   * `null`      -> no provider at all (rely solely on `input.indicators`).
   */
  snapshots?: SnapshotProvider | null;
  /** Cheap tier. Defaults to `config.LLM_CHEAP_MODEL` (`claude-haiku-4-5`). */
  model?: string;
  maxTokens?: number;
}

export class TechnicalAgent extends BaseAgent {
  readonly name: AgentName = "technical";

  private readonly llm: LlmClient;
  private readonly snapshots: SnapshotProvider | null;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(options: TechnicalAgentOptions = {}) {
    super(options);
    this.llm = options.llm ?? createLlmClient();
    this.snapshots =
      options.snapshots === undefined
        ? resolveDefaultSnapshotProvider()
        : options.snapshots;
    this.model = options.model ?? config.LLM_CHEAP_MODEL;
    this.maxTokens = options.maxTokens ?? 1024;
  }

  protected async run(input: AgentInput): Promise<AgentOutput> {
    const snapshot = await this.resolveSnapshot(input);

    // No legal point-in-time snapshot -> say nothing. Do NOT guess a bias.
    if (!snapshot) {
      this.logger({
        event: "technical.no_snapshot",
        runId: input.runId,
        agent: this.name,
        symbol: input.symbol,
        decisionTs: input.decisionTs,
        outcome: "skipped",
      });
      return NO_OPINION(this.name, "error");
    }

    const facts: IndicatorFacts = {
      rsi: snapshot.rsi,
      macd: snapshot.macd,
      macdSignal: snapshot.macdSignal,
      bbUpper: snapshot.bbUpper,
      bbLower: snapshot.bbLower,
      sma20: snapshot.sma20,
      sma50: snapshot.sma50,
      close: this.pointInTimeClose(input),
    };

    const read = classify(facts);

    // A snapshot row exists but every indicator is null — nothing to reason over.
    if (hasNoUsableFacts(read)) {
      this.logger({
        event: "technical.empty_snapshot",
        runId: input.runId,
        agent: this.name,
        symbol: input.symbol,
        outcome: "skipped",
      });
      return NO_OPINION(this.name, "error");
    }

    const request = {
      model: this.model,
      system: TECHNICAL_SYSTEM_PROMPT,
      user: buildTechnicalUserPrompt({
        symbol: input.symbol,
        timeframe: input.timeframe,
        decisionTs: input.decisionTs,
        snapshotAsOf: snapshot.asOf,
        read,
      }),
      toolName: AGENT_OUTPUT_TOOL_NAME,
      toolSchema: agentOutputToolSchema(),
      maxTokens: this.maxTokens,
    };

    // ONE call, plus at most ONE retry on a malformed/failed reply.
    const narration = await this.narrate(request, input, 0);
    if (!narration) return NO_OPINION(this.name, "error");

    const agree = narration.direction === read.direction;

    return {
      agent: this.name,
      direction: narration.direction,
      confidence: blendConfidence(read.strength, narration.confidence, agree),
      rationale: narration.rationale,
      evidence: {
        // Model-authored keys first...
        ...narration.evidence,
        // ...then the COMPUTED facts, which overwrite anything that collides.
        // This single ordering is what enforces facts-vs-narration.
        ...read.evidence,
        snapshotAsOf: snapshot.asOf,
        snapshotTs: snapshot.ts,
        decisionTs: input.decisionTs,
        modelDirection: narration.direction,
        modelConfidence: narration.confidence,
        modelAgreesWithRules: agree,
        model: this.model,
      },
    };
  }

  /**
   * Point-in-time snapshot resolution.
   *
   * Prefer `input.indicators` when the orchestrator supplied it, but ASSERT its
   * `asOf` is legal first — an illegal snapshot is discarded and we fall back to a
   * provider lookup, which applies the `as_of <= decisionTs` filter itself.
   */
  private async resolveSnapshot(input: AgentInput): Promise<IndicatorSnapshot | null> {
    const boundary = Date.parse(input.decisionTs);
    const supplied = input.indicators;

    if (supplied) {
      if (Date.parse(supplied.asOf) <= boundary) return supplied;
      this.logger({
        event: "technical.pit_violation_rejected",
        runId: input.runId,
        agent: this.name,
        symbol: input.symbol,
        decisionTs: input.decisionTs,
        outcome: "invalid",
        detail: `supplied snapshot asOf=${supplied.asOf} is after decisionTs`,
      });
    }

    if (!this.snapshots) return null;
    return this.snapshots.latestSnapshot({
      symbol: input.symbol,
      timeframe: input.timeframe,
      decisionTs: input.decisionTs,
    });
  }

  /** Latest bar close that was knowable at `decisionTs`. Never a later bar. */
  private pointInTimeClose(input: AgentInput): number | null {
    const boundary = Date.parse(input.decisionTs);
    let best: { asOf: number; close: number } | null = null;

    for (const bar of input.bars) {
      const asOf = Date.parse(bar.asOf);
      if (Number.isNaN(asOf) || asOf > boundary) continue;
      if (!best || asOf > best.asOf) best = { asOf, close: bar.close };
    }

    return best?.close ?? null;
  }

  /** One LLM call; on validation failure retry exactly once, then give up cleanly. */
  private async narrate(
    request: Parameters<LlmClient["completeStructured"]>[0],
    input: AgentInput,
    attempt: number,
  ): Promise<AgentOutput | null> {
    let raw: unknown;
    try {
      raw = await this.llm.completeStructured(request);
    } catch (err) {
      this.logger({
        event: "technical.llm_failed",
        runId: input.runId,
        agent: this.name,
        outcome: "error",
        attempt,
        detail: err instanceof Error ? err.message : String(err),
      });
      return attempt === 0 ? this.narrate(request, input, 1) : null;
    }

    // UNTRUSTED until it parses.
    const parsed = AgentOutput.safeParse(raw);
    if (parsed.success && parsed.data.agent === this.name) return parsed.data;

    this.logger({
      event: "technical.llm_invalid",
      runId: input.runId,
      agent: this.name,
      outcome: "invalid",
      attempt,
      detail: parsed.success
        ? `agent name mismatch: ${parsed.data.agent}`
        : parsed.error.issues.map((issue) => issue.path.join(".") || "root").join(","),
    });

    return attempt === 0 ? this.narrate(request, input, 1) : null;
  }
}

/**
 * Confidence blend (spec 07 §5 — "document the blend; keep it explainable").
 *
 *   agreement    -> 50% mechanical strength + 50% the model's stated conviction
 *   disagreement -> the same blend, halved
 *
 * Rationale: the rules and the narrator are treated as equal voices when they
 * agree. When the model overrides the mechanical read it may be right, so we let
 * its direction stand — but the committee should not act strongly on a call that
 * the deterministic evidence does not support, so conviction is cut in half.
 */
export function blendConfidence(
  mechanicalStrength: number,
  modelConfidence: number,
  agree: boolean,
): number {
  const base = 0.5 * mechanicalStrength + 0.5 * modelConfidence;
  const blended = agree ? base : base * 0.5;
  return Math.round(Math.min(1, Math.max(0, blended)) * 1000) / 1000;
}
