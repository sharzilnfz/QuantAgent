import {
  AgentOutput,
  type AgentInput,
  type AgentName,
  type PredictionMarketEvent,
} from "@committee/contracts";
import { TemporalGuard } from "@committee/fixtures";

import { config } from "../../config.js";
import { BaseAgent, NO_OPINION, type BaseAgentOptions } from "../base.js";
import { createLlmClient, isLlmConfigured, type LlmClient } from "../technical/llm-client.js";
import { classifyMacroOdds, type MacroOddsClassification } from "./classify.js";
import {
  AGENT_OUTPUT_TOOL_NAME,
  POLYMARKET_SYSTEM_PROMPT,
  buildPolymarketUserPrompt,
  normalizePolymarketModelOutput,
  polymarketOutputToolSchema,
} from "./prompt.js";

export interface PolymarketAgentOptions extends BaseAgentOptions {
  /** Injectable LLM seam. */
  llm?: LlmClient;
  /** Model name. Defaults to cheap tier model. */
  model?: string;
  maxTokens?: number;
  deterministicOffline?: boolean;
}

export class PolymarketAgent extends BaseAgent {
  readonly name: AgentName = "polymarket";

  private readonly llm: LlmClient | undefined;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly deterministicOffline: boolean;

  constructor(options: PolymarketAgentOptions = {}) {
    super(options);
    this.deterministicOffline = options.deterministicOffline ?? false;
    this.model = options.model ?? config.LLM_CHEAP_MODEL;
    this.maxTokens = options.maxTokens ?? 1024;

    if (options.llm) {
      this.llm = options.llm;
    } else if (!this.deterministicOffline && isLlmConfigured()) {
      this.llm = createLlmClient();
    } else {
      this.llm = undefined;
    }
  }

  protected async run(input: AgentInput): Promise<AgentOutput> {
    const rawEvents = input.predictionMarkets;

    if (!rawEvents || rawEvents.length === 0) {
      this.logger({
        event: "polymarket.no_data",
        runId: input.runId,
        agent: this.name,
        symbol: input.symbol,
        decisionTs: input.decisionTs,
        outcome: "skipped",
      });
      return {
        agent: this.name,
        direction: "neutral",
        confidence: 0,
        rationale: "no point-in-time prediction market data available",
        evidence: {
          marketsConsidered: 0,
          symbol: input.symbol,
        },
      };
    }

    // Strict point-in-time query & temporal guarding
    const pointInTimeEvents = TemporalGuard.queryPredictionMarkets(rawEvents, input.decisionTs);

    const classification = classifyMacroOdds(pointInTimeEvents, input.decisionTs);

    // Fast-path: Deterministic offline evaluation ($0.00 cost)
    if (this.deterministicOffline || !this.llm) {
      const rationale = this.generateDeterministicRationale(classification);
      return AgentOutput.parse({
        agent: this.name,
        direction: classification.direction,
        confidence: classification.strength,
        rationale,
        evidence: classification.evidence,
      });
    }

    // Live LLM completion pass
    const userPrompt = buildPolymarketUserPrompt(input, classification);

    let rawOutput: unknown;
    try {
      rawOutput = await this.llm.completeStructured({
        model: this.model,
        maxTokens: this.maxTokens,
        system: POLYMARKET_SYSTEM_PROMPT,
        user: userPrompt,
        toolName: AGENT_OUTPUT_TOOL_NAME,
        toolSchema: polymarketOutputToolSchema,
      });
    } catch {
      rawOutput = {};
    }

    const output = normalizePolymarketModelOutput(rawOutput, classification.direction);

    // Fact-locking: Force deterministic classification facts into evidence to prevent hallucination
    const lockedEvidence = {
      ...output.evidence,
      ...classification.evidence,
    };

    return AgentOutput.parse({
      ...output,
      agent: this.name,
      evidence: lockedEvidence,
    });
  }

  private generateDeterministicRationale(classification: MacroOddsClassification): string {
    const parts: string[] = [
      `Polymarket crowdsourced macro probability analysis identifies '${classification.macroRegime}' regime.`,
    ];

    if (classification.rateCutProbability !== undefined) {
      parts.push(`Fed rate cut odds are ${(classification.rateCutProbability * 100).toFixed(0)}%.`);
    }
    if (classification.inflationExceedProbability !== undefined) {
      parts.push(`CPI inflation >3% probability stands at ${(classification.inflationExceedProbability * 100).toFixed(0)}%.`);
    }
    if (classification.recessionProbability !== undefined) {
      parts.push(`Recession risk is priced at ${(classification.recessionProbability * 100).toFixed(0)}%.`);
    }

    parts.push(
      `Mechanical stance is ${classification.direction} with conviction ${(classification.strength * 100).toFixed(0)}%.`,
    );

    return parts.join(" ");
  }
}
