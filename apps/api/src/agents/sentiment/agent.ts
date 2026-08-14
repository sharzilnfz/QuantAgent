import {
  AgentOutput,
  type AgentInput,
  type AgentName,
  type NewsItem,
} from "@committee/contracts";
import { TemporalGuard } from "@committee/fixtures";

import { config } from "../../config.js";
import { BaseAgent, NO_OPINION, type BaseAgentOptions } from "../base.js";
import { createLlmClient, isLlmConfigured, type LlmClient } from "../technical/llm-client.js";
import {
  classifySentimentHeadlines,
  type SentimentClassification,
} from "./classify.js";
import {
  resolveDefaultNewsProvider,
  type NewsProvider,
} from "./news-provider.js";
import {
  AGENT_OUTPUT_TOOL_NAME,
  SENTIMENT_SYSTEM_PROMPT,
  buildSentimentUserPrompt,
  normalizeSentimentModelOutput,
  sentimentOutputToolSchema,
} from "./prompt.js";
import { SentimentTelemetry } from "./telemetry.js";

export interface SentimentAgentOptions extends BaseAgentOptions {
  /** Injectable LLM seam. Defaults to standard LLM client. */
  llm?: LlmClient;
  /** News provider. Defaults to FixtureNewsProvider when undefined. */
  newsProvider?: NewsProvider | null;
  /** Telemetry tracker. */
  telemetry?: SentimentTelemetry;
  /** Model name. Defaults to cheap tier model. */
  model?: string;
  maxTokens?: number;
  lookbackDays?: number;
  maxHeadlines?: number;
  deterministicOffline?: boolean;
}

export class SentimentAgent extends BaseAgent {
  readonly name: AgentName = "sentiment";

  private readonly llm: LlmClient | undefined;
  private readonly newsProvider: NewsProvider | null;
  public readonly telemetry: SentimentTelemetry;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly lookbackDays: number;
  private readonly maxHeadlines: number;
  private readonly deterministicOffline: boolean;

  constructor(options: SentimentAgentOptions = {}) {
    super(options);
    this.deterministicOffline = options.deterministicOffline ?? false;
    this.newsProvider =
      options.newsProvider === undefined
        ? resolveDefaultNewsProvider()
        : options.newsProvider;
    this.telemetry = options.telemetry ?? new SentimentTelemetry();
    this.model = options.model ?? config.LLM_CHEAP_MODEL;
    this.maxTokens = options.maxTokens ?? 1024;
    this.lookbackDays = options.lookbackDays ?? 7;
    this.maxHeadlines = options.maxHeadlines ?? 20;

    if (options.llm) {
      this.llm = options.llm;
    } else if (!this.deterministicOffline && isLlmConfigured()) {
      this.llm = createLlmClient();
    } else {
      this.llm = undefined;
    }
  }

