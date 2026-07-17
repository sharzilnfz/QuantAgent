import { lte, eq, and, asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { priceBars, indicatorSnapshots } from "../db/schema.js";

/**
 * Point-in-time read guard.
 *
 * Every read that feeds into a decision (agent analysis, backtesting)
 * MUST go through these helpers. They enforce the rule:
 *   "A decision at time T may only see data with as_of <= T."
 *
 * This is the ONLY sanctioned way to read decision-feeding data.
 */

/**
 * Retrieve price bars for a symbol+timeframe that were available
 * at or before `decisionTime`. Bars are ordered by `barTime` ascending.
 */
export async function barsAsOf(
  symbol: string,
  timeframe: string,
  decisionTime: Date
) {
  return db
    .select()
    .from(priceBars)
    .where(
      and(
        eq(priceBars.symbol, symbol),
        eq(priceBars.timeframe, timeframe),
        lte(priceBars.asOf, decisionTime)
      )
    )
    .orderBy(asc(priceBars.barTime));
}

/**
 * Retrieve indicator snapshots for a symbol+timeframe that were available
 * at or before `decisionTime`. Ordered by `barTime` ascending.
 */
export async function indicatorsAsOf(
  symbol: string,
  timeframe: string,
  decisionTime: Date
) {
  return db
    .select()
    .from(indicatorSnapshots)
    .where(
      and(
        eq(indicatorSnapshots.symbol, symbol),
        eq(indicatorSnapshots.timeframe, timeframe),
        lte(indicatorSnapshots.asOf, decisionTime)
      )
    )
    .orderBy(asc(indicatorSnapshots.barTime));
}

/**
 * Get the most recent indicator snapshot for a symbol+timeframe
 * available at or before `decisionTime`.
 */
export async function latestIndicatorAsOf(
  symbol: string,
  timeframe: string,
  decisionTime: Date
) {
  const rows = await db
    .select()
    .from(indicatorSnapshots)
    .where(
      and(
        eq(indicatorSnapshots.symbol, symbol),
        eq(indicatorSnapshots.timeframe, timeframe),
        lte(indicatorSnapshots.asOf, decisionTime)
      )
    )
    .orderBy(asc(indicatorSnapshots.barTime));

  return rows.length > 0 ? rows[rows.length - 1] : null;
}
