import {
  DebateSynthesis,
  type AgentInput,
  type AgentOutput,
  type Direction,
  type DebateCritique,
} from "@committee/contracts";

import { config } from "../../config.js";
import { createLlmClient, isLlmConfigured, type LlmClient } from "../technical/llm-client.js";
import {
  DEBATE_SYSTEM_PROMPT,
  DEBATE_TOOL_NAME,
  buildDebateUserPrompt,
  buildMultiRoundDebateUserPrompt,
  buildCrossExaminationPrompt,
  debateOutputToolSchema,
  normalizeDebateOutput,
  type DebatePromptContext,
} from "./prompt.js";

export interface DebateSynthesizerOptions {
  llm?: LlmClient;
  model?: string;
  maxTokens?: number;
  deterministicOffline?: boolean;
  debateRounds?: number;
}

export class DebateSynthesizer {
  private readonly llm: LlmClient | undefined;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly deterministicOffline: boolean;
  private readonly debateRounds: number;

  constructor(options: DebateSynthesizerOptions = {}) {
    this.deterministicOffline = options.deterministicOffline ?? false;
    this.model = options.model ?? config.LLM_CHEAP_MODEL;
    this.maxTokens = options.maxTokens ?? 1024;
    this.debateRounds = options.debateRounds ?? 1;

    if (options.llm) {
      this.llm = options.llm;
    } else if (!this.deterministicOffline && isLlmConfigured()) {
      this.llm = createLlmClient();
    } else {
      this.llm = undefined;
    }
  }

  getDebateRounds(): number {
    return this.debateRounds;
  }

  /**
   * Synthesize a reconciled stance from conflicting specialist outputs.
   * Supports both single-pass (R=1) and multi-round adversarial cross-examination (R=2).
   */
  async synthesize(
    context: DebatePromptContext,
    input?: AgentInput,
    roundsOverride?: number,
  ): Promise<DebateSynthesis> {
    const startedAt = Date.now();
    const effectiveRounds = roundsOverride ?? this.debateRounds;

    // Multi-round adversarial cross-examination (R=2)
    if (effectiveRounds >= 2) {
      return this.synthesizeMultiRound(context, startedAt, effectiveRounds);
    }

    // Single-pass debate synthesis (R=1)
    // Deterministic offline replay path ($0.00 cost, zero API dependency)
    if (this.deterministicOffline || !this.llm) {
      const synthetic = this.synthesizeDeterministic(context, 1);
      return {
        ...synthetic,
        rounds: 1,
        latencyMs: Date.now() - startedAt,
        tokenCost: 0,
      };
    }

    const request = {
      model: this.model,
      system: DEBATE_SYSTEM_PROMPT,
      user: buildDebateUserPrompt(context),
      toolName: DEBATE_TOOL_NAME,
      toolSchema: debateOutputToolSchema(),
      maxTokens: this.maxTokens,
    };

    const completion = await this.executeCompletion(request, 0);

    if (completion) {
      return {
        ...completion,
        rounds: 1,
        latencyMs: Date.now() - startedAt,
      };
    }

    // Fallback to deterministic synthesis on LLM error/schema exhaustion
    const fallback = this.synthesizeDeterministic(context, 1);
    return {
      ...fallback,
      rounds: 1,
      latencyMs: Date.now() - startedAt,
      tokenCost: 0,
    };
  }

