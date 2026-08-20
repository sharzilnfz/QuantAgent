import {
  DebateSynthesis,
  type AgentOutput,
  type Direction,
  type PriceBar,
} from "@committee/contracts";

export const DEBATE_TOOL_NAME = "emit_debate_synthesis";

export const DEBATE_SYSTEM_PROMPT = `You are the Synthesis Coordinator and Head of Strategy for an algorithmic trading committee.
Your role is to reconcile conflicting assessments from two specialist agents:
1. Technical Analyst (relying on price action, moving averages, RSI, and MACD indicators)
2. Sentiment Analyst (relying strictly on point-in-time financial news headlines)

Your objective:
- Weigh the evidence and conviction presented by each specialist.
- Resolve directional conflicts decisively into a final bias: "bullish", "bearish", or "neutral".
- Explicitly explain why one specialist overrides the other, or why conflicting signals warrant a neutral compromise.
- Document the dissenting view so risk inspectors have full transparency.
- Provide a well-calibrated confidence score in [0.0, 1.0].
- You MUST respond exclusively by calling the '${DEBATE_TOOL_NAME}' tool.`;

export interface DebatePromptContext {
  symbol: string;
  decisionTs: string;
  currentBar?: PriceBar;
  technical: AgentOutput;
  sentiment: AgentOutput;
  fundamental?: AgentOutput;
  polymarket?: AgentOutput;
}

export function buildDebateUserPrompt(ctx: DebatePromptContext): string {
  const priceInfo = ctx.currentBar
    ? `Current Price: $${ctx.currentBar.close.toFixed(2)} (Open: $${ctx.currentBar.open.toFixed(2)}, High: $${ctx.currentBar.high.toFixed(2)}, Low: $${ctx.currentBar.low.toFixed(2)}, Volume: ${ctx.currentBar.volume.toLocaleString()})`
    : `Price Action: Available in technical evidence.`;

  const fundamentalSection = ctx.fundamental
    ? `\n## 3. Fundamental Specialist (SEC EDGAR XBRL)\n- Directional Stance: ${ctx.fundamental.direction.toUpperCase()}\n- Stated Confidence: ${ctx.fundamental.confidence.toFixed(2)}\n- Rationale: ${ctx.fundamental.rationale}\n- Point-in-Time Financial Evidence: ${JSON.stringify(ctx.fundamental.evidence, null, 2)}\n`
    : "";

  const polymarketSection = ctx.polymarket
    ? `\n## ${ctx.fundamental ? "4" : "3"}. Macro Prediction Market Specialist (Polymarket)\n- Directional Stance: ${ctx.polymarket.direction.toUpperCase()}\n- Stated Confidence: ${ctx.polymarket.confidence.toFixed(2)}\n- Rationale: ${ctx.polymarket.rationale}\n- Crowdsourced Odds Evidence: ${JSON.stringify(ctx.polymarket.evidence, null, 2)}\n`
    : "";

  return `# Market State Snapshot
- Symbol: ${ctx.symbol}
- Decision Timestamp (as_of <= T): ${ctx.decisionTs}
- ${priceInfo}

# Specialist Signals Under Debate

## 1. Technical Specialist
- Directional Stance: ${ctx.technical.direction.toUpperCase()}
- Stated Confidence: ${ctx.technical.confidence.toFixed(2)}
- Rationale: ${ctx.technical.rationale}
- Computed Evidence: ${JSON.stringify(ctx.technical.evidence, null, 2)}

## 2. Sentiment Specialist
- Directional Stance: ${ctx.sentiment.direction.toUpperCase()}
- Stated Confidence: ${ctx.sentiment.confidence.toFixed(2)}
- Rationale: ${ctx.sentiment.rationale}
- Point-in-Time Evidence: ${JSON.stringify(ctx.sentiment.evidence, null, 2)}
${fundamentalSection}${polymarketSection}
# Synthesis Task
Reconcile this disagreement. Select a reconciled bias ('bullish', 'bearish', or 'neutral'), assign a calibrated confidence [0, 1], state your synthesis rationale, identify the primary driver ('technical', 'sentiment', 'fundamental', 'macro', or 'compromise'), and articulate the dissenting view.`;
}

export function debateOutputToolSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      direction: {
        type: "string",
        enum: ["bullish", "bearish", "neutral"],
        description: "Reconciled directional bias for the committee decision.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Calibrated conviction in the synthesized stance [0, 1].",
      },
      rationale: {
        type: "string",
        description: "Clear strategic explanation reconciling the specialist disagreement.",
      },
      dissentingView: {
        type: "string",
        description: "Summary of the dissenting specialist argument and why it was overridden or compromised.",
      },
      primaryDriver: {
        type: "string",
        enum: ["technical", "sentiment", "compromise"],
        description: "Which specialist view primarily drove the synthesized decision.",
      },
    },
    required: ["direction", "confidence", "rationale"],
  };
}

export function normalizeDebateOutput(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;

  const obj = raw as Record<string, unknown>;

  // Handle key aliases if model used reconciledBias instead of direction
  const direction = (obj.direction ?? obj.reconciledBias ?? obj.bias) as Direction;
  const confidence =
    typeof obj.confidence === "number" ? Math.min(1, Math.max(0, obj.confidence)) : 0;
  const rationale = typeof obj.rationale === "string" ? obj.rationale : "";
  const dissentingView =
    typeof obj.dissentingView === "string"
      ? obj.dissentingView
      : typeof obj.dissent === "string"
        ? obj.dissent
        : undefined;
  const primaryDriver =
    obj.primaryDriver === "technical" ||
    obj.primaryDriver === "sentiment" ||
    obj.primaryDriver === "compromise"
      ? obj.primaryDriver
      : "compromise";

  return {
    direction,
    confidence,
    rationale,
    dissentingView,
    primaryDriver,
  };
}
