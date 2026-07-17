import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { priceBars, indicatorSnapshots } from "../db/schema.js";
import { config } from "../config.js";
import { createModuleLogger } from "./logger.js";

const logger = createModuleLogger("quant-client");

/**
 * HTTP client for the Python quant service.
 *
 * Sends bar series to POST /indicators and returns computed values.
 * The quant service is stateless; the backend owns data persistence.
 */

interface QuantBar {
  symbol: string;
  timeframe: string;
  barTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  asOf: string;
}

interface QuantIndicatorResult {
  barTime: string;
  values: Record<string, number | null>;
}

interface QuantIndicatorResponse {
  indicators: QuantIndicatorResult[];
}

/**
 * Call the quant service to compute indicators for stored bars,
 * then persist the results in `indicator_snapshots`.
 */
export async function computeAndStoreIndicators(
  symbol: string,
  timeframe: string = "1D"
) {
  // Fetch all bars for this symbol+timeframe from the DB
  const bars = await db
    .select()
    .from(priceBars)
    .where(
      and(eq(priceBars.symbol, symbol), eq(priceBars.timeframe, timeframe))
    )
    .orderBy(asc(priceBars.barTime));

  if (bars.length === 0) {
    logger.warn({ symbol, timeframe }, "No bars found — skipping indicators");
    return { computed: 0 };
  }

  // Transform DB rows to the format the quant service expects
  const quantBars: QuantBar[] = bars.map((b) => ({
    symbol: b.symbol,
    timeframe: b.timeframe,
    barTime: b.barTime.toISOString(),
    open: Number(b.open),
    high: Number(b.high),
    low: Number(b.low),
    close: Number(b.close),
    volume: b.volume,
    asOf: b.asOf.toISOString(),
  }));

  // Call the quant service
  const url = `${config.QUANT_SERVICE_URL}/indicators`;
  logger.info({ url, symbol, barCount: quantBars.length }, "Calling quant service");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bars: quantBars }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, body }, "Quant service error");
    throw new Error(`Quant service /indicators failed: ${res.status}`);
  }

  const data = (await res.json()) as QuantIndicatorResponse;

  // Find the newest bar's as_of — the indicator snapshot's as_of
  // cannot claim knowledge earlier than its inputs
  const newestAsOf = bars.reduce(
    (max, b) => (b.asOf > max ? b.asOf : max),
    bars[0].asOf
  );

  // Persist indicator snapshots
  let stored = 0;
  for (const ind of data.indicators) {
    await db
      .insert(indicatorSnapshots)
      .values({
        symbol,
        timeframe,
        barTime: new Date(ind.barTime),
        values: ind.values,
        asOf: newestAsOf,
      })
      .onConflictDoNothing();
    stored++;
  }

  logger.info(
    { symbol, timeframe, computed: data.indicators.length, stored },
    "Indicators computed and stored"
  );

  return { computed: data.indicators.length, stored };
}
