# 🎓 The Committee — Sprint 1 Codebase Masterclass

> **Your guide to understanding every line of a production-grade, multi-agent paper-trading system.**
> Written for a beginner programmer learning full-stack engineering from the ground up.

---

## Table of Contents

- [Chapter 0: The Big Picture](#chapter-0-the-big-picture)
- [Chapter 1: Spec 01 — Database Schema & Core Models](#chapter-1-spec-01--database-schema--core-models)
- [Chapter 2: Spec 02 — Shared Contracts (Zod Schemas)](#chapter-2-spec-02--shared-contracts-zod-schemas)

> [!NOTE]
> This is Part 1 of the masterclass. Parts 2 and 3 cover Specs 03–08.

---

# Chapter 0: The Big Picture

## What Is This Project?

Imagine you're building a **committee of AI financial analysts**. Instead of trusting one analyst's opinion, you have three specialists:

1. 🔧 **Technical Analyst** — Reads charts, indicators, and patterns
2. 💬 **Sentiment Analyst** — Reads news headlines and judges mood
3. 📊 **Fundamental Analyst** — Reads company financials and judges value

When they **agree**, you act. When they **disagree**, they **debate** and a synthesis step resolves it. Then a **risk gate** (NOT an AI — a strict rulebook) decides if the trade is safe. If approved, a paper trade executes on Alpaca's sandbox.

**The key innovation**: This project doesn't just *demo* — it **evaluates** whether the multi-agent structure actually helps, using rigorous backtesting with "point-in-time" data discipline (meaning: no cheating by looking at future data).

## The Monorepo Structure

```
QuantAgent/
├── apps/
│   ├── api/        ← Node.js + Fastify backend (TypeScript)
│   ├── web/        ← React + Vite frontend (TypeScript)
│   └── quant/      ← Python + FastAPI service (indicators, backtesting)
├── packages/
│   ├── contracts/  ← Shared Zod schemas (the "language" everyone speaks)
│   └── db/         ← Drizzle ORM schema + migrations (the "ground truth")
└── specs/          ← Implementation specifications
```

### 💡 What is a Monorepo?

A **monorepo** is a single Git repository containing multiple related projects. Think of it like an apartment building — each apartment (`apps/api`, `apps/web`, etc.) is independent, but they share the same foundation (`packages/`).

**Why?** Because the API, the frontend, and the Python service all need to agree on what data looks like. By keeping them in one repo, you can change a data shape in `packages/contracts` and immediately see if it breaks anything anywhere.

### The Tool: pnpm Workspaces

```yaml
# pnpm-workspace.yaml
packages:
  - packages/*
  - apps/api
  - apps/web
```

This tells **pnpm** (a fast package manager, like npm but better) that these folders are all part of one project. When `apps/api` says `"@committee/contracts": "workspace:*"` in its `package.json`, pnpm links them together — no need to publish to npm.

## The Seven-Layer Architecture

Data flows **bottom-up** through the system:

```
┌─────────────────────────────────────────────────────────┐
│  L6  Execution     │ Alpaca paper orders → outcomes     │  Sprint 3
│  L5  Allocation    │ Position sizing (non-LLM)          │  Sprint 3
│  L4  Risk          │ Deterministic rules engine          │  Sprint 2
│  L3  Consensus     │ 2-of-3 check → debate if needed    │  Sprint 2
│  L2  Agent         │ Technical / Sentiment / Fundamental │  Sprint 1 ✓
│  L1  Signal        │ RSI, MACD, Bollinger (pure math)   │  Sprint 1 ✓
│  L0  Data          │ Ingest prices with timestamps       │  Sprint 1 ✓
└─────────────────────────────────────────────────────────┘
        ↕ Memory (cross-cutting) — Sprint 3
        ↕ Orchestrator (outer frame) — Sprint 2
```

**Sprint 1 builds L0, L1, one L2 agent, and the UI shell** — proving the whole spine works end-to-end.

## The Three Laws (Non-Negotiable Rules)

These are the iron laws that every line of code must obey:

### Law 1: Point-in-Time Discipline 🕐

> Every fact carries an `as_of` timestamp = **when it became knowable**.
> No query may ever read data whose `as_of` is after the current decision time.

**Real-world analogy**: Imagine you're writing a history exam. You're allowed to reference events up to March 2024. Using information from April 2024 would be cheating. That's what "look-ahead bias" is in trading — using future data to make past decisions. The `as_of` timestamp prevents this.

**Example**: A daily price bar for January 5th has:
- `ts = "2024-01-05T00:00:00Z"` — the bar is *about* January 5th
- `as_of = "2024-01-05T21:00:00Z"` — but we couldn't *know* it until the market closed at 4 PM ET (= 9 PM UTC)

### Law 2: Facts vs. Narration 📊

> Any number that CAN be computed deterministically MUST be computed in code.
> LLMs only reason over and narrate already-computed facts — they never invent numbers.

**Real-world analogy**: A weather reporter reads the temperature from a thermometer. They don't *guess* it's 72°F — the thermometer *computed* it. The reporter's job is to explain what 72°F *means* ("lovely day for a picnic"), not to make up the number.

### Law 3: Schema-First / Untrusted Model Text 🛡️

> Raw LLM output is untrusted until it validates against its Zod schema.
> Validation failure = neutral "no opinion", never a crash.

**Real-world analogy**: When a student submits an exam answer, the teacher checks if it's in the right format (essay when essay was asked, multiple choice when MC was asked). If the format is wrong, the answer gets a zero — but the teacher doesn't throw the entire exam in the trash.

## The Four Team Members

Each person owns a **disjoint slice** so no two people touch the same files:

| Member | Role | Owns |
|--------|------|------|
| **M1** | Agent Architecture Lead | `packages/contracts`, `apps/api/src/agents/` |
| **M2** | Data & Quant Engineer | `apps/api/src/ingest/`, `apps/quant/` |
| **M3** | Frontend Engineer | `apps/web/` |
| **M4** | Platform Engineer | `packages/db/`, `apps/api/src/auth/`, `apps/api/src/credentials/`, `apps/api/src/portfolio/` |

---

# Chapter 1: Spec 01 — Database Schema & Core Models

> **Owner**: M4 (Platform Engineer)
> **Layer**: L0 (Data)
> **Purpose**: The Postgres schema that everything reads and writes through
> **Unblocks**: Every other spec

## Why Start Here?

The database is the **foundation of the entire building**. Every other spec — auth, ingestion, agents, the dashboard — reads from or writes to these tables. If the schema is wrong, everything built on top is wrong.

The single most important design decision: **point-in-time fields exist from the first commit**. Retrofitting timestamps later is far more expensive than building them in now.

## Prerequisites: What You Need to Know

### What is PostgreSQL?

PostgreSQL (often called "Postgres") is a **relational database** — think of it as a very smart spreadsheet. Data lives in **tables** (like sheets), each with **columns** (like headers) and **rows** (like data entries). Unlike a spreadsheet, Postgres can:
- Handle millions of rows efficiently
- Enforce rules (like "this column can't be empty")
- Link tables together with **foreign keys**
- Run complex queries across multiple tables simultaneously

### What is Drizzle ORM?

An **ORM** (Object-Relational Mapper) lets you define your database tables in TypeScript code instead of writing raw SQL. **Drizzle** is a modern TypeScript ORM that:
- Generates your database tables from TypeScript definitions
- Creates **migration files** (SQL scripts that transform your database)
- Gives you **type-safe queries** (TypeScript catches errors before you run them)

### What is a Migration?

A migration is a **versioned change to your database**. Think of it like Git commits, but for your database structure. Migration `0000` creates all the tables. Migration `0001` might add a column. You can always replay them from scratch to rebuild the database.

## The Package: `packages/db`

### [package.json](../../packages/db/package.json)

```json
{
  "name": "@committee/db",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  }
}
```

**Key things to notice:**
- `"name": "@committee/db"` — The `@committee/` prefix is a **scope**. It namespaces the package so `apps/api` can import it as `@committee/db`.
- `"exports"` — Two entry points: `"."` (the full package with client + schema) and `"./schema"` (just the table definitions, no database connection). This matters because some files need the table *shapes* without opening a connection.

## The Enums

### [src/schema/enums.ts](../../packages/db/src/schema/enums.ts)

```typescript
import { pgEnum } from "drizzle-orm/pg-core";

export const timeframeEnum = pgEnum("timeframe", ["1Day", "1Hour"]);
export const directionEnum = pgEnum("direction", ["bullish", "bearish", "neutral"]);
export const agentNameEnum = pgEnum("agent_name", ["technical", "sentiment", "fundamental"]);
export const runStatusEnum = pgEnum("run_status", ["running", "completed", "failed"]);
```

### 💡 What is a Postgres Enum?

An enum (enumeration) is a column type that can only hold one of a fixed set of values. It's like a dropdown menu in a form — you can only pick from the options.

**Why not just use strings?** Because with strings, someone could accidentally write `"Bullish"` (capital B) or `"bull"` or `"buy"` — and your queries would miss them. An enum enforces: it MUST be exactly `"bullish"`, `"bearish"`, or `"neutral"`.

**Example**: If you try to insert `direction = "sideways"`, Postgres will refuse with an error. This catches bugs at the database level.

**Important**: These enums are **mirrored** in `packages/contracts` (as Zod enums) but NOT imported from there. Why? So `@committee/db` can typecheck independently. The values are kept in sync manually — they're a **cross-team contract**.

## The User & Auth Tables

### [src/schema/users.ts](../../packages/db/src/schema/users.ts)

Let's go through every table, member by member:

### `users` Table

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | `uuid` | PRIMARY KEY, default random | Unique identifier for each user |
| `email` | `text` | NOT NULL, UNIQUE | Login identifier |
| `passwordHash` | `text` | NOT NULL | Bcrypt hash of the password (NEVER plaintext!) |
| `createdAt` | `timestamptz` | NOT NULL, default now | When the account was created |

**Let's unpack each member:**

- **`uuid("id").primaryKey().defaultRandom()`**:
  - A **UUID** (Universally Unique Identifier) looks like `550e8400-e29b-41d4-a716-446655440000`. It's a 128-bit random ID that's practically guaranteed to be unique across the entire universe. Using UUIDs instead of auto-incrementing numbers (1, 2, 3...) means you don't leak information about how many users exist (ID 47 tells an attacker "there are at least 47 users").
  - `.primaryKey()` means this is THE column that uniquely identifies each row.
  - `.defaultRandom()` means Postgres generates a random UUID automatically if you don't provide one.

- **`text("email").notNull().unique()`**:
  - `.notNull()` — every user MUST have an email. A row without one is rejected.
  - `.unique()` — no two users can have the same email. The database enforces this even if the application code has a bug.

- **`text("password_hash")`**: This stores the **hashed** password, never the plain text. Hashing is a one-way function: you can turn "mypassword123" into `$2a$10$abc...xyz`, but you can never turn the hash back into the password. When a user logs in, you hash what they typed and compare the hashes.

- **`timestamp("created_at", { withTimezone: true })`**: `withTimezone: true` means Postgres stores and returns timestamps in UTC. This is crucial when your users are in different time zones — everyone agrees on one clock.

### `sessions` Table

```typescript
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 💡 What is a Session?

When you log in to a website, the server creates a **session** — a temporary "ticket" proving you're authenticated. The ticket ID is stored in a **cookie** in your browser. Every time you make a request, the browser sends the cookie, the server looks up the session row, and says "yep, you're User #42".

**Why server-side sessions instead of JWTs?** A JWT (JSON Web Token) is a self-contained token — the server doesn't need to look anything up. But that means you **can't revoke it** until it expires. With server-side sessions, logging out = deleting the row = immediate revocation.

| Column | Type | Purpose |
|--------|------|---------|
| `userId` | `uuid` (FK → users.id) | Which user this session belongs to |
| `expiresAt` | `timestamptz` | When this session expires |

**The `.references(() => users.id, { onDelete: "cascade" })` part:**
- This is a **foreign key** — it links this row to a row in `users`.
- `onDelete: "cascade"` means: if the user is deleted, all their sessions are automatically deleted too. Without this, you'd have orphaned session rows pointing to a user that no longer exists.

### `alpacaCredentials` Table

```typescript
export const alpacaCredentials = pgTable("alpaca_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  keyCiphertext: text("key_ciphertext").notNull(),
  secretCiphertext: text("secret_ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 💡 What is AES-256-GCM Encryption?

This table stores Alpaca API keys, which are like passwords for talking to the trading API. They must be **encrypted at rest** — meaning even if someone steals the database, they can't read the keys without the encryption key.

**AES-256-GCM** is a modern encryption algorithm:
- **AES** = Advanced Encryption Standard (the algorithm)
- **256** = the key is 256 bits long (very strong)
- **GCM** = Galois/Counter Mode (provides both encryption AND integrity checking)

The columns store:
- `keyCiphertext` / `secretCiphertext` — the encrypted data (gibberish without the key)
- `iv` — "Initialization Vector" — a random number used to ensure the same plaintext encrypts to different ciphertext each time
- `authTag` — a "seal" that detects if anyone tampered with the ciphertext

**Why `.unique()` on `userId`?** Each user has at most ONE set of Alpaca credentials. A second `POST /credentials` replaces the existing one.

### `watchlistItems` Table

```typescript
export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("watchlist_items_user_symbol_uq").on(t.userId, t.symbol)],
);
```

A watchlist is the list of stocks a user wants the agents to analyze. The **compound unique constraint** `unique().on(t.userId, t.symbol)` means: one user can't add AAPL twice, but two different users can both have AAPL on their watchlists.

## The Market Fact Tables (The Heart of Point-in-Time)

### [src/schema/market.ts](../../packages/db/src/schema/market.ts)

### `priceBars` Table

```typescript
export const priceBars = pgTable(
  "price_bars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    timeframe: timeframeEnum("timeframe").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    open: numeric("open").notNull(),
    high: numeric("high").notNull(),
    low: numeric("low").notNull(),
    close: numeric("close").notNull(),
    volume: numeric("volume").notNull(),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    source: text("source").notNull().default("alpaca"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("price_bars_symbol_tf_ts_uq").on(t.symbol, t.timeframe, t.ts),
    index("price_bars_symbol_tf_ts_idx").on(t.symbol, t.timeframe, t.ts),
    index("price_bars_as_of_idx").on(t.asOf),
  ],
);
```

### 💡 What is a Price Bar (OHLCV)?

A price bar represents a period of trading:

```
           High ($152)
             │
             │   ┌── Close ($150)
             │   │
    Open ────┤   │
   ($148)    │   │
             │   │
             │   │
           Low ($146)

    Volume: 5,000,000 shares traded
```

- **Open** — the price when the period started
- **High** — the highest price during the period
- **Low** — the lowest price during the period
- **Close** — the price when the period ended
- **Volume** — how many shares were traded

### 💡 `ts` vs `as_of` — The Critical Distinction

This is the most important concept in the entire codebase:

```
Timeline:
Jan 5                              Jan 5 4:00 PM ET
|──────── Market Open ─────────────|──── Market Close
           ts = Jan 5 00:00Z             as_of = Jan 5 21:00Z

"What date is this bar ABOUT?"     "When could we FIRST KNOW this bar?"
```

- **`ts`** = the bar's "subject date" (what it's about)
- **`as_of`** = when this data became available to the world

**Why does this matter?** For backtesting. If your backtest is simulating January 4th, it must NOT look at January 5th's bar — because on January 4th, that bar didn't exist yet. The `as_of` column makes this rule enforceable with a simple `WHERE as_of <= decision_ts`.

### 💡 Why `numeric` instead of `float`?

```typescript
open: numeric("open").notNull(),  // ✅ CORRECT
// open: real("open").notNull(),  // ❌ WRONG — floating point
```

Floating-point numbers (`float`/`real`/`double`) can't represent all decimal numbers exactly:
```
0.1 + 0.2 = 0.30000000000000004   // in floating point
0.1 + 0.2 = 0.3                    // in numeric/decimal
```

For money, you MUST use `numeric` (also called `decimal`) because rounding errors in financial calculations are unacceptable. A $0.01 rounding error on millions of transactions adds up to real money.

### 💡 What are Indexes?

```typescript
index("price_bars_as_of_idx").on(t.asOf),
```

An index is like the index at the back of a textbook. Without it, finding "all bars where `as_of <= '2024-01-05'`" requires scanning every row in the table (slow). With an index, Postgres can jump directly to the relevant rows (fast).

The three indexes here optimize three common query patterns:
1. `(symbol, timeframe, ts)` — "Give me all daily AAPL bars" (also the unique constraint)
2. `as_of` — "Give me all bars knowable before this timestamp" (point-in-time queries)

### `indicatorSnapshots` Table

```typescript
export const indicatorSnapshots = pgTable(
  "indicator_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    timeframe: timeframeEnum("timeframe").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    indicators: jsonb("indicators").$type<IndicatorValues>().notNull(),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("indicator_snapshots_symbol_tf_ts_uq").on(t.symbol, t.timeframe, t.ts),
    index("indicator_snapshots_symbol_tf_ts_idx").on(t.symbol, t.timeframe, t.ts),
    index("indicator_snapshots_as_of_idx").on(t.asOf),
  ],
);
```

This stores **computed technical indicators** (RSI, MACD, Bollinger Bands, etc.) for each bar. The `indicators` column uses **jsonb** — a JSON column that Postgres can index and query efficiently:

```typescript
export type IndicatorValues = {
  rsi: number | null;        // Relative Strength Index
  macd: number | null;       // MACD line value
  macdSignal: number | null; // MACD signal line
  bbUpper: number | null;    // Bollinger upper band
  bbLower: number | null;    // Bollinger lower band
  sma20: number | null;      // 20-day Simple Moving Average
  sma50: number | null;      // 50-day Simple Moving Average
};
```

Values can be `null` because indicators need a **warm-up period** (e.g., RSI needs 14 bars of data before it can produce its first value).

## The Agent Tables

### [src/schema/agents.ts](../../packages/db/src/schema/agents.ts)

### `agentRuns` Table

```typescript
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    timeframe: timeframeEnum("timeframe").notNull(),
    decisionTs: timestamp("decision_ts", { withTimezone: true }).notNull(),
    status: runStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("agent_runs_decision_ts_idx").on(t.decisionTs)],
);
```

An `agent_run` represents one execution of the committee. Think of it as a **meeting record**: "On this date, we asked the committee to analyze AAPL. The meeting started at X, ended at Y, and the status was completed/failed."

**`decisionTs` is THE point-in-time boundary.** This is the clock the entire pipeline reads against. Every query downstream filters `WHERE as_of <= decision_ts`. If `decisionTs` is January 5th at noon, no agent can see data that became available after January 5th at noon.

### `agentOutputs` Table

```typescript
export const agentOutputs = pgTable(
  "agent_outputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    agent: agentNameEnum("agent").notNull(),
    direction: directionEnum("direction").notNull(),
    confidence: numeric("confidence").notNull(),
    rationale: text("rationale").notNull(),
    raw: jsonb("raw").$type<AgentOutputPayload>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_outputs_run_id_idx").on(t.runId)],
);
```

Each row is one agent's opinion within a run. Multiple agents produce multiple rows for the same `runId`:

```
agent_runs (id = "run-123")
  └── agent_outputs (runId = "run-123", agent = "technical", direction = "bullish")
  └── agent_outputs (runId = "run-123", agent = "sentiment", direction = "bearish")
  └── agent_outputs (runId = "run-123", agent = "fundamental", direction = "neutral")
```

## The Database Client

### [src/client.ts](../../packages/db/src/client.ts)

The client is **lazily initialized** using JavaScript Proxies:

```typescript
export const db: DrizzleDb;   // only connects when you ACTUALLY USE it
export const sql: SqlClient;
```

### 💡 What is Lazy Initialization?

Normally, when you `import { db } from "@committee/db"`, the connection would open immediately. But what if you just want to check the table shapes? Or what if the database isn't running yet?

**Lazy initialization** means: "I'll create the connection the first time someone actually tries to use it, not when the file is imported." This is done using a JavaScript `Proxy` — an object that intercepts property access and can do custom logic.

**Why?** So the API can boot and the `/health` endpoint can answer "ok" even before Postgres is running. Tests can import the schema shapes without needing a database.

## The Migration

### [migrations/0000_ancient_rictor.sql](../../packages/db/migrations/0000_ancient_rictor.sql)

This single SQL file creates everything from scratch:

```sql
-- Enable extensions first
CREATE EXTENSION IF NOT EXISTS vector;    -- for future memory embeddings
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

-- Create enum types
CREATE TYPE "public"."timeframe" AS ENUM('1Day', '1Hour');
CREATE TYPE "public"."direction" AS ENUM('bullish', 'bearish', 'neutral');
-- ... then all CREATE TABLE statements ...
-- ... then all foreign keys and indexes ...
```

Running `pnpm db:migrate` applies this migration to a fresh database.

## The Seed Script

### [src/seed.ts](../../packages/db/src/seed.ts)

The seed creates demo data for development:
- One user: `demo@committee.local` with password `committee`
- Three watchlist items: `AAPL`, `MSFT`, `SPY`

It's **idempotent** — running it twice doesn't create duplicates (uses `onConflictDoNothing`).

## Summary: What Spec 01 Gives the Team

After Spec 01 is done, every other team member can:
- Import table types: `import { priceBars, users } from "@committee/db/schema"`
- Run migrations to create a fresh database
- Seed it with demo data
- Trust that `as_of` and `decision_ts` columns exist and are indexed

---

# Chapter 2: Spec 02 — Shared Contracts (Zod Schemas)

> **Owner**: M1 (Agent Architecture Lead)
> **Layer**: Cross-cutting
> **Purpose**: The single source of truth for validated data shapes
> **Unblocks**: Specs 06, 07, 08

## Why This Exists

Imagine four people building different parts of a house. If they don't agree on the door frame dimensions, the door won't fit. **Contracts** are the agreed-upon dimensions.

In code, a "contract" is a **data shape** that everyone agrees on. When the API sends an `AgentOutput`, the frontend knows exactly what fields to expect. When an LLM returns text, it gets validated against the same shape. One definition, used everywhere.

## Prerequisites: What is Zod?

**Zod** is a TypeScript-first schema validation library. It does two things:

1. **Defines shapes** — "An `AgentOutput` has a `direction` that's one of `bullish/bearish/neutral`, a `confidence` between 0 and 1, and a `rationale` string"
2. **Validates data at runtime** — "This JSON blob claims to be an `AgentOutput`. Let me check... yes it is" or "Nope, `confidence` is 1.5, that's out of range"

```typescript
// Define the shape
const AgentOutput = z.object({
  direction: z.enum(["bullish", "bearish", "neutral"]),
  confidence: z.number().min(0).max(1),
});

// Validate data
AgentOutput.parse({ direction: "bullish", confidence: 0.8 });  // ✅ returns the object
AgentOutput.parse({ direction: "sideways", confidence: 1.5 }); // ❌ throws ZodError
```

**Why not just use TypeScript types?** TypeScript types are erased at runtime. After compilation, they vanish. Zod schemas exist at runtime and can actually check incoming data (like an API response or LLM output).

## The Package Structure

```
packages/contracts/
├── src/
│   ├── index.ts        ← barrel export (re-exports everything)
│   ├── enums.ts        ← Direction, AgentName, Timeframe
│   ├── signals.ts      ← PriceBar, IndicatorSnapshot
│   ├── agents.ts       ← AgentInput, AgentOutput, JSON Schema
│   └── portfolio.ts    ← PortfolioState
└── tests/
    ├── agents.test.ts     ← validation tests
    ├── jsonschema.test.ts ← JSON Schema parity
    └── types.test.ts      ← compile-time type checks
```

## The Enums

### [src/enums.ts](../../packages/contracts/src/enums.ts)

```typescript
import { z } from "zod";

export const Direction = z.enum(["bullish", "bearish", "neutral"]);
export type Direction = z.infer<typeof Direction>;

export const AgentName = z.enum(["technical", "sentiment", "fundamental"]);
export type AgentName = z.infer<typeof AgentName>;

export const Timeframe = z.enum(["1Day", "1Hour"]);
export type Timeframe = z.infer<typeof Timeframe>;
```

### 💡 The Dual Export Pattern: Value + Type

Notice this pattern:
```typescript
export const Direction = z.enum(["bullish", "bearish", "neutral"]);  // VALUE (runtime)
export type Direction = z.infer<typeof Direction>;                    // TYPE (compile-time)
```

In TypeScript, a `const` and a `type` with the same name can coexist! The `const` is the Zod schema object (used at runtime for validation). The `type` is the inferred TypeScript type (used at compile-time for type checking). This way:

```typescript
// At compile time, TypeScript knows `d` is "bullish" | "bearish" | "neutral"
const d: Direction = "bullish";  // ✅
const d: Direction = "sideways"; // ❌ compile error

// At runtime, Zod validates unknown data
Direction.parse("bullish");      // ✅ returns "bullish"
Direction.parse("sideways");     // ❌ throws ZodError
```

## The Signal Schemas

### [src/signals.ts](../../packages/contracts/src/signals.ts)

### `PriceBar` Schema

```typescript
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
```

This mirrors `packages/db`'s `priceBars` table exactly. Field names use **camelCase** (`asOf`) at the contract boundary, matching the JSON convention. The database uses **snake_case** (`as_of`), matching the SQL convention.

**`z.string().datetime()`** — validates that the string is a valid ISO-8601 datetime (like `"2024-01-05T21:00:00.000Z"`). Timestamps are strings at the contract boundary (JSON-safe across the TypeScript ↔ Python seam). Each service converts to `Date` or `timestamptz` internally.

### `IndicatorSnapshot` Schema

```typescript
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
```

**`.nullable()`** means the value can be `null` OR a number. This handles the warm-up period — the first 13 bars can't have an RSI value (it needs 14 bars of history), so those snapshots have `rsi: null`.

## The Agent Schemas

### [src/agents.ts](../../packages/contracts/src/agents.ts)

### `CONTRACTS_VERSION`

```typescript
export const CONTRACTS_VERSION = "1.0.0";
```

A semver version string. **Any breaking change to `AgentInput` or `AgentOutput` requires bumping this.** This is the "contract-change protocol" — editing these schemas is a cross-team event because it affects everyone.

### `AgentInput` — What the Orchestrator Gives an Agent

```typescript
export const AgentInput = z.object({
  runId: z.string().uuid(),
  symbol: z.string(),
  timeframe: Timeframe,
  decisionTs: z.string().datetime(),
  bars: z.array(PriceBar),
  indicators: IndicatorSnapshot.nullable(),
  memory: z.unknown().optional(),
});
```

Think of this as the **briefing packet** handed to each analyst before a meeting:

| Field | What It Is | Analogy |
|-------|-----------|---------|
| `runId` | UUID identifying this committee meeting | Meeting number |
| `symbol` | Which stock to analyze (e.g., "AAPL") | The case file |
| `timeframe` | Daily or hourly bars | Resolution of the data |
| `decisionTs` | The point-in-time boundary | "You can only reference facts up to this moment" |
| `bars` | Array of price bars (all with `asOf <= decisionTs`) | The price history binder |
| `indicators` | The computed technical indicators (or null) | The analyst's spreadsheet |
| `memory` | Agent memory from past runs (Sprint 3) | Past meeting notes |

**`z.string().uuid()`** — validates the string is a valid UUID format.
**`z.array(PriceBar)`** — an array where every element must be a valid `PriceBar`.
**`z.unknown().optional()`** — any type, and the field can be omitted entirely. This is a placeholder for Sprint 3's memory system.

### `AgentOutput` — What Every Agent MUST Return

```typescript
export const AgentOutput = z.object({
  agent: AgentName,
  direction: Direction,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(2000),
  evidence: z
    .record(z.string(), z.union([z.number(), z.string(), z.boolean()]))
    .default({}),
});
```

This is the **verdict form** each analyst fills out:

| Field | Constraints | Purpose |
|-------|------------|---------|
| `agent` | Must be "technical", "sentiment", or "fundamental" | Who wrote this? |
| `direction` | Must be "bullish", "bearish", or "neutral" | What's your stance? |
| `confidence` | Number between 0.0 and 1.0 | How sure are you? |
| `rationale` | 1–2000 characters | Explain your reasoning |
| `evidence` | Key-value pairs of facts | Show your work |

**Why bound `rationale` to 2000 chars?** A runaway LLM could generate pages of text, bloating database storage. The max length is a guardrail.

**`evidence`** is the **anti-hallucination hook**:

```typescript
evidence: z
  .record(z.string(), z.union([z.number(), z.string(), z.boolean()]))
  .default({})
```

- `z.record(keyType, valueType)` = a dictionary/map where keys are strings and values are numbers, strings, or booleans
- `.default({})` = if the field is omitted, default to an empty object

**Example evidence:**
```json
{
  "rsi": 28.5,
  "macd": -0.42,
  "sma20": 189.50,
  "rule": "rsi_oversold+macd_bearish_cross",
  "aboveSma50": false
}
```

A reviewer can look at this and verify: "The agent said RSI is oversold. The evidence shows RSI = 28.5. That's indeed below 30. ✅"

### `AgentOutputJsonSchema` — For LLM Structured Output

```typescript
export const AgentOutputJsonSchema = zodToJsonSchema(AgentOutput, "AgentOutput");
```

This converts the Zod schema into **JSON Schema** format (a standard that many tools understand). The technical agent uses this to tell Claude: "Return your answer in EXACTLY this JSON shape." This is how the LLM is constrained to produce valid, parseable output instead of free-form text.

## The Portfolio Schema

### [src/portfolio.ts](../../packages/contracts/src/portfolio.ts)

```typescript
export const PortfolioState = z.object({
  cash: z.number(),
  equity: z.number(),
  positions: z.array(
    z.object({
      symbol: z.string(),
      qty: z.number(),
      marketValue: z.number(),
      unrealizedPl: z.number(),
    }),
  ),
  asOf: z.string().datetime(),
});
```

A snapshot of the trading account:

| Field | Example | Meaning |
|-------|---------|---------|
| `cash` | 75,000.00 | Unallocated money |
| `equity` | 100,000.00 | Total account value (cash + positions) |
| `positions[0].symbol` | "AAPL" | Stock ticker |
| `positions[0].qty` | 50 | Number of shares |
| `positions[0].marketValue` | 9,500.00 | Current value of those shares |
| `positions[0].unrealizedPl` | 320.00 | Profit/loss if sold now |
| `asOf` | "2024-01-05T21:00:00Z" | When this snapshot was taken |

> [!IMPORTANT]
> **Notice what's MISSING**: There's no aggregate `unrealizedPl` at the top level! The spec requires a P&L tile on the dashboard, but the contract only has per-position P&L. The frontend **refuses to sum these** (that would violate Law 2: Facts vs. Narration). Instead, it shows "Not reported" — the fix is a server-side computed field in Sprint 3.

## The Barrel Export

### [src/index.ts](../../packages/contracts/src/index.ts)

```typescript
export * from "./enums";
export * from "./signals";
export * from "./agents";
export * from "./portfolio";

// ---------------------------------------------------------------------------
// PLACEHOLDER — Sprint 2 (L3 Consensus / L4 Risk). DO NOT implement here yet.
// ---------------------------------------------------------------------------
// When debate/consensus and risk features land, their Zod schemas live here:
//   src/debate.ts   — DebateTranscript, ConsensusResult
//   src/risk.ts     — RiskAssessment, RiskRuleResult
// ---------------------------------------------------------------------------
```

A **barrel export** re-exports everything from one place. Instead of:
```typescript
import { Direction } from "@committee/contracts/enums";
import { AgentOutput } from "@committee/contracts/agents";
```
You can do:
```typescript
import { Direction, AgentOutput } from "@committee/contracts";
```

The placeholder comment shows where Sprint 2 schemas will go — the extension point is already planned.

## The Tests

### [tests/agents.test.ts](../../packages/contracts/tests/agents.test.ts)

The tests verify the schemas reject bad data:

```typescript
it("rejects confidence above 1", () => {
  expect(() => AgentOutput.parse({ ...validOutput, confidence: 1.5 })).toThrow();
});

it("rejects an empty rationale", () => {
  expect(() => AgentOutput.parse({ ...validOutput, rationale: "" })).toThrow();
});

it("rejects an unknown direction enum", () => {
  expect(() => AgentOutput.parse({ ...validOutput, direction: "sideways" })).toThrow();
});
```

### [tests/types.test.ts](../../packages/contracts/tests/types.test.ts) — The Compile-Time Guard

```typescript
interface AgentOutputInsert {
  agent: AgentName;
  direction: Direction;
  confidence: number;
  rationale: string;
  evidence: Record<string, number | string | boolean>;
}

it("AgentOutput is assignable to the spec-01 agent_outputs insert type", () => {
  const out: AgentOutput = { /* ... */ };
  const insert: AgentOutputInsert = out; // ← COMPILE CHECK
  expectAssignable<AgentOutputInsert>(out);
});
```

This is a **compile-time guard**: if the `AgentOutput` type ever drifts from the database insert type, this test won't compile. It catches contract drift without needing a running database.

## Summary: What Spec 02 Gives the Team

After Spec 02, every team member has:
- **Validated schemas** for all shared data shapes
- **Inferred TypeScript types** for compile-time checking
- **JSON Schema** for LLM structured output
- **A clear protocol** for changing contracts (bump version, notify owners)
- **19 passing tests** proving the schemas accept good data and reject bad data

---

> **Continue to [Part 2](./masterclass-part2.md) for Specs 03–05 (Auth, Market Data Ingestion, Technical Indicator Engine)**
