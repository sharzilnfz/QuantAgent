import { PriceBar, Timeframe } from "@committee/contracts";
import { z } from "zod";

import { AlpacaClient, type AlpacaClientOptions, type AlpacaRawBar } from "./alpaca-client.js";
import { computeAsOf, sessionCloseUtc } from "./as-of.js";
import { cacheFromEnv } from "./fs-cache.js";
import { createDrizzleStore, type PriceBarStore } from "./store.js";

/**
 * Spec 04 — Market Data Ingestion (L0).
 *
 * The layer's one job it cannot get wrong is POINT-IN-TIME CORRECTNESS. The
 * `as_of` rule lives in `./as-of.ts`; read that module header before touching
 * anything here. In short:
 *
 *   1Day  → as_of = 16:00 America/New_York on the bar's own session date
 *   1Hour → as_of = ts + 1 hour
 *   never in the future — bars that are not yet final are DROPPED, not clamped
 *
 * `fetchBars()` is the testable seam: raw Alpaca payload in, normalized and
 * `as_of`-stamped `PriceBar[]` out, with no DB and no clock surprises (inject
 * `now` for determinism).
 */

export const SOURCE = "alpaca";

export const IngestRequest = z.object({
  symbols: z.array(z.string().min(1)).min(1),
  from: z.string().datetime({ offset: true }).or(z.string().min(4)),
  to: z.string().datetime({ offset: true }).or(z.string().min(4)),
  timeframe: Timeframe.default("1Day"),
});
export type IngestRequest = z.infer<typeof IngestRequest>;

export interface FetchBarsOptions extends AlpacaClientOptions {
  /** Pre-built client (tests inject a fake fetch through this or `fetchImpl`). */
  client?: Pick<AlpacaClient, "getBars">;
  /** Clock injection. Defaults to `new Date()`. Never read inside the math. */
  now?: Date;
}

export interface PerSymbolResult {
  symbol: string;
  fetched: number;
  inserted: number;
  skipped: number;
  /** Bars discarded because their `as_of` was still in the future (not final). */
  dropped: number;
  error?: string;
}

export interface IngestResult {
  timeframe: Timeframe;
  from: string;
  to: string;
  inserted: number;
  skipped: number;
  dropped: number;
  symbols: PerSymbolResult[];
  /** True when at least one symbol failed but others succeeded. */
  partial: boolean;
}

/** Coerce Alpaca's loosely-typed numerics; reject anything non-finite. */
function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Raw Alpaca bars → validated, `as_of`-stamped `PriceBar[]`.
 *
 * Pure and synchronous: no network, no DB, no ambient clock. This is the
 * function the fixture tests pin.
 *
 * Guarantees on the returned array:
 *   - sorted ascending by `ts`, deduped on `ts` (last write wins)
 *   - all timestamps are UTC ISO-8601 strings
 *   - `asOf` obeys the documented rule and is NEVER > `now`
 *   - every element validates against the contracts `PriceBar` schema
 */
export function normalizeBars(
  raw: readonly AlpacaRawBar[],
  symbol: string,
  timeframe: Timeframe,
  options: { now?: Date } = {},
): { bars: PriceBar[]; dropped: number; malformed: number } {
  const now = options.now ?? new Date();
  const byTs = new Map<number, PriceBar>();
  let dropped = 0;
  let malformed = 0;

  for (const r of raw) {
    const tsMs = Date.parse(r?.t ?? "");
    if (Number.isNaN(tsMs)) {
      malformed += 1;
      continue;
    }
    const ts = new Date(tsMs);

    const open = num(r.o);
    const high = num(r.h);
    const low = num(r.l);
    const close = num(r.c);
    const volume = num(r.v);
    if (open === null || high === null || low === null || close === null || volume === null) {
      malformed += 1;
      continue;
    }

    const asOf = computeAsOf(ts, timeframe);

    // NEVER IN THE FUTURE. A bar whose as_of has not arrived yet is not final.
    // We drop it rather than clamping to `now` — clamping would move `as_of`
    // EARLIER than the truth, which is precisely the look-ahead bug this whole
    // layer exists to prevent.
    if (asOf.getTime() > now.getTime()) {
      dropped += 1;
      continue;
    }

    byTs.set(tsMs, {
      symbol,
      timeframe,
      ts: ts.toISOString(),
      open,
      high,
      low,
      close,
      volume,
      asOf: asOf.toISOString(),
    });
  }

  const bars = [...byTs.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, bar]) => PriceBar.parse(bar));

  return { bars, dropped, malformed };
}

/**
 * The reusable seam spec 05 and the tests use.
 * Fetches bars for one symbol over [from, to] and returns them normalized and
 * `as_of`-stamped.
 */
export async function fetchBars(
  symbol: string,
  timeframe: Timeframe,
  from: Date | string,
  to: Date | string,
  options: FetchBarsOptions = {},
): Promise<PriceBar[]> {
  const { bars } = await fetchBarsDetailed(symbol, timeframe, from, to, options);
  return bars;
}

/** Same as `fetchBars` but also reports what was discarded. */
export async function fetchBarsDetailed(
  symbol: string,
  timeframe: Timeframe,
  from: Date | string,
  to: Date | string,
  options: FetchBarsOptions = {},
): Promise<{ bars: PriceBar[]; dropped: number; malformed: number }> {
  const fromDate = from instanceof Date ? from : new Date(from);
  const toDate = to instanceof Date ? to : new Date(to);
  const client =
    options.client ?? new AlpacaClient({ cache: cacheFromEnv(), ...options });

  const raw = await client.getBars(symbol, timeframe, fromDate, toDate);
  return normalizeBars(raw, symbol, timeframe, { now: options.now });
}

export interface UpsertReport {
  inserted: number;
  skipped: number;
}

/**
 * Idempotent write. `skipped` counts bars whose (symbol, timeframe, ts) key was
 * already present — re-running the same window reports every bar as skipped and
 * changes no row count. Values are still upserted so upstream corrections
 * (adjustments, late tape) propagate.
 */
export async function upsertBars(
  bars: readonly PriceBar[],
  store: PriceBarStore,
  source: string = SOURCE,
): Promise<UpsertReport> {
  if (bars.length === 0) return { inserted: 0, skipped: 0 };

  const first = bars[0]!;
  let min = Date.parse(first.ts);
  let max = min;
  for (const bar of bars) {
    const t = Date.parse(bar.ts);
    if (t < min) min = t;
    if (t > max) max = t;
  }

  const existing = await store.existingKeys(
    first.symbol,
    first.timeframe,
    new Date(min),
    new Date(max),
  );

  let inserted = 0;
  let skipped = 0;
  for (const bar of bars) {
    if (existing.has(new Date(bar.ts).toISOString())) skipped += 1;
    else inserted += 1;
  }

  await store.upsert([...bars], source);
  return { inserted, skipped };
}

export interface IngestOptions extends FetchBarsOptions {
  store?: PriceBarStore;
  source?: string;
}

/**
 * Fetch + upsert for a list of symbols. Delegated to MarketDataIngestor.
 */
export async function ingestPrices(
  request: IngestRequest,
  options: IngestOptions = {},
): Promise<IngestResult> {
  const { MarketDataIngestor } = await import("./market-data-ingestor.js");
  return MarketDataIngestor.ingest(request, options);
}

export { computeAsOf, sessionCloseUtc };

