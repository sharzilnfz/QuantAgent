import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { timeframeEnum } from "./enums";

/**
 * L0 fact tables. POINT-IN-TIME DISCIPLINE:
 *
 *   `ts`    — market time the datum is *about* (bar open time).
 *   `as_of` — the moment we could first have KNOWN it (bar close / session end
 *             for daily bars). Every downstream decision query filters
 *             `WHERE as_of <= :decision_ts`. `as_of` is NOT NULL and indexed on
 *             every fact table so that filter stays cheap.
 *
 * Money/price columns are `numeric` (never float); all timestamps are
 * `timestamptz`. Field names stay isomorphic with the contracts `PriceBar` /
 * `IndicatorSnapshot` Zod schemas (spec 02 §4).
 */

export const priceBars = pgTable(
  "price_bars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    timeframe: timeframeEnum("timeframe").notNull(),
    // bar open time (market time)
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    open: numeric("open").notNull(),
    high: numeric("high").notNull(),
    low: numeric("low").notNull(),
    close: numeric("close").notNull(),
    volume: numeric("volume").notNull(),
    // when this bar became knowable — the point-in-time boundary column
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    source: text("source").notNull().default("alpaca"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("price_bars_symbol_tf_ts_uq").on(t.symbol, t.timeframe, t.ts),
    index("price_bars_symbol_tf_ts_idx").on(t.symbol, t.timeframe, t.ts),
    index("price_bars_as_of_idx").on(t.asOf),
  ],
);

/**
 * Shape of the `indicators` jsonb payload. Kept isomorphic with the contracts
 * `IndicatorSnapshot` Zod schema (camelCase, nullable numeric fields).
 */
export type IndicatorValues = {
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  sma20: number | null;
  sma50: number | null;
  [key: string]: number | null | undefined;
};

export const indicatorSnapshots = pgTable(
  "indicator_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    timeframe: timeframeEnum("timeframe").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    indicators: jsonb("indicators").$type<IndicatorValues>().notNull(),
    // when these indicator values became knowable
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("indicator_snapshots_symbol_tf_ts_uq").on(
      t.symbol,
      t.timeframe,
      t.ts,
    ),
    index("indicator_snapshots_symbol_tf_ts_idx").on(
      t.symbol,
      t.timeframe,
      t.ts,
    ),
    index("indicator_snapshots_as_of_idx").on(t.asOf),
  ],
);
