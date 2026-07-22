import type { IndicatorSnapshot, Timeframe } from "@committee/contracts";

/**
 * Spec 07 §5 — POINT-IN-TIME snapshot access (cross-cutting law #1).
 *
 * The ONLY legal snapshot for a decision is the latest one whose `as_of` is at or
 * before `decisionTs`. A snapshot with `as_of > decisionTs` is future data and must
 * never influence the output — not "deprioritised", not "weighted down": excluded.
 *
 * Like the runner's persistence, this is an injectable seam so the PIT test can run
 * against an in-memory fixture with no Postgres.
 */

export interface SnapshotQuery {
  symbol: string;
  timeframe: Timeframe;
  /** The point-in-time boundary. */
  decisionTs: string;
}

export interface SnapshotProvider {
  /** Latest snapshot with `asOf <= decisionTs`, or null when none exists. */
  latestSnapshot(query: SnapshotQuery): Promise<IndicatorSnapshot | null>;
}

/** Postgres-backed provider. `@committee/db` is imported lazily (see persistence.ts). */
export function createDbSnapshotProvider(): SnapshotProvider {
  return {
    async latestSnapshot(query) {
      const { db, indicatorSnapshots } = await import("@committee/db");
      const { and, eq, lte, desc } = await import("drizzle-orm");

      const rows = await db
        .select()
        .from(indicatorSnapshots)
        .where(
          and(
            eq(indicatorSnapshots.symbol, query.symbol),
            eq(indicatorSnapshots.timeframe, query.timeframe),
            // THE point-in-time filter. Never `>=`, never omitted.
            lte(indicatorSnapshots.asOf, new Date(query.decisionTs)),
          ),
        )
        .orderBy(desc(indicatorSnapshots.asOf), desc(indicatorSnapshots.ts))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      const values = row.indicators;
      return {
        symbol: row.symbol,
        timeframe: row.timeframe,
        ts: row.ts.toISOString(),
        rsi: numberOrNull(values.rsi),
        macd: numberOrNull(values.macd),
        macdSignal: numberOrNull(values.macdSignal),
        bbUpper: numberOrNull(values.bbUpper),
        bbLower: numberOrNull(values.bbLower),
        sma20: numberOrNull(values.sma20),
        sma50: numberOrNull(values.sma50),
        asOf: row.asOf.toISOString(),
      };
    },
  };
}

/** Returns null when no `DATABASE_URL` is configured, so offline runs degrade cleanly. */
export function resolveDefaultSnapshotProvider(): SnapshotProvider | null {
  return process.env.DATABASE_URL ? createDbSnapshotProvider() : null;
}

/**
 * In-memory provider over a fixed set of snapshots. Applies the SAME point-in-time
 * filter as the SQL version, so a test that passes here reflects real behaviour.
 */
export function createInMemorySnapshotProvider(
  snapshots: IndicatorSnapshot[],
): SnapshotProvider {
  return {
    async latestSnapshot(query) {
      const legal = snapshots
        .filter(
          (snapshot) =>
            snapshot.symbol === query.symbol &&
            snapshot.timeframe === query.timeframe &&
            Date.parse(snapshot.asOf) <= Date.parse(query.decisionTs),
        )
        .sort((a, b) => Date.parse(b.asOf) - Date.parse(a.asOf));
      return legal[0] ?? null;
    },
  };
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
