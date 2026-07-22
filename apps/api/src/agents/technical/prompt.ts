import { AgentOutputJsonSchema } from "@committee/contracts";

import type { MechanicalRead } from "./classify.js";

/**
 * Spec 07 §5 — THE NARRATION SIDE.
 *
 * The prompt hands the model FACTS THAT ARE ALREADY COMPUTED and asks it to do the
 * one thing code cannot: weigh conflicting signals and explain the call in prose.
 *
 * It is told explicitly that it must not compute, estimate, or restate any number,
 * and that `evidence` is overwritten by the computed values regardless of what it
 * puts there. The prompt is a request; `agent.ts` is the enforcement.
 */

/** Name of the forced tool used to get structured output out of the model. */
export const AGENT_OUTPUT_TOOL_NAME = "emit_agent_output";

/**
 * `AgentOutputJsonSchema` is a `$ref` wrapper around `definitions.AgentOutput`.
 * The Messages API wants a bare object schema, so unwrap the definition — it is
 * self-contained (the enums inline), so nothing is lost.
 *
 * Deriving this from the Zod schema keeps ONE source of truth: if spec 02 changes
 * the contract, the tool schema changes with it automatically.
 */
export function agentOutputToolSchema(): Record<string, unknown> {
  const root = AgentOutputJsonSchema as {
    definitions?: Record<string, Record<string, unknown>>;
  };
  const definition = root.definitions?.AgentOutput;
  if (definition && definition.type === "object") return definition;
  // Fall back to the whole document rather than throwing — a schema-shape change
  // upstream must not take the agent down.
  return AgentOutputJsonSchema as Record<string, unknown>;
}

export const TECHNICAL_SYSTEM_PROMPT = [
  "You are the technical analyst on a multi-agent trading committee.",
  "",
  "HARD RULES — these are enforced by code, not trust:",
  "1. Every number you are given was computed deterministically upstream. You must",
  "   NOT compute, estimate, infer, recall, or restate any number of your own.",
  "2. If you mention a figure in your rationale, it must be one of the values given",
  "   to you, quoted exactly. Never round, adjust, or invent a value.",
  "3. The `evidence` field is populated by code from the computed indicator values.",
  "   Anything you put there is discarded. Do not try to author it.",
  "4. You are not forecasting prices or recommending a trade size. You output a",
  "   directional bias, a conviction level, and the reasoning behind it.",
  "",
  "YOUR JOB: weigh the mechanical read against the individual signals and explain,",
  "in two to four sentences, why the bias is what it is. You may confirm the",
  "mechanical bias or argue for a different one — but if you diverge, say why in",
  "terms of the signals you were given.",
  "",
  `Reply by calling the ${AGENT_OUTPUT_TOOL_NAME} tool. Set agent to "technical".`,
].join("\n");

export interface TechnicalPromptContext {
  symbol: string;
  timeframe: string;
  decisionTs: string;
  /** `as_of` of the snapshot actually used — always <= decisionTs. */
  snapshotAsOf: string;
  read: MechanicalRead;
}

export function buildTechnicalUserPrompt(ctx: TechnicalPromptContext): string {
  const { read } = ctx;

  const firedRules =
    read.signals.length === 0
      ? "  (no rule fired — every indicator read neutral)"
      : read.signals
          .map((s) => `  - ${s.rule}: ${s.direction} (weight ${s.weight})`)
          .join("\n");

  const facts = Object.entries(read.evidence)
    .map(([key, value]) => `  ${key}: ${String(value)}`)
    .join("\n");

  return [
    `Symbol: ${ctx.symbol}`,
    `Timeframe: ${ctx.timeframe}`,
    `Decision timestamp: ${ctx.decisionTs}`,
    `Indicator snapshot as-of: ${ctx.snapshotAsOf} (point-in-time legal)`,
    "",
    "COMPUTED FACTS (authoritative — do not restate as your own figures):",
    facts,
    "",
    "DETERMINISTIC RULES THAT FIRED:",
    firedRules,
    "",
    `MECHANICAL READ: ${read.direction} with strength ${read.strength}`,
    `(signed score ${read.score} over ${read.coverage} indicator coverage)`,
    "",
    "Weigh these signals and explain the bias. Do not introduce any number that is",
    "not listed above.",
  ].join("\n");
}