  protected async run(input: AgentInput): Promise<AgentOutput> {
    this.telemetry.recordCall();

    const headlines = await this.resolvePointInTimeNews(input);

    if (headlines.length === 0) {
      this.logger({
        event: "sentiment.no_news",
        runId: input.runId,
        agent: this.name,
        symbol: input.symbol,
        decisionTs: input.decisionTs,
        outcome: "skipped",
      });
      this.telemetry.recordNoNews();
      return {
        agent: this.name,
        direction: "neutral",
        confidence: 0,
        rationale: "no point-in-time news available",
        evidence: {
          headlinesConsidered: 0,
          symbol: input.symbol,
          decisionTs: input.decisionTs,
        },
      };
    }

    const classification = classifySentimentHeadlines(headlines.slice(0, this.maxHeadlines));

    // Deterministic offline evaluation path ($0 cost, deterministic replay)
    if (this.deterministicOffline || !this.llm) {
      this.telemetry.recordSuccess();
      return {
        agent: this.name,
        direction: classification.direction,
        confidence: classification.strength,
        rationale: `Deterministic sentiment: ${classification.bullishCount} bullish, ${classification.bearishCount} bearish, ${classification.neutralCount} neutral out of ${classification.totalHeadlines} point-in-time headlines.`,
        evidence: {
          headlinesConsidered: classification.totalHeadlines,
          netSentimentScore: classification.netScore,
          bullishCount: classification.bullishCount,
          bearishCount: classification.bearishCount,
          neutralCount: classification.neutralCount,
          symbol: input.symbol,
          decisionTs: input.decisionTs,
          deterministic: true,
          ...classification.evidence,
        },
      };
    }

    const request = {
      model: this.model,
      system: SENTIMENT_SYSTEM_PROMPT,
      user: buildSentimentUserPrompt({
        symbol: input.symbol,
        decisionTs: input.decisionTs,
        headlines: headlines.slice(0, this.maxHeadlines),
        netScore: classification.netScore,
        mechanicalDirection: classification.direction,
      }),
      toolName: AGENT_OUTPUT_TOOL_NAME,
      toolSchema: sentimentOutputToolSchema(),
      maxTokens: this.maxTokens,
    };

    const narration = await this.narrate(request, input, 0);
    if (!narration) {
      this.telemetry.recordFallback("llm_narration_failed");
      return NO_OPINION(this.name, "error");
    }

    const agree = narration.direction === classification.direction;
    const blended = blendConfidence(classification.strength, narration.confidence, agree);
    this.telemetry.recordSuccess();

    return {
      agent: this.name,
      direction: narration.direction,
      confidence: blended,
      rationale: narration.rationale,
      evidence: {
        // Model-authored keys first...
        ...narration.evidence,
        // ...then the authoritative computed facts, which overwrite anything that collides:
        ...classification.evidence,
        headlinesConsidered: classification.totalHeadlines,
        netSentimentScore: classification.netScore,
        bullishCount: classification.bullishCount,
        bearishCount: classification.bearishCount,
        neutralCount: classification.neutralCount,
        symbol: input.symbol,
        decisionTs: input.decisionTs,
        modelDirection: narration.direction,
        modelConfidence: narration.confidence,
        modelAgreesWithRules: agree,
        model: this.model,
      },
    };
  }

  /**
   * Point-in-time news resolution.
   * If `input.news` is supplied, filters `asOf <= input.decisionTs`.
   * If future headlines are present, rejects them with a log and telemetry record.
   * If `input.news` is empty/missing, queries the `newsProvider`.
   */
  private async resolvePointInTimeNews(input: AgentInput): Promise<NewsItem[]> {
    const boundary = Date.parse(input.decisionTs);

    if (input.news !== undefined) {
      const supplied = input.news;
      const futureItems = supplied.filter((item) => Date.parse(item.asOf) > boundary);

      if (futureItems.length > 0) {
        this.telemetry.recordPitViolation();
        this.logger({
          event: "sentiment.pit_violation_rejected",
          runId: input.runId,
          agent: this.name,
          symbol: input.symbol,
          decisionTs: input.decisionTs,
          outcome: "invalid",
          detail: `${futureItems.length} supplied headline(s) timestamped after decisionTs`,
        });
      }

      return TemporalGuard.filter(supplied, input.decisionTs);
    }

    if (!this.newsProvider) {
      return [];
    }

    const retrieved = await this.newsProvider.getNews({
      symbol: input.symbol,
      decisionTs: input.decisionTs,
      limit: this.maxHeadlines,
    });

    return TemporalGuard.filter(retrieved, input.decisionTs);
  }

  /**
   * LLM completion with at most one retry on schema failure or error.
   */
  private async narrate(
    request: Parameters<LlmClient["completeStructured"]>[0],
    input: AgentInput,
    attempt: number,
  ): Promise<AgentOutput | null> {
    if (!this.llm) return null;

    let raw: unknown;
    try {
      raw = await this.llm.completeStructured(request);
    } catch (err) {
      this.telemetry.recordError(err);
      this.logger({
        event: "sentiment.llm_failed",
        runId: input.runId,
        agent: this.name,
        outcome: "error",
        attempt,
        detail: err instanceof Error ? err.message : String(err),
      });
      return attempt === 0 ? this.narrate(request, input, 1) : null;
    }

    const normalized = normalizeSentimentModelOutput(raw);
    const parsed = AgentOutput.safeParse(normalized);

    if (parsed.success && parsed.data.agent === this.name) {
      return parsed.data;
    }

    this.telemetry.recordInvalid();
    this.logger({
      event: "sentiment.llm_invalid",
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
 * Blend mechanical strength and narration confidence.
 * Agreement -> average of mechanical strength and model confidence.
 * Disagreement -> halved average.
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
