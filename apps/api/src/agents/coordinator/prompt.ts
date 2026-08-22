import {
  DebateSynthesis,
  type AgentOutput,
  type Direction,
  type PriceBar,
  type MemoryContext,
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
  memory?: MemoryContext;
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

  let memorySection = "";
  if (ctx.memory) {
    const memoryParts: string[] = [];
    if (ctx.memory.shortTerm?.recentDecisions.length) {
      memoryParts.push(`- Recent Decisions (Short-Term): ${ctx.memory.shortTerm.recentDecisions.map((d) => `[${d.decisionTs.slice(0, 10)}: ${d.direction.toUpperCase()} (conf ${d.confidence.toFixed(2)}) - ${d.rationale}]`).join("; ")}`);
    }
    if (ctx.memory.longTerm.length) {
      memoryParts.push(`- Long-Term Rules & Corporate Memory: ${ctx.memory.longTerm.map((l) => `[${l.title}: ${l.content}]`).join("; ")}`);
    }
    if (ctx.memory.reflections.length) {
      memoryParts.push(`- Past Trade Reflections & Lessons Learned: ${ctx.memory.reflections.map((r) => `[${r.symbol} ${r.initialDirection} (outcome: ${(r.outcomeReturnPct * 100).toFixed(1)}%): ${r.lessonLearned}]`).join("; ")}`);
    }
    if (memoryParts.length > 0) {
      memorySection = `\n# Prior Memory & Post-Trade Lessons (as_of <= T)\n${memoryParts.join("\n")}\n`;
    }
  }

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
${fundamentalSection}${polymarketSection}${memorySection}
# Synthesis Task
Reconcile this disagreement. Select a reconciled bias ('bullish', 'bearish', or 'neutral'), assign a calibrated confidence [0, 1], state your synthesis rationale, identify the primary driver ('technical', 'sentiment', 'fundamental', 'macro', or 'compromise'), and articulate the dissenting view.`;
}


export function buildMultiRoundDebateUserPrompt(
  ctx: DebatePromptContext,
  critiques: { agent: string; stance: Direction; rebuttal: string; revisedConfidence: number }[],
): string {
  const basePrompt = buildDebateUserPrompt(ctx);
  const critiqueText = critiques
    .map(
      (c) =>
        `### ${c.agent.toUpperCase()} Specialist Counter-Critique (Round 1 Cross-Examination)\n- Maintained Stance: ${c.stance.toUpperCase()}\n- Revised Confidence: ${c.revisedConfidence.toFixed(2)}\n- Rebuttal & Critique: ${c.rebuttal}`,
    )
    .join("\n\n");

  return `${basePrompt}

# Round 1 Adversarial Cross-Examination Critiques
The specialists have reviewed each other's claims and submitted the following formal counter-critiques:

${critiqueText}

# Final Multi-Round Adjudication Task (Round 2)
Taking into account BOTH the original specialist signals and the Round 1 adversarial rebuttals/revised confidences, render a definitive final decision. Select the reconciled direction ('bullish', 'bearish', or 'neutral'), calibrated confidence [0, 1], full synthesis rationale, primary driver ('technical', 'sentiment', 'fundamental', 'macro', or 'compromise'), and articulated dissenting view.`;
}

export function buildCrossExaminationPrompt(
  ctx: DebatePromptContext,
  targetAgent: AgentOutput,
  opposingAgent: AgentOutput,
): string {
  return `# Adversarial Cross-Examination (Round 1)
You are the ${targetAgent.agent.toUpperCase()} Specialist for ${ctx.symbol} at ${ctx.decisionTs}.

Your initial stance was **${targetAgent.direction.toUpperCase()}** (${(targetAgent.confidence * 100).toFixed(0)}% confidence):
"${targetAgent.rationale}"

The opposing **${opposingAgent.agent.toUpperCase()}** Specialist has taken a conflicting stance of **${opposingAgent.direction.toUpperCase()}** (${(opposingAgent.confidence * 100).toFixed(0)}% confidence):
"${opposingAgent.rationale}"
Evidence: ${JSON.stringify(opposingAgent.evidence, null, 2)}

## Cross-Examination Task:
1. Directly critique the opposing specialist's evidence and methodology.
2. Defend why your evidence (indicators / news / filings / macro odds) should take priority.
3. State whether your conviction has changed, providing a revised confidence score [0.0, 1.0].`;
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
        enum: ["technical", "sentiment", "fundamental", "macro", "compromise"],
        description: "Which specialist view primarily drove the synthesized decision.",
      },
      rounds: {
        type: "integer",
        minimum: 1,
        maximum: 3,
        description: "Total debate rounds executed.",
      },
      critiques: {
        type: "array",
        items: {
          type: "object",
          properties: {
            agent: { type: "string" },
            stance: { type: "string", enum: ["bullish", "bearish", "neutral"] },
            rebuttal: { type: "string" },
            revisedConfidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["agent", "stance", "rebuttal", "revisedConfidence"],
        },
        description: "Adversarial cross-examination critiques from Round 1.",
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
    obj.primaryDriver === "fundamental" ||
    obj.primaryDriver === "macro" ||
    obj.primaryDriver === "compromise"
      ? obj.primaryDriver
      : "compromise";
  const rounds = typeof obj.rounds === "number" ? obj.rounds : 1;
  const critiques = Array.isArray(obj.critiques) ? obj.critiques : undefined;

  return {
    direction,
    confidence,
    rationale,
    dissentingView,
    primaryDriver,
    rounds,
    critiques,
  };
}
