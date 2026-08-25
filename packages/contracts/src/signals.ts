import { z } from "zod";
import { Timeframe } from "./enums";

/**
 * L0/L1 signal shapes consumed by the UI and the quant service.
 *
 * Point-in-time discipline: every record carries an `asOf` ISO timestamp = the moment
 * the datum became knowable. Timestamps are ISO-8601 strings at the contract boundary
 * (JSON-safe across the TS<->Python seam); convert to Date/timestamptz inside each service.
 *
 * Field names are kept isomorphic with spec 01's `price_bars` / `indicator_snapshots`
 * tables so a DB row and a validated payload map 1:1.
 */

/** A single OHLCV price bar. Mirrors `price_bars`. */
export const PriceBar = z.object({
  symbol: z.string(),
  timeframe: Timeframe,
  ts: z.string().datetime(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  asOf: z.string().datetime(),
});
export type PriceBar = z.infer<typeof PriceBar>;

/**
 * A snapshot of deterministic indicators at a point in time. Mirrors `indicator_snapshots`.
 * Any indicator can be null when its lookback window is not yet satisfied.
 */
export const IndicatorSnapshot = z.object({
  symbol: z.string(),
  timeframe: Timeframe,
  ts: z.string().datetime(),
  rsi: z.number().nullable(),
  macd: z.number().nullable(),
  macdSignal: z.number().nullable(),
  bbUpper: z.number().nullable(),
  bbLower: z.number().nullable(),
  sma20: z.number().nullable(),
  sma50: z.number().nullable(),
  asOf: z.string().datetime(),
});
export type IndicatorSnapshot = z.infer<typeof IndicatorSnapshot>;

/**
 * A timestamped financial news item.
 * Point-in-time discipline: `asOf` is the moment the headline was published and knowable.
 */
export const NewsItem = z.object({
  id: z.string(),
  headline: z.string(),
  summary: z.string().optional(),
  source: z.string().default("benzinga"),
  url: z.string().optional(),
  symbols: z.array(z.string()),
  publishedAt: z.string().datetime(),
  asOf: z.string().datetime(),
});
export type NewsItem = z.infer<typeof NewsItem>;

import { PredictionMarketEvent } from "./polymarket";
import { FundamentalReport } from "./fundamentals";

/**
 * A complete frozen dataset fixture containing price bars, news items, prediction markets, and fundamental reports for a symbol.
 */
export const DatasetFixture = z.object({
  symbol: z.string(),
  bars: z.array(PriceBar),
  news: z.array(NewsItem),
  predictionMarkets: z.array(PredictionMarketEvent).optional(),
  fundamentals: z.array(FundamentalReport).optional(),
});
export type DatasetFixture = z.infer<typeof DatasetFixture>;

