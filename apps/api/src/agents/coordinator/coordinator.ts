import { randomUUID } from "node:crypto";
import {
  ConsensusResult,
  type AgentInput,
  type AgentOutput,
  type Direction,
} from "@committee/contracts";
import { TemporalGuard } from "@committee/fixtures";

import { defaultAgentLogger, type Agent, type StructuredLogger } from "../base.js";
import { runAgents } from "../runner.js";
import { FundamentalAgent } from "../fundamental/agent.js";
import { PolymarketAgent } from "../polymarket/agent.js";
import { SentimentAgent } from "../sentiment/agent.js";
import { TechnicalAgent } from "../technical/agent.js";
import { evaluateConsensus } from "./consensus.js";
import { DebateSynthesizer } from "./debate.js";
import { DecisionLineageRecorder } from "./lineage.js";
import { MemoryStore } from "../../memory/store.js";

export interface CoordinatorOptions {
  debateEnabled?: boolean;
  debateRounds?: number;
  deterministicOffline?: boolean;
  includePolymarket?: boolean;
  memoryEnabled?: boolean;
  memoryStore?: MemoryStore;
  specialists?: Agent[];
  synthesizer?: DebateSynthesizer;
  lineageRecorder?: DecisionLineageRecorder;
  logger?: StructuredLogger;
}

export class MultiAgentCoordinator {
  public readonly debateEnabled: boolean;
  public readonly debateRounds: number;
  public readonly deterministicOffline: boolean;
  public readonly memoryEnabled: boolean;
  public readonly memoryStore?: MemoryStore;
  private readonly specialists: Agent[];
  private readonly synthesizer: DebateSynthesizer;
  public readonly lineageRecorder?: DecisionLineageRecorder;
  private readonly logger: StructuredLogger;

  constructor(options: CoordinatorOptions = {}) {
    this.debateEnabled = options.debateEnabled ?? true;
    this.debateRounds = options.debateRounds ?? 1;
    this.deterministicOffline = options.deterministicOffline ?? false;
    this.memoryEnabled = options.memoryEnabled ?? true;
    this.memoryStore =
      options.memoryStore ??
      (this.memoryEnabled
        ? new MemoryStore({ deterministicOffline: this.deterministicOffline })
        : undefined);
    this.lineageRecorder = options.lineageRecorder;
    this.logger = options.logger ?? defaultAgentLogger;

    if (options.specialists) {
      this.specialists = options.specialists;
    } else {
      const baseList: Agent[] = [
        new TechnicalAgent({
          deterministicOffline: this.deterministicOffline,
          logger: this.logger,
        }),
        new SentimentAgent({
          deterministicOffline: this.deterministicOffline,
          logger: this.logger,
        }),
        new FundamentalAgent({
          deterministicOffline: this.deterministicOffline,
          logger: this.logger,
        }),
      ];
      if (options.includePolymarket) {
        baseList.push(
          new PolymarketAgent({
            deterministicOffline: this.deterministicOffline,
            logger: this.logger,
          }),
        );
      }
      this.specialists = baseList;
    }

    this.synthesizer =
      options.synthesizer ??
      new DebateSynthesizer({
        deterministicOffline: this.deterministicOffline,
        debateRounds: this.debateRounds,
      });
  }

