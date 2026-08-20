import { AgentOutputJsonSchema, type Direction, type FundamentalReport } from "@committee/contracts";

export const AGENT_OUTPUT_TOOL_NAME = "agent_output";

/**
 * Unwraps AgentOutputJsonSchema for forced tool calling.
 */
export function fundamentalOutputToolSchema(): Record<string, unknown> {
  const root = AgentOutputJsonSchema as {
    definitions?: Record<string, Record<string, unknown>>;
  };
  const definition = root.definitions?.AgentOutput;
  if (definition && definition.type === "object") return definition;
  return AgentOutputJsonSchema as Record<string, unknown>;
}

export const FUNDAMENTAL_SYSTEM_PROMPT = [
  "You are the fundamental analyst on a multi-agent quantitative trading committee.",
  "",
  "HARD RULES — these are enforced by code, not trust:",
  "1. Every SEC filing provided is point-in-time legal (filed on or before the decision timestamp).",
  "2. Financial line items and deterministic accounting ratios (margins, debt-to-equity, YoY growth, FCF) were computed upstream in code.",
  "   You must NOT invent or recall alternative unverified financial figures.",
  "3. The `evidence` field will be overwritten by verified mathematical facts.",
  "4. You output a directional bias ('bullish', 'bearish', or 'neutral'), a confidence score in [0, 1],",
  "   and a concise rationale (2 to 4 sentences) synthesizing corporate balance sheet strength, margin trends, and growth trajectory.",
  "",
  `Reply by calling the ${AGENT_OUTPUT_TOOL_NAME} tool. Set agent to "fundamental".`,
].join("\n");

export interface FundamentalPromptContext {
  symbol: string;
  decisionTs: string;
  latestReport?: FundamentalReport;
  mechanicalDirection: Direction;
  mechanicalConfidence: number;
}

export function buildFundamentalUserPrompt(ctx: FundamentalPromptContext): string {
  const r = ctx.latestReport;
  if (!r) {
    return [
      `Symbol: ${ctx.symbol}`,
      `Decision timestamp: ${ctx.decisionTs}`,
      "",
      "POINT-IN-TIME SEC FILINGS: (No SEC EDGAR reports filed on or before decision timestamp)",
      "Provide a neutral assessment due to absence of verified financial filings.",
    ].join("\n");
  }

  const growthStr = r.revenueGrowthYoY != null ? `${(r.revenueGrowthYoY * 100).toFixed(1)}%` : "N/A";

  return [
    `Symbol: ${ctx.symbol}`,
    `Decision timestamp: ${ctx.decisionTs}`,
    "",
    "POINT-IN-TIME SEC EDGAR FINANCIAL DISCLOSURE:",
    `  Form: ${r.form} (Fiscal Year: ${r.fiscalYear}, Period: ${r.fiscalPeriod})`,
    `  Period End Date: ${r.periodEndDate}`,
    `  SEC Acceptance / Filing Date: ${r.filedAt}`,
    "",
    "FINANCIAL LINE ITEMS (USD):",
    `  Revenue: $${(r.revenue / 1e9).toFixed(2)}B (YoY Growth: ${growthStr})`,
    `  Gross Profit: $${(r.grossProfit / 1e9).toFixed(2)}B (Gross Margin: ${(r.grossMargin * 100).toFixed(1)}%)`,
    `  Operating Income: $${(r.operatingIncome / 1e9).toFixed(2)}B (Operating Margin: ${(r.operatingMargin * 100).toFixed(1)}%)`,
    `  Net Income: $${(r.netIncome / 1e9).toFixed(2)}B (Net Margin: ${(r.netMargin * 100).toFixed(1)}%)`,
    `  Free Cash Flow: $${(r.freeCashFlow / 1e9).toFixed(2)}B`,
    `  Total Debt / Stockholders Equity (D/E): ${r.debtToEquity.toFixed(2)}`,
    r.currentRatio != null ? `  Current Ratio: ${r.currentRatio.toFixed(2)}` : "",
    "",
    "MECHANICAL CLASSIFICATION:",
    `  Mechanical Direction: ${ctx.mechanicalDirection} (Confidence: ${ctx.mechanicalConfidence})`,
    "",
    "Evaluate this financial disclosure and state whether corporate fundamentals support a bullish, bearish, or neutral stance.",
  ].filter(Boolean).join("\n");
}
