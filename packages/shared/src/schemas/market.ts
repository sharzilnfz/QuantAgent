import { z } from "zod";
import { ISODateTime } from "./agent.js";

// ─── Timeframe enum ─────────────────────────────────────────────────────────
export const TimeframeEnum = z.enum(["1Min", "5Min", "15Min", "1H", "1D"]);
export type Timeframe = z.infer<typeof TimeframeEnum>;

// ─── OHLCV Bar ──────────────────────────────────────────────────────────────
/**
 * A single OHLCV price bar as stored in `price_bars`.
 * `barTime` = the market timestamp of the bar.
 * `asOf` = when this data became available to the system (point-in-time).
 */
export const BarSchema = z.object({
  symbol: z.string().min(1),
  timeframe: TimeframeEnum,
  barTime: ISODateTime,
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().int().nonnegative(),
  asOf: ISODateTime,
});
export type Bar = z.infer<typeof BarSchema>;

// ─── Indicator values (stored as JSONB in indicator_snapshots.values) ────────
export const IndicatorValuesSchema = z.object({
  rsi: z.number().nullable().optional(),
  macd: z.number().nullable().optional(),
  macd_signal: z.number().nullable().optional(),
  macd_hist: z.number().nullable().optional(),
  bb_upper: z.number().nullable().optional(),
  bb_mid: z.number().nullable().optional(),
  bb_lower: z.number().nullable().optional(),
  sma: z.number().nullable().optional(),
  ema: z.number().nullable().optional(),
});
export type IndicatorValues = z.infer<typeof IndicatorValuesSchema>;

// ─── Indicator snapshot ─────────────────────────────────────────────────────
/**
 * A computed indicator snapshot for a specific bar.
 * `asOf` = the newest contributing bar's `as_of`, so the snapshot cannot claim
 * knowledge earlier than its inputs.
 */
export const IndicatorSnapshotSchema = z.object({
  symbol: z.string().min(1),
  timeframe: TimeframeEnum,
  barTime: ISODateTime,
  values: IndicatorValuesSchema,
  computedAt: ISODateTime,
  asOf: ISODateTime,
});
export type IndicatorSnapshot = z.infer<typeof IndicatorSnapshotSchema>;

// ─── Bar array for quant service input ──────────────────────────────────────
export const BarSeriesSchema = z.array(BarSchema);
export type BarSeries = z.infer<typeof BarSeriesSchema>;

// ─── Quant service response ─────────────────────────────────────────────────
export const IndicatorResponseSchema = z.object({
  indicators: z.array(
    z.object({
      barTime: ISODateTime,
      values: IndicatorValuesSchema,
    })
  ),
});
export type IndicatorResponse = z.infer<typeof IndicatorResponseSchema>;
