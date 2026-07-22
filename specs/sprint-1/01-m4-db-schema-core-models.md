# 01 — Database Schema & Core Models (M4, L0)

> The Postgres schema, Drizzle models, migrations, and seed data for the whole system, with
> **point-in-time (`as_of`) fields present from the first commit**. Everything else in the project
> reads and writes through these tables.
> PRD user stories: #1, #4, #7, #12, #35, #43, #44.

## 1. Context & Goal

This is the foundation spec — it unblocks every other Sprint 1 task. The single most important design
constraint is **point-in-time integrity**: retrofitting `as_of` timestamps later is far more expensive
than building them in now, and the project's core evaluation claim depends on them. Get the fact-table
timestamps and the decision-window reference right and the rest of the system can trust the data.

"Done" means: `packages/db` exposes typed Drizzle models + a migration that stands up a fresh Postgres
16 (+`pgvector`) instance, a seed script populates a demo user and watchlist, and the schema already has
columns for tables later sprints fill (they can be created empty now or deferred — see Scope).

## 2. Scope

**In scope**
- Drizzle schema in `packages/db/src/schema/` for the **Sprint 1 + near-term** tables (below).
- Migration tooling (`drizzle-kit`), a `migrate` script, and a `seed` script (one demo user, a small
  watchlist e.g. AAPL/MSFT/SPY).
- Enable the `pgvector` and `pgcrypto` extensions in the first migration.
- A tiny typed DB client (`packages/db/src/client.ts`) other packages import.
- `as_of` + decision-window columns and their indexes on all fact/decision tables.

**Non-goals**
- No business logic, no API routes (spec 03/04 own those).
- No encryption *implementation* — spec 03 owns credential crypto; you provide the `alpaca_credentials`
  table shape (ciphertext columns) only.
- Tables for later sprints (`debate_*`, `risk_decisions`, `allocations`, `orders`, `memory_*`,
  `reflections`, `reports`) may be **stubbed as empty schema files with a TODO** or deferred — but the
  `agent_runs`/`agent_outputs`/`price_bars`/`indicator_snapshots` tables **must** be complete now.

## 3. Dependencies

- Postgres 16 with `pgvector` available (Docker Compose service — coordinate the connection string via
  `DATABASE_URL` env). None of the other specs; this one goes first.

## 4. Interface & Contracts

Package: `packages/db`. Export typed models + `db` client and re-export inferred row types.

**Core tables (must ship complete this sprint):**

- `users` — `id` (uuid pk), `email` (unique), `password_hash`, `created_at`.
- `sessions` — `id`, `user_id` fk, `expires_at`, `created_at`. (spec 03 uses this.)
- `alpaca_credentials` — `user_id` fk, `key_ciphertext`, `secret_ciphertext`, `iv`, `auth_tag`,
  `created_at`. **Ciphertext only — never a plaintext column.** (spec 03 fills it.)
- `watchlist_items` — `id`, `user_id` fk, `symbol`, `created_at`, unique(`user_id`,`symbol`).
- `price_bars` — `id`, `symbol`, `timeframe` (enum: `1Day`/`1Hour`), `ts` (bar open time), `open`,
  `high`, `low`, `close`, `volume` (numeric), **`as_of`** (when this bar became knowable), `source`,
  `created_at`. Unique(`symbol`,`timeframe`,`ts`). Index on (`symbol`,`timeframe`,`ts`) and on `as_of`.
- `indicator_snapshots` — `id`, `symbol`, `timeframe`, `ts`, `indicators` (jsonb: `{rsi, macd, macd_signal, bb_upper, bb_lower, sma_20, sma_50, ...}`), **`as_of`**, `created_at`. Unique(`symbol`,`timeframe`,`ts`).
- `agent_runs` — `id` (uuid, the replayable run id), `symbol`, `timeframe`, **`decision_ts`** (the
  point-in-time boundary: no input with `as_of > decision_ts` is legal), `status` (enum:
  `running`/`completed`/`failed`), `started_at`, `finished_at`.
- `agent_outputs` — `id`, `run_id` fk, `agent` (enum: `technical`/`sentiment`/`fundamental`),
  `direction` (enum: `bullish`/`bearish`/`neutral`), `confidence` (numeric 0–1), `rationale` (text),
  `raw` (jsonb, the validated schema payload), `created_at`. The shape mirrors the Zod `AgentOutput`
  in spec 02 — keep them in lockstep.

**Numeric discipline:** money/price columns are Postgres `numeric`, not float. Timestamps are
`timestamptz`.

**Client contract:**
```ts
// packages/db/src/client.ts
export const db: DrizzleDb;            // configured from DATABASE_URL
export * from "./schema";              // tables + inferred Row / Insert types
```

## 5. Implementation notes

- `as_of` vs `ts`: `ts` is *when the bar/indicator is about* (market time); `as_of` is *when we could
  first have known it*. For daily bars, `as_of` is typically the bar's close/session-end, not its open.
  Spec 04 sets `as_of` on write; you just provide and index the column and document the rule here.
- The **decision-window contract**: `agent_runs.decision_ts` is the clock the whole pipeline reads
  against. Every downstream query filters `WHERE as_of <= :decision_ts`. Make this cheap with the
  `as_of` indexes.
- Use `drizzle-kit generate` for migrations; commit the SQL. First migration enables extensions:
  `CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto;`.
- Keep enums as Postgres enums or `text` + Drizzle enum — pick one and be consistent.

## 6. Acceptance criteria

- [ ] `pnpm --filter @committee/db migrate` stands up all core tables on a fresh Postgres from zero.
- [ ] `pgvector` and `pgcrypto` extensions enabled by migration.
- [ ] `seed` script creates one demo user + a 3-symbol watchlist and is idempotent.
- [ ] Every fact table (`price_bars`, `indicator_snapshots`) has an indexed `as_of timestamptz NOT NULL`.
- [ ] `agent_runs.decision_ts` exists and is documented as the point-in-time boundary.
- [ ] Money/price columns are `numeric`; all timestamps are `timestamptz`.
- [ ] `alpaca_credentials` has ciphertext columns only — no plaintext key/secret column exists.
- [ ] Other packages can `import { db, priceBars } from "@committee/db"` and get full types.

## 7. Tests

- Migration round-trip test: run migrate on an ephemeral DB (testcontainers or a scratch schema),
  assert all core tables + indexes + extensions exist.
- A schema constraint test: inserting a `price_bars` row without `as_of` fails (NOT NULL); duplicate
  (`symbol`,`timeframe`,`ts`) fails (unique).
- Seed idempotency test: running seed twice does not duplicate the demo user.

## 8. Files & Definition of Done

- `packages/db/`: `drizzle.config.ts`, `src/schema/*.ts`, `src/client.ts`, `src/seed.ts`,
  `migrations/*.sql`, `package.json`, `tests/`.
- **DoD:** migrate + seed run clean on a fresh container, tests green, types exported and importable by
  `apps/api`. No plaintext secret columns. `as_of`/`decision_ts` present and indexed. Merged to a
  feature branch off `main` per the Git workflow doc.
