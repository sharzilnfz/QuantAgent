import { AgentOutputJsonSchema, type Direction, type NewsItem } from "@committee/contracts";

/** Name of the forced tool used to get structured output out of the model. */
export const AGENT_OUTPUT_TOOL_NAME = "agent_output";

/**
 * Unwraps AgentOutputJsonSchema for forced tool calling.
 */
export function sentimentOutputToolSchema(): Record<string, unknown> {
  const root = AgentOutputJsonSchema as {
    definitions?: Record<string, Record<string, unknown>>;
  };
  const definition = root.definitions?.AgentOutput;
  if (definition && definition.type === "object") return definition;
  return AgentOutputJsonSchema as Record<string, unknown>;
}

export const SENTIMENT_SYSTEM_PROMPT = [
  "You are the sentiment analyst on a multi-agent quantitative trading committee.",
  "",
  "HARD RULES — these are enforced by code, not trust:",
  "1. Every news headline provided is point-in-time legal (published on or before the decision timestamp).",
  "2. The mechanical sentiment polarity score and headline counts were computed deterministically upstream.",
  "   You must NOT invent, hallucinate, or recall additional news items.",
  "3. The `evidence` field will be overwritten by verified mechanical metrics. Do not try to fake figures.",
  "4. You output a directional bias ('bullish', 'bearish', or 'neutral'), a confidence score in [0, 1],",
  "   and a concise rationale (2 to 4 sentences) synthesizing the sentiment signals.",
  "",
  `Reply by calling the ${AGENT_OUTPUT_TOOL_NAME} tool. Set agent to "sentiment".`,
].join("\n");

export interface SentimentPromptContext {
  symbol: string;
  decisionTs: string;
  headlines: readonly (NewsItem | string)[];
  netScore: number;
  mechanicalDirection: Direction;
}

export function buildSentimentUserPrompt(ctx: SentimentPromptContext): string {
  const headlineList =
    ctx.headlines.length === 0
      ? "  (no point-in-time headlines available)"
      : ctx.headlines
          .map((h, i) => {
            if (typeof h === "string") return `  ${i + 1}. ${h}`;
            return `  ${i + 1}. [${h.publishedAt}] ${h.headline}${h.summary ? ` — ${h.summary}` : ""}`;
          })
          .join("\n");

  return [
    `Symbol: ${ctx.symbol}`,
    `Decision timestamp: ${ctx.decisionTs}`,
    "",
    "POINT-IN-TIME NEWS HEADLINES:",
    headlineList,
    "",
    "MECHANICAL CLASSIFICATION:",
    `  Mechanical Direction: ${ctx.mechanicalDirection}`,
    `  Net Sentiment Score: ${ctx.netScore}`,
    "",
    "Weigh these headlines and explain the market sentiment. Provide directional bias, confidence, and rationale.",
  ].join("\n");
}

/**
 * Normalizes raw model output to handle variations such as `bias` -> `direction`.
 */
export function normalizeSentimentModelOutput(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const obj = { ...(raw as Record<string, unknown>) };

  if (obj.direction === undefined && typeof obj.bias === "string") {
    obj.direction = obj.bias;
  }

  return obj;
}
