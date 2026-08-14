import type { PriceBar, NewsItem, DatasetFixture, PredictionMarketEvent } from "@committee/contracts";

/**
 * Thrown when a dataset query or evaluation step encounters data timestamped
 * after the decision instant (T_data > T_decision).
 */
export class TemporalIntegrityViolation extends Error {
  public readonly decisionTs: string;
  public readonly recordTs: string;
  public readonly recordId?: string;

  constructor(
    message: string,
    details?: { decisionTs?: string | Date; recordTs?: string | Date; recordId?: string },
  ) {
    super(message);
    this.name = "TemporalIntegrityViolation";
    this.decisionTs = details?.decisionTs
      ? typeof details.decisionTs === "string"
        ? details.decisionTs
        : details.decisionTs.toISOString()
      : "";
    this.recordTs = details?.recordTs
      ? typeof details.recordTs === "string"
        ? details.recordTs
        : details.recordTs.toISOString()
      : "";
    this.recordId = details?.recordId;
    Object.setPrototypeOf(this, TemporalIntegrityViolation.prototype);
  }
}

export type TemporalRecord = {
  asOf?: string;
  ts?: string;
  publishedAt?: string;
  [key: string]: unknown;
};

/**
 * Resolve the point-in-time timestamp of a record.
 * Prioritizes `asOf` (the knowable instant), falling back to `publishedAt` or `ts`.
 */
export function getRecordAsOf(record: TemporalRecord): string {
  if (record.asOf && typeof record.asOf === "string") return record.asOf;
  if (record.publishedAt && typeof record.publishedAt === "string") return record.publishedAt;
  if (record.ts && typeof record.ts === "string") return record.ts;
  throw new Error("Record does not have a valid temporal field (asOf, publishedAt, or ts)");
}

/**
 * TemporalGuard enforces strict zero-leakage point-in-time isolation.
 *
 * Rule: For any decision instant T_decision, only records with asOf <= T_decision
 * are visible. Any observation of future data throws TemporalIntegrityViolation.
 */
export class TemporalGuard {
  /**
   * Normalize an input Date | string to UTC ISO string and millisecond timestamp.
   */
  private static parseTs(ts: string | Date): { iso: string; ms: number } {
    const d = typeof ts === "string" ? new Date(ts) : ts;
    const ms = d.getTime();
    if (Number.isNaN(ms)) {
      throw new Error(`Invalid timestamp provided: ${String(ts)}`);
    }
    return { iso: d.toISOString(), ms };
  }

  /**
   * Filter records strictly to those knowable on or before decisionTs.
   *
   * @param records Array of records containing asOf / ts / publishedAt
   * @param decisionTs The decision cutoff instant
   */
  public static filter<T extends TemporalRecord>(
    records: readonly T[],
    decisionTs: string | Date,
  ): T[] {
    const { ms: cutoffMs } = this.parseTs(decisionTs);
    return records.filter((r) => {
      const rIso = getRecordAsOf(r);
      const rMs = new Date(rIso).getTime();
      return rMs <= cutoffMs;
    });
  }

  /**
   * Assert that NO record in the provided slice has a timestamp > decisionTs.
   * Throws TemporalIntegrityViolation immediately if any future record is found.
   */
  public static assertNoLeakage<T extends TemporalRecord>(
    records: readonly T[],
    decisionTs: string | Date,
    context?: string,
  ): void {
    const { iso: decisionIso, ms: cutoffMs } = this.parseTs(decisionTs);
    for (let i = 0; i < records.length; i += 1) {
      const record = records[i];
      if (!record) continue;
      const rIso = getRecordAsOf(record);
      const rMs = new Date(rIso).getTime();
      if (rMs > cutoffMs) {
        const idStr = (record.id as string) || (record.symbol as string) || `index-${i}`;
        const prefix = context ? `[${context}] ` : "";
        throw new TemporalIntegrityViolation(
          `${prefix}Temporal integrity violation: record ${idStr} (asOf=${rIso}) is strictly after decision instant (${decisionIso})`,
          {
            decisionTs: decisionIso,
            recordTs: rIso,
            recordId: idStr,
          },
        );
      }
    }
  }

  /**
   * Query price bars point-in-time up to decisionTs.
   */
  public static queryBars(
    bars: readonly PriceBar[],
    decisionTs: string | Date,
  ): PriceBar[] {
    const filtered = this.filter(bars, decisionTs);
    this.assertNoLeakage(filtered, decisionTs, "queryBars");
    return filtered;
  }

  /**
   * Query news items point-in-time up to decisionTs.
   */
  public static queryNews(
    news: readonly NewsItem[],
    decisionTs: string | Date,
  ): NewsItem[] {
    const filtered = this.filter(news, decisionTs);
    this.assertNoLeakage(filtered, decisionTs, "queryNews");
    return filtered;
  }

  /**
   * Query prediction market events point-in-time up to decisionTs.
   * Filters events by asOf <= decisionTs and filters historical probability points strictly <= decisionTs.
   */
  public static queryPredictionMarkets(
    events: readonly PredictionMarketEvent[],
    decisionTs: string | Date,
  ): PredictionMarketEvent[] {
    const { ms: cutoffMs } = this.parseTs(decisionTs);
    const filteredEvents = events
      .filter((ev) => new Date(ev.asOf).getTime() <= cutoffMs)
      .map((ev) => {
        const filteredHistory = ev.history.filter(
          (pt) => new Date(pt.asOf ?? pt.ts).getTime() <= cutoffMs,
        );
        return {
          ...ev,
          history: filteredHistory,
        };
      });

    this.assertNoLeakage(filteredEvents, decisionTs, "queryPredictionMarkets:events");
    for (const ev of filteredEvents) {
      this.assertNoLeakage(ev.history, decisionTs, `queryPredictionMarkets:history(${ev.id})`);
    }

    return filteredEvents;
  }

  /**
   * Wrap and query a complete dataset fixture up to decisionTs.
   */
  public static queryDataset(
    dataset: DatasetFixture,
    decisionTs: string | Date,
  ): DatasetFixture {
    return {
      symbol: dataset.symbol,
      bars: this.queryBars(dataset.bars, decisionTs),
      news: this.queryNews(dataset.news, decisionTs),
      predictionMarkets: dataset.predictionMarkets
        ? this.queryPredictionMarkets(dataset.predictionMarkets, decisionTs)
        : undefined,
    };
  }

  /**
   * Strict query enforcement: query records against a dataset.
   * If the input records contain records beyond decisionTs and strict checking
   * is required on an unfiltered feed, or when verifying pipeline boundaries,
   * this helper ensures the result is strictly bounded and verified.
   */
  public static query<T extends TemporalRecord>(
    records: readonly T[],
    decisionTs: string | Date,
  ): T[] {
    const filtered = this.filter(records, decisionTs);
    this.assertNoLeakage(filtered, decisionTs, "query");
    return filtered;
  }
}
