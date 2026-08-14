import { randomUUID } from "node:crypto";
import {
  ConsensusResult,
  type AgentInput,
  type AgentOutput,
  type Direction,
} from "@committee/contracts";

import { defaultAgentLogger, type Agent, type StructuredLogger } from "../base.js";
import { runAgents } from "../runner.js";
import { SentimentAgent } from "../sentiment/agent.js";
import { TechnicalAgent } from "../technical/agent.js";
import { evaluateConsensus } from "./consensus.js";
import { DebateSynthesizer } from "./debate.js";
import { DecisionLineageRecorder } from "./lineage.js";

export interface CoordinatorOptions {
  debateEnabled?: boolean;
  deterministicOffline?: boolean;
  specialists?: Agent[];
  synthesizer?: DebateSynthesizer;
  lineageRecorder?: DecisionLineageRecorder;
  logger?: StructuredLogger;
}

export class MultiAgentCoordinator {
  public readonly debateEnabled: boolean;
  public readonly deterministicOffline: boolean;
  private readonly specialists: Agent[];
  private readonly synthesizer: DebateSynthesizer;
  public readonly lineageRecorder?: DecisionLineageRecorder;
  private readonly logger: StructuredLogger;

  constructor(options: CoordinatorOptions = {}) {
    this.debateEnabled = options.debateEnabled ?? true;
    this.deterministicOffline = options.deterministicOffline ?? false;
    this.lineageRecorder = options.lineageRecorder;
    this.logger = options.logger ?? defaultAgentLogger;

    this.specialists =
      options.specialists ??
      [
        new TechnicalAgent(),
        new SentimentAgent({ deterministicOffline: this.deterministicOffline }),
      ];

    this.synthesizer =
      options.synthesizer ??
      new DebateSynthesizer({ deterministicOffline: this.deterministicOffline });
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
      },
    });

    // 3. Record lineage if recorder is present
    if (this.lineageRecorder) {
      this.lineageRecorder.record({
        id: lineageId,
        decisionTs: input.decisionTs,
        symbol: input.symbol,
        inputBars: input.bars,
        indicators: input.indicators,
        news: input.news,
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
