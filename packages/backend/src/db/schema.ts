import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  jsonb,
  integer,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────
export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "pending",
  "success",
  "error",
]);

export const biasEnum = pgEnum("bias", ["bullish", "bearish", "neutral"]);

// ─── Users ──────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Refresh tokens ─────────────────────────────────────────────────────────
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Alpaca credentials (encrypted at rest) ─────────────────────────────────
export const alpacaCredentials = pgTable("alpaca_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  keyCiphertext: text("key_ciphertext").notNull(),
  secretCiphertext: text("secret_ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  isPaper: boolean("is_paper").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Assets ─────────────────────────────────────────────────────────────────
export const assets = pgTable("assets", {
  symbol: varchar("symbol", { length: 20 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  exchange: varchar("exchange", { length: 50 }),
  assetClass: varchar("asset_class", { length: 50 }),
});

// ─── Watchlist items ────────────────────────────────────────────────────────
export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 20 })
      .notNull()
      .references(() => assets.symbol),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("watchlist_user_symbol_idx").on(table.userId, table.symbol),
  ]
);

// ─── Price bars (point-in-time: as_of) ──────────────────────────────────────
export const priceBars = pgTable(
  "price_bars",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: varchar("symbol", { length: 20 })
      .notNull()
      .references(() => assets.symbol),
    timeframe: varchar("timeframe", { length: 10 }).notNull(),
    barTime: timestamp("bar_time", { withTimezone: true }).notNull(),
    open: numeric("open", { precision: 18, scale: 8 }).notNull(),
    high: numeric("high", { precision: 18, scale: 8 }).notNull(),
    low: numeric("low", { precision: 18, scale: 8 }).notNull(),
    close: numeric("close", { precision: 18, scale: 8 }).notNull(),
    volume: integer("volume").notNull(),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("price_bars_symbol_tf_bartime_idx").on(
      table.symbol,
      table.timeframe,
      table.barTime
    ),
  ]
);

// ─── Indicator snapshots (point-in-time: as_of) ────────────────────────────
export const indicatorSnapshots = pgTable("indicator_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  symbol: varchar("symbol", { length: 20 })
    .notNull()
    .references(() => assets.symbol),
  timeframe: varchar("timeframe", { length: 10 }).notNull(),
  barTime: timestamp("bar_time", { withTimezone: true }).notNull(),
  values: jsonb("values").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  asOf: timestamp("as_of", { withTimezone: true }).notNull(),
});

// ─── Agent runs ─────────────────────────────────────────────────────────────
export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  agentName: varchar("agent_name", { length: 100 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  status: agentRunStatusEnum("status").notNull().default("pending"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  decisionAsOf: timestamp("decision_as_of", { withTimezone: true }).notNull(),
});

// ─── Agent outputs (point-in-time: as_of) ───────────────────────────────────
export const agentOutputs = pgTable("agent_outputs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentRunId: uuid("agent_run_id")
    .notNull()
    .references(() => agentRuns.id, { onDelete: "cascade" }),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  bias: biasEnum("bias").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
  rationale: text("rationale").notNull(),
  features: jsonb("features").notNull(),
  asOf: timestamp("as_of", { withTimezone: true }).notNull(),
  schemaVersion: varchar("schema_version", { length: 20 })
    .notNull()
    .default("1.0.0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Forward-declared stubs (deferred to later sprints) ─────────────────────
// These exist so the schema file is the single source of truth for all tables.
// They are empty stubs — actual columns will be added when their features land.

/** Deferred: trade execution orders (Sprint 2+) */
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Deferred columns: user_id, symbol, side, qty, type, status, alpaca_order_id, etc.
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Deferred: agent layered memory (Sprint 3+) */
export const memoryShortTerm = pgTable("memory_short_term", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const memoryLongTerm = pgTable("memory_long_term", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Deferred: debate engine (Sprint 3+) */
export const debateRounds = pgTable("debate_rounds", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Deferred: agent reflections (Sprint 4+) */
export const reflections = pgTable("reflections", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Deferred: generated reports (Sprint 4+) */
export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
