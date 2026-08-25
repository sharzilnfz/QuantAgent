import { randomUUID } from "node:crypto";
import type {
  AgentOutput,
  Direction,
  EpisodicReflection,
} from "@committee/contracts";

export interface ReflectionInput {
  symbol: string;
  tradeId?: string;
  entryDecision: {
    decisionTs: string;
    direction: Direction;
    confidence: number;
    rationale: string;
    specialistVotes?: Record<string, AgentOutput>;
  };
  entryPrice: number;
  exitPrice: number;
  holdingBars: number;
  reviewTs: string; // The point in time when the reflection is conducted
}

export interface ReflectionAgentOptions {
  deterministicOffline?: boolean;
}

/**
 * ReflectionAgent performs post-trade evaluation on filled orders.
 *
 * Evaluates whether the trade rationale was sound, calculates real outcome delta,
 * detects contradictions among specialist signals, and distills an actionable lesson.
 */
export class ReflectionAgent {
  public readonly deterministicOffline: boolean;

  constructor(options: ReflectionAgentOptions = {}) {
    this.deterministicOffline = options.deterministicOffline ?? true;
  }

  /**
   * Analyze a completed trade and generate an EpisodicReflection record.
   */
  public analyzeTrade(input: ReflectionInput): EpisodicReflection {
    const { symbol, tradeId, entryDecision, entryPrice, exitPrice, holdingBars, reviewTs } = input;

    // 1. Calculate return percentage based on initial trade direction
    const rawPriceDelta = (exitPrice - entryPrice) / entryPrice;
    const outcomeReturnPct =
      entryDecision.direction === "bullish"
        ? rawPriceDelta
        : entryDecision.direction === "bearish"
          ? -rawPriceDelta
          : 0;

    // 2. Identify potential specialist signal contradictions
    let contradictionDetected = false;
    let contradictionDetails: string | undefined;

    const votes = entryDecision.specialistVotes ?? {};
    const sentVote = votes["sentiment"];
    const techVote = votes["technical"];
    const fundVote = votes["fundamental"];
    const polyVote = votes["polymarket"];

    if (outcomeReturnPct < -0.02) {
      // Significant losing trade: check what misled the decision
      if (sentVote && sentVote.direction === entryDecision.direction && sentVote.confidence >= 0.75) {
        if (techVote && techVote.direction !== entryDecision.direction) {
          contradictionDetected = true;
          contradictionDetails = `Sentiment specialist strongly favored ${entryDecision.direction} (${(sentVote.confidence * 100).toFixed(0)}%) while technical indicators showed divergence/exhaustion.`;
        } else {
          contradictionDetected = true;
          contradictionDetails = `High sentiment confidence (${(sentVote.confidence * 100).toFixed(0)}%) failed to translate to price follow-through, resulting in ${(outcomeReturnPct * 100).toFixed(1)}% loss.`;
        }
      } else if (fundVote && fundVote.direction === entryDecision.direction && fundVote.confidence >= 0.8) {
        contradictionDetected = true;
        contradictionDetails = `Fundamental optimism was overridden by short-term market momentum against the trade.`;
      }
    }

    // 3. Generate critique & lesson learned
    let critique: string;
    let lessonLearned: string;

    const isWin = outcomeReturnPct > 0.01;
    const isLoss = outcomeReturnPct < -0.01;

    if (isWin) {
      critique = `Trade succeeded with +${(outcomeReturnPct * 100).toFixed(1)}% gain over ${holdingBars} bars. Entry rationale on ${entryDecision.decisionTs.slice(0, 10)} was validated by market price action.`;
      lessonLearned = `Multi-agent alignment around ${entryDecision.direction} conviction (${(entryDecision.confidence * 100).toFixed(0)}%) produced favorable risk-adjusted returns.`;
    } else if (isLoss) {
      critique = `Trade experienced ${(outcomeReturnPct * 100).toFixed(1)}% drawdown over ${holdingBars} bars. ${contradictionDetails ?? "Market moved adversely following entry."}`;
      lessonLearned = contradictionDetected
        ? `Require stronger technical confirmation before acting on high sentiment confidence to avoid false breakouts.`
        : `Enforce tighter stop-loss discipline when price breaks support following a ${entryDecision.direction} entry.`;
    } else {
      critique = `Trade broke even (${(outcomeReturnPct * 100).toFixed(1)}%) after ${holdingBars} bars. Market entered consolidation regime.`;
      lessonLearned = `Monitor volatility regime changes to exit stagnant positions when momentum stalls.`;
    }

    return {
      id: randomUUID(),
      symbol: symbol.toUpperCase(),
      tradeId,
      decisionTs: entryDecision.decisionTs,
      reviewTs,
      initialDirection: entryDecision.direction,
      initialConfidence: entryDecision.confidence,
      outcomeReturnPct: Math.round(outcomeReturnPct * 10000) / 10000,
      holdingBars,
      critique,
      lessonLearned,
      contradictionDetected,
      contradictionDetails,
      asOf: reviewTs, // reflection becomes knowable at reviewTs
    };
  }
}
