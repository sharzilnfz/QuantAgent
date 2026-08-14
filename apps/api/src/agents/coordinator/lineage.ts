import { randomUUID } from "node:crypto";
import {
  DecisionLineageRecord,
  type ConsensusResult,
  type IndicatorSnapshot,
  type NewsItem,
  type PriceBar,
  type Trade,
} from "@committee/contracts";

export interface RecordDecisionParams {
  id?: string;
  decisionTs: string;
  symbol: string;
  inputBars: PriceBar[];
  indicators: IndicatorSnapshot | null;
  news?: NewsItem[];
  specialistPrompts?: Record<string, string>;
  specialistCompletions?: Record<string, unknown>;
  consensusResult: ConsensusResult;
  executionFill?: Trade;
  tokenCost?: number;
  latencyMs?: number;
}

/**
 * In-memory / injectable Decision Lineage Recorder.
 * Captures the complete point-in-time state, prompt texts, raw LLM completions,
 * consensus check outcome, and trade fills for each decision step.
 */
export class DecisionLineageRecorder {
  private records: DecisionLineageRecord[] = [];

  /**
   * Record a discrete decision lineage point.
   */
  record(params: RecordDecisionParams): DecisionLineageRecord {
    const record: DecisionLineageRecord = {
      id: params.id ?? randomUUID(),
      decisionTs: params.decisionTs,
      symbol: params.symbol,
      inputBars: params.inputBars,
      indicators: params.indicators,
      news: params.news ?? [],
      specialistPrompts: params.specialistPrompts ?? {},
      specialistCompletions: params.specialistCompletions ?? {},
      consensusResult: params.consensusResult,
      executionFill: params.executionFill,
      tokenCost: params.tokenCost ?? 0,
      latencyMs: params.latencyMs ?? 0,
    };

    this.records.push(record);
    return record;
  }

  /**
   * Return all recorded lineage items in chronological order.
   */
  getAll(): DecisionLineageRecord[] {
    return [...this.records];
  }

  /**
   * Get a specific lineage record by id.
   */
  getById(id: string): DecisionLineageRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  /**
   * Attach trade fill to the most recent decision record for this symbol/decisionTs.
   */
  attachExecutionFill(decisionTs: string, fill: Trade): boolean {
    const target = this.records.find((r) => r.decisionTs === decisionTs);
    if (target) {
      target.executionFill = fill;
      return true;
    }
    return false;
  }

  /**
   * Clear all records.
   */
  clear(): void {
    this.records = [];
  }

  /**
   * Number of recorded decisions.
   */
  get length(): number {
    return this.records.length;
  }
}