  /**
   * Multi-round structured adversarial cross-examination (Round 1 critiques -> Round 2 adjudication).
   */
  private async synthesizeMultiRound(
    context: DebatePromptContext,
    startedAt: number,
    rounds: number = 2,
  ): Promise<DebateSynthesis> {
    // Generate Round 1 cross-examination critiques
    const critiques = this.generateCritiques(context);

    if (this.deterministicOffline || !this.llm) {
      const deterministic = this.synthesizeDeterministic(context, rounds, critiques);
      return {
        ...deterministic,
        rounds,
        critiques,
        latencyMs: Date.now() - startedAt,
        tokenCost: 0,
      };
    }

    // Live LLM multi-round synthesis (Round 2)
    const request = {
      model: this.model,
      system: DEBATE_SYSTEM_PROMPT,
      user: buildMultiRoundDebateUserPrompt(context, critiques),
      toolName: DEBATE_TOOL_NAME,
      toolSchema: debateOutputToolSchema(),
      maxTokens: this.maxTokens,
    };

    const completion = await this.executeCompletion(request, 0);

    if (completion) {
      return {
        ...completion,
        rounds,
        critiques,
        latencyMs: Date.now() - startedAt,
      };
    }

    const fallback = this.synthesizeDeterministic(context, rounds, critiques);
    return {
      ...fallback,
      rounds,
      critiques,
      latencyMs: Date.now() - startedAt,
      tokenCost: 0,
    };
  }

  /**
   * Generates Round 1 structured adversarial cross-examination critiques between conflicting specialists.
   */
  public generateCritiques(context: DebatePromptContext): DebateCritique[] {
    const { technical, sentiment, fundamental, polymarket } = context;
    const critiques: DebateCritique[] = [];

    // Technical critique of Sentiment
    const techRebuttal = sentiment.direction !== "neutral"
      ? `Price action and mathematical indicators (${technical.direction}, conf ${technical.confidence.toFixed(2)}) capture institutional capital flows that often lead headline news. Short-term sentiment noise (${sentiment.rationale}) is already priced in.`
      : `Technical indicators provide actionable price structure while sentiment remains neutral.`;

    critiques.push({
      agent: "technical",
      stance: technical.direction,
      rebuttal: techRebuttal,
      revisedConfidence: Math.round(technical.confidence * 0.95 * 1000) / 1000,
    });

    // Sentiment critique of Technical
    const sentRebuttal = technical.direction !== "neutral"
      ? `Moving averages and RSI indicators are inherently lagging. Current news flow and fundamental catalysts (${sentiment.direction}, conf ${sentiment.confidence.toFixed(2)}) indicate emerging trend reversal risks that lagging technicals fail to anticipate.`
      : `Point-in-time news headlines provide actionable catalysts while technical momentum is neutral.`;

    critiques.push({
      agent: "sentiment",
      stance: sentiment.direction,
      rebuttal: sentRebuttal,
      revisedConfidence: Math.round(sentiment.confidence * 0.95 * 1000) / 1000,
    });

    // Fundamental critique if present
    if (fundamental && fundamental.direction !== "neutral") {
      critiques.push({
        agent: "fundamental",
        stance: fundamental.direction,
        rebuttal: `SEC EDGAR balance sheet and cash flow metrics (${fundamental.direction}, conf ${fundamental.confidence.toFixed(2)}) establish intrinsic value boundaries that override short-term volatility.`,
        revisedConfidence: Math.round(fundamental.confidence * 0.98 * 1000) / 1000,
      });
    }

    // Polymarket critique if present
    if (polymarket && polymarket.direction !== "neutral") {
      critiques.push({
        agent: "polymarket",
        stance: polymarket.direction,
        rebuttal: `Crowdsourced prediction market odds (${polymarket.direction}, conf ${polymarket.confidence.toFixed(2)}) price in macroeconomic regime shifts beyond single-stock indicators.`,
        revisedConfidence: Math.round(polymarket.confidence * 0.95 * 1000) / 1000,
      });
    }

    return critiques;
  }

