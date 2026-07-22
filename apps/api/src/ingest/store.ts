import type { PriceBar, Timeframe } from "@committee/contracts";

/**
 * Persistence seam for ingested bars.
 *
 * `prices.ts` talks to this interface, never to Drizzle directly, so the
 * idempotency logic is unit-testable with an in-memory store and no Postgres.
 * The Drizzle implementation lazily imports `@committee/db` — that module
 * throws at import time when `DATABASE_URL` is unset, and pure normalization /
 * `as_of` tests must not need a database.
 */
export interface PriceBarStore {
  /** ISO `ts` strings already present for (symbol, timeframe) within [from, to]. */
  existingKeys(symbol: string, timeframe: Timeframe, from: Date, to: Date): Promise<Set<string>>;
  /** Idempotent write: conflict on (symbol, timeframe, ts) updates in place. */
  upsert(bars: PriceBar[], source: string): Promise<void>;
}

/** In-memory store — used by tests and by `--dry-run`. */
export class InMemoryPriceBarStore implements PriceBarStore {
  readonly rows = new Map<string, PriceBar & { source: string }>();

  private static key(symbol: string, timeframe: Timeframe, ts: string): string {
    return `${symbol}|${timeframe}|${new Date(ts).toISOString()}`;
  }

  async existingKeys(
    symbol: string,
    timeframe: Timeframe,
    from: Date,
    to: Date,
  ): Promise<Set<string>> {
    const out = new Set<string>();
    for (const row of this.rows.values()) {
      if (row.symbol !== symbol || row.timeframe !== timeframe) continue;
      const t = new Date(row.ts).getTime();
      if (t < from.getTime() || t > to.getTime()) continue;
      out.add(new Date(row.ts).toISOString());
    }
    return out;
  }

  async upsert(bars: PriceBar[], source: string): Promise<void> {
    for (const bar of bars) {
      this.rows.set(InMemoryPriceBarStore.key(bar.symbol, bar.timeframe, bar.ts), {
        ...bar,
        source,
      });
    }
  }
}

/**
 * Drizzle-backed store. Constructed lazily so importing this module (and
 * therefore `prices.ts`) never requires a live `DATABASE_URL`.
 */
export async function createDrizzleStore(): Promise<PriceBarStore> {
  const { db, priceBars } = await import("@committee/db");
  const { and, eq, gte, lte, sql } = await import("drizzle-orm");

  return {
    async existingKeys(symbol, timeframe, from, to) {
      const rows = await db
        .select({ ts: priceBars.ts })
        .from(priceBars)
        .where(
          and(
            eq(priceBars.symbol, symbol),
            eq(priceBars.timeframe, timeframe),
            gte(priceBars.ts, from),
            lte(priceBars.ts, to),
          ),
        );
      return new Set(rows.map((r) => new Date(r.ts).toISOString()));
    },

    async upsert(bars, source) {
      if (bars.length === 0) return;
      // `numeric` columns are strings in Drizzle — never floats, per spec 01.
      const values = bars.map((bar) => ({
        symbol: bar.symbol,
        timeframe: bar.timeframe,
        ts: new Date(bar.ts),
        open: String(bar.open),
        high: String(bar.high),
        low: String(bar.low),
        close: String(bar.close),
        volume: String(bar.volume),
        asOf: new Date(bar.asOf),
        source,
      }));

      // Chunked so a large backfill can't exceed the parameter limit.
      const CHUNK = 500;
      for (let i = 0; i < values.length; i += CHUNK) {
        await db
          .insert(priceBars)
          .values(values.slice(i, i + CHUNK))
          .onConflictDoUpdate({
            target: [priceBars.symbol, priceBars.timeframe, priceBars.ts],
            set: {
              open: sql`excluded.open`,
              high: sql`excluded.high`,
              low: sql`excluded.low`,
              close: sql`excluded.close`,
              volume: sql`excluded.volume`,
              asOf: sql`excluded.as_of`,
              source: sql`excluded.source`,
            },
          });
      }
    },
  };
}
