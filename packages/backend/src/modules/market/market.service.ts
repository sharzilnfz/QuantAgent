import { eq, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { priceBars, indicatorSnapshots, assets } from "../../db/schema.js";
import { createAlpacaClient } from "../../lib/alpaca.js";
import { getDecryptedAlpacaCredentials } from "../credentials/credentials.service.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("market");

/**
 * Ingest OHLCV bars for a symbol from Alpaca and store them point-in-time.
 *
 * - Fetches historical bars for the given timeframe
 * - Normalizes Alpaca response → DB format
 * - Upserts into `price_bars` (idempotent on symbol+timeframe+barTime)
 * - Sets `as_of = now()` for live ingestion
 */
export async function ingestBars(
  userId: string,
  symbol: string,
  timeframe: string = "1D",
  daysBack: number = 90
) {
  // Get user's Alpaca credentials
  const creds = await getDecryptedAlpacaCredentials(userId);
  if (!creds) {
    throw new Error("Alpaca credentials not configured");
  }

  const client = createAlpacaClient(creds);
  const now = new Date();
  const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const alpacaBars = await client.getBars(
    symbol,
    timeframe,
    start.toISOString(),
    now.toISOString()
  );

  const asOf = now; // live ingestion: as_of ≈ ingestion time

  let upsertCount = 0;
  for (const bar of alpacaBars) {
    await db
      .insert(priceBars)
      .values({
        symbol,
        timeframe,
        barTime: new Date(bar.t),
        open: String(bar.o),
        high: String(bar.h),
        low: String(bar.l),
        close: String(bar.c),
        volume: bar.v,
        asOf,
      })
      .onConflictDoNothing();

    upsertCount++;
  }

  logger.info(
    { symbol, timeframe, fetched: alpacaBars.length, upserted: upsertCount },
    "Bar ingestion complete"
  );

  return { symbol, timeframe, fetched: alpacaBars.length };
}

/**
 * Get stored price bars for a symbol+timeframe.
 */
export async function getStoredBars(symbol: string, timeframe: string = "1D") {
  return db
    .select()
    .from(priceBars)
    .where(
      and(eq(priceBars.symbol, symbol), eq(priceBars.timeframe, timeframe))
    )
    .orderBy(priceBars.barTime);
}

/**
 * Get stored indicator snapshots for a symbol+timeframe.
 */
export async function getStoredIndicators(
  symbol: string,
  timeframe: string = "1D"
) {
  return db
    .select()
    .from(indicatorSnapshots)
    .where(
      and(
        eq(indicatorSnapshots.symbol, symbol),
        eq(indicatorSnapshots.timeframe, timeframe)
      )
    )
    .orderBy(indicatorSnapshots.barTime);
}

/**
 * Verify that a symbol exists in the assets table.
 */
export async function assetExists(symbol: string): Promise<boolean> {
  const [row] = await db
    .select({ symbol: assets.symbol })
    .from(assets)
    .where(eq(assets.symbol, symbol))
    .limit(1);
  return !!row;
}
