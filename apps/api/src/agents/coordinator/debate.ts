import {
  DebateSynthesis,
  type AgentInput,
  type AgentOutput,
  type Direction,
} from "@committee/contracts";

import { config } from "../../config.js";
import { createLlmClient, type LlmClient } from "../technical/llm-client.js";
import {
  DEBATE_SYSTEM_PROMPT,
  DEBATE_TOOL_NAME,
  buildDebateUserPrompt,
  debateOutputToolSchema,
  normalizeDebateOutput,
  type DebatePromptContext,
} from "./prompt.js";

export interface DebateSynthesizerOptions {
  llm?: LlmClient;
  model?: string;
  maxTokens?: number;
  deterministicOffline?: boolean;
}

export class DebateSynthesizer {
  private readonly llm: LlmClient | undefined;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly deterministicOffline: boolean;

  constructor(options: DebateSynthesizerOptions = {}) {
    this.deterministicOffline = options.deterministicOffline ?? false;
    this.model = options.model ?? config.LLM_CHEAP_MODEL;
    this.maxTokens = options.maxTokens ?? 1024;

    if (options.llm) {
      this.llm = options.llm;
    } else if (!this.deterministicOffline && config.ANTHROPIC_API_KEY) {
      this.llm = createLlmClient();
    } else {
      this.llm = undefined;
    }
  }

  /**
   * Synthesize a reconciled stance from conflicting specialist outputs.
   */
  async synthesize(
    context: DebatePromptContext,
    input?: AgentInput,
  ): Promise<DebateSynthesis> {
    const startedAt = Date.now();

    // Deterministic offline replay path ($0.00 cost, zero API dependency)
    if (this.deterministicOffline || !this.llm) {
      const synthetic = this.synthesizeDeterministic(context);
      return {
        ...synthetic,
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
        latencyMs: Date.now() - startedAt,
      };
    }

    // Fallback to deterministic synthesis on LLM error/schema exhaustion
    const fallback = this.synthesizeDeterministic(context);
    return {
      ...fallback,
      latencyMs: Date.now() - startedAt,
      tokenCost: 0,
    };
  }

  /**
   * Deterministic debate reconciliation rule for offline evaluation and fallback.
   */
  public synthesizeDeterministic(context: DebatePromptContext): DebateSynthesis {
    const { technical, sentiment } = context;

    // Case 1: Direct opposing conflict (bullish vs bearish)
    const isDirectConflict =
      (technical.direction === "bullish" && sentiment.direction === "bearish") ||
      (technical.direction === "bearish" && sentiment.direction === "bullish");

    if (isDirectConflict) {
      const confDiff = technical.confidence - sentiment.confidence;

      // Substantial confidence edge (>= 0.25)
      if (confDiff >= 0.25) {
        return {
          direction: technical.direction,
          confidence: Math.round(technical.confidence * 0.75 * 1000) / 1000,
          rationale: `Technical conviction (${technical.confidence.toFixed(2)}) significantly overrides bearish sentiment (${sentiment.confidence.toFixed(2)}).`,
          dissentingView: `Sentiment specialist dissents on negative news flow (${sentiment.rationale}).`,
          primaryDriver: "technical",
          tokenCost: 0,
        };
      } else if (confDiff <= -0.25) {
        return {
          direction: sentiment.direction,
          confidence: Math.round(sentiment.confidence * 0.75 * 1000) / 1000,
          rationale: `Sentiment conviction (${sentiment.confidence.toFixed(2)}) overrides technical signal (${technical.confidence.toFixed(2)}).`,
          dissentingView: `Technical specialist dissents based on indicator configuration (${technical.rationale}).`,
          primaryDriver: "sentiment",
          tokenCost: 0,
        };
      } else {
        // Balanced conflict -> Neutral compromise
        return {
          direction: "neutral",
          confidence: 0.0,
          rationale: `Direct conflict between Technical (${technical.direction}, ${technical.confidence.toFixed(2)}) and Sentiment (${sentiment.direction}, ${sentiment.confidence.toFixed(2)}) reconciled to neutral cash preservation.`,
          dissentingView: `Technical: ${technical.direction} vs Sentiment: ${sentiment.direction}.`,
          primaryDriver: "compromise",
          tokenCost: 0,
        };
      }
    }

    // Case 2: One specialist is directional and the other is neutral
    if (technical.direction !== "neutral" && sentiment.direction === "neutral") {
      return {
        direction: technical.direction,
        confidence: Math.round(technical.confidence * 0.85 * 1000) / 1000,
        rationale: `Technical specialist provides actionable signal (${technical.direction}, ${technical.confidence.toFixed(2)}) in the absence of conflicting sentiment.`,
        dissentingView: `Sentiment specialist is neutral (${sentiment.rationale}).`,
        primaryDriver: "technical",
        tokenCost: 0,
      };
    }

    if (sentiment.direction !== "neutral" && technical.direction === "neutral") {
      return {
        direction: sentiment.direction,
        confidence: Math.round(sentiment.confidence * 0.85 * 1000) / 1000,
        rationale: `Sentiment specialist provides actionable news-driven signal (${sentiment.direction}, ${sentiment.confidence.toFixed(2)}) while technical indicators remain neutral.`,
        dissentingView: `Technical specialist is neutral (${technical.rationale}).`,
        primaryDriver: "sentiment",
        tokenCost: 0,
      };
    }

    // Default neutral fallback
    return {
      direction: "neutral",
      confidence: 0.0,
      rationale: "Both specialists neutral or uninformative.",
      dissentingView: undefined,
      primaryDriver: "compromise",
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