  /**
   * Deterministic debate reconciliation rule for offline evaluation and fallback.
   */
  public synthesizeDeterministic(
    context: DebatePromptContext,
    rounds: number = 1,
    critiques?: DebateCritique[],
  ): DebateSynthesis {
    const { technical, sentiment, fundamental, polymarket } = context;

    // Case 1: Direct opposing conflict (bullish vs bearish)
    const isDirectConflict =
      (technical.direction === "bullish" && sentiment.direction === "bearish") ||
      (technical.direction === "bearish" && sentiment.direction === "bullish") ||
      (fundamental && ((fundamental.direction === "bullish" && (technical.direction === "bearish" || sentiment.direction === "bearish")) ||
                       (fundamental.direction === "bearish" && (technical.direction === "bullish" || sentiment.direction === "bullish"))));

    if (isDirectConflict) {
      // If Fundamental specialist is present and takes a stance, use corporate financials as authoritative tiebreaker
      if (fundamental && fundamental.direction !== "neutral" && fundamental.confidence >= 0.2) {
        if (fundamental.direction === technical.direction) {
          return {
            direction: technical.direction,
            confidence: Math.round(Math.max(technical.confidence, fundamental.confidence) * 0.9 * 1000) / 1000,
            rationale: `SEC EDGAR fundamental metrics (${fundamental.direction}, ${fundamental.confidence.toFixed(2)}) corroborate Technical signal (${technical.confidence.toFixed(2)}) over conflicting sentiment.${rounds > 1 ? " Cross-examination confirmed fundamental thesis." : ""}`,
            dissentingView: `Sentiment specialist dissents on negative news flow (${sentiment.rationale}).`,
            primaryDriver: "fundamental",
            rounds,
            critiques,
            tokenCost: 0,
          };
        } else if (fundamental.direction === sentiment.direction) {
          return {
            direction: sentiment.direction,
            confidence: Math.round(Math.max(sentiment.confidence, fundamental.confidence) * 0.9 * 1000) / 1000,
            rationale: `SEC EDGAR fundamental metrics (${fundamental.direction}, ${fundamental.confidence.toFixed(2)}) corroborate Sentiment conviction (${sentiment.confidence.toFixed(2)}) over technical indicators.${rounds > 1 ? " Cross-examination confirmed fundamental thesis." : ""}`,
            dissentingView: `Technical specialist dissents based on price action (${technical.rationale}).`,
            primaryDriver: "fundamental",
            rounds,
            critiques,
            tokenCost: 0,
          };
        }
      }

      // If Polymarket specialist is present and takes a non-neutral stance, use macro odds as tiebreaker
      if (polymarket && polymarket.direction !== "neutral" && polymarket.confidence >= 0.2) {
        if (polymarket.direction === technical.direction) {
          return {
            direction: technical.direction,
            confidence: Math.round(Math.max(technical.confidence, polymarket.confidence) * 0.85 * 1000) / 1000,
            rationale: `Macro prediction market odds (${polymarket.direction}, ${polymarket.confidence.toFixed(2)}) break tie in favor of Technical conviction (${technical.confidence.toFixed(2)}).`,
            dissentingView: `Sentiment specialist dissents on headline flow (${sentiment.rationale}).`,
            primaryDriver: "macro",
            rounds,
            critiques,
            tokenCost: 0,
          };
        } else if (polymarket.direction === sentiment.direction) {
          return {
            direction: sentiment.direction,
            confidence: Math.round(Math.max(sentiment.confidence, polymarket.confidence) * 0.85 * 1000) / 1000,
            rationale: `Macro prediction market odds (${polymarket.direction}, ${polymarket.confidence.toFixed(2)}) confirm Sentiment conviction (${sentiment.confidence.toFixed(2)}) over Technical signal.`,
            dissentingView: `Technical specialist dissents (${technical.rationale}).`,
            primaryDriver: "macro",
            rounds,
            critiques,
            tokenCost: 0,
          };
        }
      }

      const confDiff = technical.confidence - sentiment.confidence;

      // Substantial confidence edge (>= 0.25)
      if (confDiff >= 0.25) {
        return {
          direction: technical.direction,
          confidence: Math.round(technical.confidence * 0.75 * 1000) / 1000,
          rationale: `Technical conviction (${technical.confidence.toFixed(2)}) significantly overrides bearish sentiment (${sentiment.confidence.toFixed(2)}).${rounds > 1 ? " Round 1 cross-examination preserved technical priority." : ""}`,
          dissentingView: `Sentiment specialist dissents on negative news flow (${sentiment.rationale}).`,
          primaryDriver: "technical",
          rounds,
          critiques,
          tokenCost: 0,
        };
      } else if (confDiff <= -0.25) {
        return {
          direction: sentiment.direction,
          confidence: Math.round(sentiment.confidence * 0.75 * 1000) / 1000,
          rationale: `Sentiment conviction (${sentiment.confidence.toFixed(2)}) overrides technical signal (${technical.confidence.toFixed(2)}).${rounds > 1 ? " Round 1 cross-examination maintained sentiment priority." : ""}`,
          dissentingView: `Technical specialist dissents based on indicator configuration (${technical.rationale}).`,
          primaryDriver: "sentiment",
          rounds,
          critiques,
          tokenCost: 0,
        };
      } else {
        // Balanced conflict -> Neutral compromise
        return {
          direction: "neutral",
          confidence: 0.0,
          rationale: `Direct conflict between specialists reconciled to neutral cash preservation.${rounds > 1 ? " Cross-examination confirmed irreducible impasse." : ""}`,
          dissentingView: `Specialists in direct directional conflict.`,
          primaryDriver: "compromise",
          rounds,
          critiques,
          tokenCost: 0,
        };
      }
    }

    // Case 2: One specialist is directional and the other is neutral
    if (technical.direction !== "neutral" && sentiment.direction === "neutral") {
      const boost = polymarket && polymarket.direction === technical.direction ? 1.0 : 0.85;
      return {
        direction: technical.direction,
        confidence: Math.round(technical.confidence * boost * 1000) / 1000,
        rationale: `Technical specialist provides actionable signal (${technical.direction}, ${technical.confidence.toFixed(2)}) in the absence of conflicting sentiment${polymarket?.direction === technical.direction ? " (reinforced by macro prediction market odds)" : ""}.`,
        dissentingView: `Sentiment specialist is neutral (${sentiment.rationale}).`,
        primaryDriver: "technical",
        rounds,
        critiques,
        tokenCost: 0,
      };
    }

    if (sentiment.direction !== "neutral" && technical.direction === "neutral") {
      const boost = polymarket && polymarket.direction === sentiment.direction ? 1.0 : 0.85;
      return {
        direction: sentiment.direction,
        confidence: Math.round(sentiment.confidence * boost * 1000) / 1000,
        rationale: `Sentiment specialist provides actionable news-driven signal (${sentiment.direction}, ${sentiment.confidence.toFixed(2)}) while technical indicators remain neutral${polymarket?.direction === sentiment.direction ? " (reinforced by macro odds)" : ""}.`,
        dissentingView: `Technical specialist is neutral (${technical.rationale}).`,
        primaryDriver: "sentiment",
        rounds,
        critiques,
        tokenCost: 0,
      };
    }

    // Case 3: Both technical and sentiment are neutral, but Polymarket has strong macro conviction
    if (polymarket && polymarket.direction !== "neutral" && polymarket.confidence >= 0.4) {
      return {
        direction: polymarket.direction,
        confidence: Math.round(polymarket.confidence * 0.7 * 1000) / 1000,
        rationale: `Macro prediction market specialist leads directional posture (${polymarket.direction}, ${polymarket.confidence.toFixed(2)}) while single-stock technical and sentiment indicators remain neutral.`,
        dissentingView: undefined,
        primaryDriver: "macro",
        rounds,
        critiques,
        tokenCost: 0,
      };
    }

    // Default neutral fallback
    return {
      direction: "neutral",
      confidence: 0.0,
      rationale: "Specialists neutral or uninformative.",
      dissentingView: undefined,
      primaryDriver: "compromise",
      rounds,
      critiques,
      tokenCost: 0,
    };
  }

  private async executeCompletion(
    request: Parameters<LlmClient["completeStructured"]>[0],
    attempt: number,
  ): Promise<DebateSynthesis | null> {
    if (!this.llm) return null;

    try {
      const raw = await this.llm.completeStructured(request);
      const normalized = normalizeDebateOutput(raw);
      const parsed = DebateSynthesis.safeParse(normalized);

      if (parsed.success) {
        return parsed.data;
      }

      if (attempt === 0) {
        return this.executeCompletion(request, 1);
      }
      return null;
    } catch {
      if (attempt === 0) {
        return this.executeCompletion(request, 1);
      }
      return null;
    }
  }
}
