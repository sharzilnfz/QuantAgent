import type { PriceBarStore } from "./store.js";
import { createDrizzleStore } from "./store.js";
import { AlpacaClient } from "./alpaca-client.js";
import { cacheFromEnv } from "./fs-cache.js";
import {
  IngestRequest,
  normalizeBars,
  upsertBars,
  SOURCE,
  type IngestOptions,
  type IngestResult,
  type PerSymbolResult,
} from "./prices.js";

/**
 * Deep module encapsulating market data ingestion logic.
 *
 * Simple interface:
 *   `ingest(request: IngestRequest, options?: IngestOptions): Promise<IngestResult>`
 *
 * Internal responsibilities hidden:
 *   - Date range validation
 *   - Alpaca client instantiation and reuse across symbols
 *   - Provider fetching per symbol
 *   - `as_of` point-in-time normalization (drop future bars)
 *   - Idempotent database storage (`upsertBars`)
 *   - Partial failure aggregation
 */
export class MarketDataIngestor {
  private readonly defaultOptions: IngestOptions;

  constructor(options: IngestOptions = {}) {
    this.defaultOptions = options;
  }

  /**
   * Primary entry point for ingesting market data for one or more symbols over a date range.
   */
  static async ingest(
    request: IngestRequest,
    options: IngestOptions = {},
  ): Promise<IngestResult> {
    return new MarketDataIngestor(options).ingest(request);
  }

  /**
   * Instance method for ingesting market data using pre-configured options merged with per-call options.
   */
  async ingest(
    request: IngestRequest,
    overrideOptions: IngestOptions = {},
  ): Promise<IngestResult> {
    const options = { ...this.defaultOptions, ...overrideOptions };
    const parsed = IngestRequest.parse(request);
    const from = new Date(parsed.from);
    const to = new Date(parsed.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error(`ingestPrices: unparseable date range ${parsed.from}..${parsed.to}`);
    }
    if (from.getTime() > to.getTime()) {
      throw new Error(`ingestPrices: 'from' (${parsed.from}) is after 'to' (${parsed.to})`);
    }

    const store: PriceBarStore = options.store ?? (await createDrizzleStore());
    const source = options.source ?? SOURCE;

    // Single client reused across all symbols in this ingestion run
    const client =
      options.client ?? new AlpacaClient({ cache: cacheFromEnv(), ...options });

    const results: PerSymbolResult[] = [];
    for (const symbol of parsed.symbols) {
      try {
        const raw = await client.getBars(symbol, parsed.timeframe, from, to);
        const { bars, dropped } = normalizeBars(raw, symbol, parsed.timeframe, {
          now: options.now,
        });
        const report = await upsertBars(bars, store, source);
        results.push({
          symbol,
          fetched: bars.length,
          inserted: report.inserted,
          skipped: report.skipped,
          dropped,
        });
      } catch (error) {
        results.push({
          symbol,
          fetched: 0,
          inserted: 0,
          skipped: 0,
          dropped: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const succeeded = results.filter((r) => !r.error);
    return {
      timeframe: parsed.timeframe,
      from: from.toISOString(),
      to: to.toISOString(),
      inserted: succeeded.reduce((a, r) => a + r.inserted, 0),
      skipped: succeeded.reduce((a, r) => a + r.skipped, 0),
      dropped: succeeded.reduce((a, r) => a + r.dropped, 0),
      symbols: results,
      partial: succeeded.length > 0 && succeeded.length < results.length,
    };
  }
}

/**
 * Top-level convenience function delegating to MarketDataIngestor.ingest.
 */
export async function ingest(
  request: IngestRequest,
  options: IngestOptions = {},
): Promise<IngestResult> {
  return MarketDataIngestor.ingest(request, options);
}
