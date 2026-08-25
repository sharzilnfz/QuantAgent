import {
  AgentOutput,
  AgentOutputJsonSchema,
  Direction,
  type AgentInput,
} from "@committee/contracts";
import type { MacroOddsClassification } from "./classify.js";

export const AGENT_OUTPUT_TOOL_NAME = "emit_macro_prediction_market_signal";

export const polymarketOutputToolSchema = {
  name: AGENT_OUTPUT_TOOL_NAME,
  description:
    "Emit the finalized Macro Prediction Market analysis stance, confidence, rationale, and evidence.",
  input_schema: AgentOutputJsonSchema,
};

export const POLYMARKET_SYSTEM_PROMPT = `You are the Macro Prediction Market Specialist in The Committee trading system.
Your role is to analyze crowdsourced real-money probability distributions from Polymarket Gamma API historical curves strictly knowable at decision timestamp T.
You interpret shifts in Fed rate cut probabilities, CPI inflation prints, and recession odds to assess systemic macroeconomic tailwinds or headwinds for equities.

Output rules:
1. You MUST call the '${AGENT_OUTPUT_TOOL_NAME}' tool exactly once.
2. Direction must be 'bullish', 'bearish', or 'neutral'.
3. Confidence is in [0, 1].
4. Rationale must cite specific probability values and macro regime shifts without inventing statistics.
5. All evidence facts must reflect the actual provided Polymarket data.`;

export function buildPolymarketUserPrompt(
  input: AgentInput,
  classification: MacroOddsClassification,
): string {
  const lines: string[] = [];
  lines.push(`Analyze macroeconomic prediction market conditions for ${input.symbol} as of ${input.decisionTs}.`);
  lines.push("");
  lines.push("Computed Macro Odds Facts (strictly as_of <= T_decision):");
  lines.push(`- Markets Considered: ${classification.marketsConsidered}`);
  lines.push(`- Macro Regime: ${classification.macroRegime}`);
  lines.push(`- Mechanical Direction: ${classification.direction}`);
  lines.push(`- Mechanical Conviction: ${(classification.strength * 100).toFixed(1)}%`);

  if (classification.rateCutProbability !== undefined) {
    lines.push(`- Rate Cut Probability: ${(classification.rateCutProbability * 100).toFixed(1)}%`);
  }
  if (classification.inflationExceedProbability !== undefined) {
    lines.push(`- CPI Inflation > 3% Probability: ${(classification.inflationExceedProbability * 100).toFixed(1)}%`);
  }
  if (classification.recessionProbability !== undefined) {
    lines.push(`- US Recession Probability: ${(classification.recessionProbability * 100).toFixed(1)}%`);
  }

  lines.push("");
  lines.push("Synthesize these crowdsourced probability distributions into an institutional macro stance.");

  return lines.join("\n");
}

export function normalizePolymarketModelOutput(
  raw: unknown,
  fallbackDirection: Direction = "neutral",
): AgentOutput {
  const parseResult = AgentOutput.safeParse(raw);
  if (parseResult.success) {
    return parseResult.data;
  }

  if (typeof raw === "object" && raw !== null) {
    const r = raw as Record<string, unknown>;
    const dir = Direction.safeParse(r.direction).success
      ? (r.direction as Direction)
      : fallbackDirection;
    const conf =
      typeof r.confidence === "number" && !Number.isNaN(r.confidence)
        ? Math.min(1, Math.max(0, r.confidence))
        : 0;
    const rat = typeof r.rationale === "string" && r.rationale.length > 0
      ? r.rationale
      : "polymarket macro probability assessment";

    return AgentOutput.parse({
      agent: "polymarket",
      direction: dir,
      confidence: conf,
      rationale: rat,
      evidence: (r.evidence as Record<string, string | number | boolean>) ?? {},
    });
  }

  return AgentOutput.parse({
    agent: "polymarket",
    direction: fallbackDirection,
    confidence: 0,
    rationale: "failed to parse polymarket model output",
    evidence: {},
  });
}