  /**
   * Run the multi-agent decision cycle for a single decision timestamp.
   */
  async coordinate(
    input: Omit<AgentInput, "runId"> & { runId?: string },
  ): Promise<ConsensusResult> {
    const runId = input.runId ?? randomUUID();
    const lineageId = randomUUID();
    const startedAt = Date.now();

    const { runId: _unusedRunId, ...agentInputWithoutRunId } = input;

    // 0. Query point-in-time MemoryContext if enabled and not explicitly injected
    if (this.memoryEnabled && this.memoryStore && !agentInputWithoutRunId.memory) {
      const newsSnippet = input.news && input.news.length > 0
        ? input.news.map((n) => n.headline).slice(0, 3).join(". ")
        : "";
      const queryText = `${input.symbol} ${newsSnippet}`.trim();

      agentInputWithoutRunId.memory = this.memoryStore.queryMemoryContext({
        symbol: input.symbol,
        asOf: input.decisionTs,
        queryText: queryText.length > 0 ? queryText : undefined,
      });
    }

    // 1. Run all specialists concurrently via runAgents
    const { outputs } = await runAgents(
      agentInputWithoutRunId,
      this.specialists,
      { persistence: null, logger: this.logger, runId },
    );

    const specialistVotes: Record<string, AgentOutput> = {};
    for (const out of outputs) {
      specialistVotes[out.agent] = out;
    }

    const technical = outputs.find((o) => o.agent === "technical") ?? {
      agent: "technical" as const,
      direction: "neutral" as const,
      confidence: 0,
      rationale: "technical agent missing from run",
      evidence: {},
    };

    const sentiment = outputs.find((o) => o.agent === "sentiment") ?? {
      agent: "sentiment" as const,
      direction: "neutral" as const,
      confidence: 0,
      rationale: "sentiment agent missing from run",
      evidence: {},
    };

    const fundamental = outputs.find((o) => o.agent === "fundamental");
    const polymarket = outputs.find((o) => o.agent === "polymarket");

    // 2. Evaluate consensus short-circuit
    const consensusCheck = evaluateConsensus(outputs);

    let finalBias: Direction = "neutral";
    let finalConfidence = 0.0;
    let mode: ConsensusResult["mode"] = "consensus_short_circuit";
    let synthesisResult: ConsensusResult["synthesis"] = undefined;

    if (consensusCheck.reached && consensusCheck.direction) {
      // Fast-pass: Specialists agree -> 0 extra tokens
      mode = "consensus_short_circuit";
      finalBias = consensusCheck.direction;
      finalConfidence = consensusCheck.confidence ?? 0.0;
    } else if (this.debateEnabled) {
      // Disagreement & Debate ON -> Single-pass LLM synthesis
      mode = "debate_synthesis";
      const currentBar = input.bars[input.bars.length - 1];

      const synthesis = await this.synthesizer.synthesize(
        {
          symbol: input.symbol,
          decisionTs: input.decisionTs,
          currentBar,
          technical,
          sentiment,
          fundamental,
          polymarket,
          memory: agentInputWithoutRunId.memory,
        },
        { ...input, runId },
      );

      synthesisResult = synthesis;
      finalBias = synthesis.direction;
      finalConfidence = synthesis.confidence;
    } else {
      // Disagreement & Debate OFF -> Ablation Neutral Fallback
      mode = "ablation_neutral_fallback";
      finalBias = "neutral";
      finalConfidence = 0.0;
    }

    // Record decision into short-term memory if store is available
    if (this.memoryStore) {
      this.memoryStore.recordShortTermDecision({
        decisionTs: input.decisionTs,
        symbol: input.symbol,
        direction: finalBias,
        confidence: finalConfidence,
        rationale: synthesisResult?.rationale ?? technical.rationale ?? "Consensus majority agreement",
        asOf: input.decisionTs,
      });
    }

    const consensusResult: ConsensusResult = ConsensusResult.parse({
      lineageId,
      consensusReached: consensusCheck.reached,
      mode,
      finalBias,
      finalConfidence,
      specialistVotes,
      synthesis: synthesisResult,
      metadata: {
        runId,
        durationMs: Date.now() - startedAt,
        tokenCost: synthesisResult?.tokenCost ?? 0,
        debateRounds: this.debateRounds,
      },
    });

    // 3. Record lineage if recorder is present
    if (this.lineageRecorder) {
      // Exact rendered prompts captured by the specialists (see their evidence);
      // the summaries below are only a fallback for hand-rolled agents.
      const promptFrom = (out: AgentOutput): string | undefined => {
        const rendered = out.evidence["renderedPrompt"];
        return typeof rendered === "string" && rendered.length > 0 ? rendered : undefined;
      };

      const specialistPrompts: Record<string, string> = {};
      if (promptFrom(technical)) specialistPrompts.technical = promptFrom(technical)!;
      else
        specialistPrompts.technical = `System prompt: Technical analysis specialist.\nUser prompt: Analyze ${input.symbol} at ${input.decisionTs} with ${input.bars.length} historical bars and indicators (${input.indicators ? "available" : "none"}).`;
      if (promptFrom(sentiment)) specialistPrompts.sentiment = promptFrom(sentiment)!;
      else
        specialistPrompts.sentiment = `System prompt: Sentiment analysis specialist.\nUser prompt: Evaluate news sentiment for ${input.symbol} with ${input.news?.length ?? 0} news items up to ${input.decisionTs}.`;
      if (fundamental && promptFrom(fundamental)) {
        specialistPrompts.fundamental = promptFrom(fundamental)!;
      } else if (fundamental) {
        specialistPrompts.fundamental = `System prompt: Fundamental analysis specialist.\nUser prompt: Evaluate SEC EDGAR filings for ${input.symbol} up to ${input.decisionTs}.`;
      }
      if (polymarket && promptFrom(polymarket)) {
        specialistPrompts.polymarket = promptFrom(polymarket)!;
      } else if (polymarket) {
        specialistPrompts.polymarket = `System prompt: Macro prediction market specialist.\nUser prompt: Evaluate crowdsourced macro probability distributions for ${input.symbol} up to ${input.decisionTs}.`;
      }
      if (synthesisResult) {
        specialistPrompts.debateSynthesizer = `System prompt: Multi-agent debate synthesizer.\nUser prompt: Reconcile specialist stance disagreement for ${input.symbol} at ${input.decisionTs} between Technical (${technical.direction}, conf ${technical.confidence}), Sentiment (${sentiment.direction}, conf ${sentiment.confidence})${fundamental ? `, Fundamental (${fundamental.direction}, conf ${fundamental.confidence})` : ""}${polymarket ? `, and Polymarket (${polymarket.direction}, conf ${polymarket.confidence})` : ""}.`;
      }

      const specialistCompletions: Record<string, unknown> = {
        technical,
        sentiment,
      };
      if (fundamental) {
        specialistCompletions.fundamental = fundamental;
      }
      if (polymarket) {
        specialistCompletions.polymarket = polymarket;
      }
      if (synthesisResult) {
        specialistCompletions.debateSynthesizer = synthesisResult;
      }

      // The audit view must show exactly what was KNOWABLE at decisionTs —
      // the specialists filter internally, but the recorder stores the same
      // point-in-time slice it handed them, never the raw future-inclusive array.
      const pointInTimeNews = TemporalGuard.filter(input.news ?? [], input.decisionTs);
      const pointInTimeFundamentals = TemporalGuard.filter(input.fundamentals ?? [], input.decisionTs);

      this.lineageRecorder.record({
        id: lineageId,
        decisionTs: input.decisionTs,
        symbol: input.symbol,
        inputBars: input.bars,
        indicators: input.indicators,
        news: pointInTimeNews,
        fundamentals: pointInTimeFundamentals,
        specialistPrompts,
        specialistCompletions,
        consensusResult,
        tokenCost: synthesisResult?.tokenCost ?? 0,
        latencyMs: Date.now() - startedAt,
      });
    }

    this.logger({
      event: "coordinator.decision",
      runId,
      lineageId,
      symbol: input.symbol,
      decisionTs: input.decisionTs,
      mode,
      finalBias,
      finalConfidence,
      consensusReached: consensusCheck.reached,
      durationMs: Date.now() - startedAt,
    });

    return consensusResult;
  }
}
