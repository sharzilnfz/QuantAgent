import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  jsonb,
  boolean,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { directionEnum } from "./enums";

/**
 * Custom pgvector data type for Postgres vector embeddings.
 */
export const pgVector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions?: number };
}>({
  dataType(config) {
    return config?.dimensions ? `vector(${config.dimensions})` : "vector";
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string | number[] | null): number[] {
    if (Array.isArray(value)) return value;
    return typeof value === "string" && value.length > 0 ? JSON.parse(value) : [];
  },
});

/**
 * L3 / Memory Layer: Short-term decision memory and working cache.
 * Every row carries `as_of` for strict point-in-time filtering.
 */
export const memoryShortTerm = pgTable(
  "memory_short_term",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    decisionTs: timestamp("decision_ts", { withTimezone: true }).notNull(),
    direction: directionEnum("direction").notNull(),
    confidence: numeric("confidence").notNull(),
    rationale: text("rationale").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("memory_short_term_symbol_idx").on(t.symbol),
    index("memory_short_term_as_of_idx").on(t.asOf),
    index("memory_short_term_decision_ts_idx").on(t.decisionTs),
  ],
);

/**
 * L3 / Memory Layer: Long-term persistent knowledge store (company facts, risk rules, guidelines).
 * Supports semantic vector search with pgvector and metadata filtering.
 */
export const memoryLongTerm = pgTable(
  "memory_long_term",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: text("category").notNull(), // 'company_fact' | 'risk_rule' | 'market_regime' | 'guidance'
    symbol: text("symbol"), // null for general cross-asset rules
    title: text("title").notNull(),
    content: text("content").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    embedding: pgVector("embedding", { dimensions: 1536 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("memory_long_term_symbol_idx").on(t.symbol),
    index("memory_long_term_category_idx").on(t.category),
    index("memory_long_term_as_of_idx").on(t.asOf),
  ],
);

/**
 * L3 / Memory Layer: Post-trade episodic reflections.
 * Records lessons, execution critique, and detected signal contradictions.
 */
export const episodicReflections = pgTable(
  "episodic_reflections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    tradeId: text("trade_id"),
    decisionTs: timestamp("decision_ts", { withTimezone: true }).notNull(),
    reviewTs: timestamp("review_ts", { withTimezone: true }).notNull(),
    initialDirection: directionEnum("initial_direction").notNull(),
    initialConfidence: numeric("initial_confidence").notNull(),
    outcomeReturnPct: numeric("outcome_return_pct").notNull(),
    holdingBars: numeric("holding_bars").notNull(),
    critique: text("critique").notNull(),
    lessonLearned: text("lesson_learned").notNull(),
    contradictionDetected: boolean("contradiction_detected").notNull().default(false),
    contradictionDetails: text("contradiction_details"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("episodic_reflections_symbol_idx").on(t.symbol),
    index("episodic_reflections_as_of_idx").on(t.asOf),
    index("episodic_reflections_decision_ts_idx").on(t.decisionTs),
  ],
);
