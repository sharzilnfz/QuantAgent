import {
  AgentOutput,
  type AgentInput,
  type AgentName,
  type FundamentalReport,
} from "@committee/contracts";
import { TemporalGuard } from "@committee/fixtures";

import { config } from "../../config.js";
import { BaseAgent, NO_OPINION, type BaseAgentOptions } from "../base.js";
import { createLlmClient, isLlmConfigured, type LlmClient } from "../technical/llm-client.js";
import { classifyFundamentals, type FundamentalClassification } from "./classify.js";
import {
  AGENT_OUTPUT_TOOL_NAME,
  FUNDAMENTAL_SYSTEM_PROMPT,
  buildFundamentalUserPrompt,
  fundamentalOutputToolSchema,
} from "./prompt.js";

export interface FundamentalAgentOptions extends BaseAgentOptions {
  llm?: LlmClient;
  model?: string;
  maxTokens?: number;
  deterministicOffline?: boolean;
}

export class FundamentalAgent extends BaseAgent {
  readonly name: AgentName = "fundamental";

  private readonly llm: LlmClient | undefined;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly deterministicOffline: boolean;

  constructor(options: FundamentalAgentOptions = {}) {
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
    const rawReports = input.fundamentals ?? [];
    const validReports = TemporalGuard.filter(rawReports, input.decisionTs) as FundamentalReport[];

    const classification = classifyFundamentals(validReports);

    // If offline or no reports, return deterministic classification directly
    if (this.deterministicOffline || !this.llm || validReports.length === 0) {
      const renderedPrompt = buildFundamentalUserPrompt({
        symbol: input.symbol,
        decisionTs: input.decisionTs,
        latestReport: classification.latestReport,
        mechanicalDirection: classification.direction,
        mechanicalConfidence: classification.confidence,
      });

      return {
        agent: this.name,
        direction: classification.direction,
        confidence: classification.confidence,
        rationale: classification.rationale,
        evidence: {
          ...classification.evidence,
          symbol: input.symbol,
          decisionTs: input.decisionTs,
          renderedPrompt,
        },
      };
    }

    // Live LLM narration over computed facts
    const userPrompt = buildFundamentalUserPrompt({
      symbol: input.symbol,
      decisionTs: input.decisionTs,
      latestReport: classification.latestReport,
      mechanicalDirection: classification.direction,
      mechanicalConfidence: classification.confidence,
    });

    try {
      const raw = await this.llm.completeStructured({
        model: this.model,
        system: FUNDAMENTAL_SYSTEM_PROMPT,
        user: userPrompt,
        toolName: AGENT_OUTPUT_TOOL_NAME,
        toolSchema: fundamentalOutputToolSchema(),
        maxTokens: this.maxTokens,
      });

      const parsed = AgentOutput.parse(raw);

      // Facts vs Narration Law: Ground-truth computed evidence strictly overrides model output
      return {
        agent: this.name,
        direction: parsed.direction,
        confidence: parsed.confidence,
        rationale: parsed.rationale,
        evidence: {
          ...parsed.evidence,
          ...classification.evidence,
          symbol: input.symbol,
          decisionTs: input.decisionTs,
          renderedPrompt: userPrompt,
        },
      };
    } catch (err) {
      this.logger({
        event: "agent.error",
        runId: input.runId,
        agent: this.name,
        symbol: input.symbol,
        decisionTs: input.decisionTs,
        durationMs: 0,
        outcome: "error",
        error: err instanceof Error ? err.message : String(err),
      });

      return NO_OPINION(this.name, "error");
    }
  }
}
