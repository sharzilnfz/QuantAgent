# Tech Stack Simplification Proposal

> Date: 2026-08-07
> Status: Proposal — not yet implemented
> Scope: Monorepo-wide analysis of "The Committee" (QuantAgent)

## 1. Current stack

A pnpm monorepo with **2 languages, 4 runtimes, 4 processes, 5 workspace packages**:

| Service | Tech | LOC |
|---|---|---|
| `apps/web` | React 18 + Vite + Tailwind + TanStack Query + React Router 7 + Recharts | ~2,190 |
| `apps/api` | Fastify 5 + Drizzle ORM + postgres.js + Zod + Anthropic SDK | ~3,670 |
| `apps/quant` | Python FastAPI + pandas/numpy + psycopg + pydantic | ~1,070 |
| `packages/contracts` | Shared Zod schemas (api ↔ web) | shared |
| `packages/db` | Drizzle schema/migrations/client (api only) | shared |

Assessment: the code itself is genuinely healthy — well-documented, contract-validated
boundaries, real tests. **The friction is in unification, not code quality.**

## 2. The 3 biggest simplification wins

### 2.1 Eliminate the Python `apps/quant` service (the standout opportunity)

- ~1,070 LOC exposing **2 endpoints** (`GET /health`, `POST /indicators/compute`),
  running its own runtime, Dockerfile, pip env, and pytest suite.
- It is **not wired into the pipeline**: `QUANT_SERVICE_URL` is read in
  `apps/api/src/config.ts:23` but never consumed by any API code; the API reads
  `indicator_snapshots` from Postgres directly
  (`apps/api/src/agents/technical/snapshots.ts`).
- The indicators (SMA/EMA/RSI/MACD/Bollinger) are hand-rolled pandas math —
  ~150 lines that ports trivially to TypeScript with zero numeric dependencies.
- `httpx` in `requirements.txt` is declared but never imported (dead dependency).
- The `backtest/` package has no HTTP route and no caller outside tests (latent
  Sprint-3 seam).
- Python mirrors `contracts` shapes in pydantic (`apps/quant/app/models.py`),
  and drift is only caught at runtime by TS validation.

**Move:** fold the indicator engine into `apps/api` as a typed module (or
`packages/indicators`). Result: one less language, one less Docker build, one test
runner (vitest instead of vitest + pytest), no drifting pydantic mirror.

### 2.2 Unify all five packages → three

- Keep `packages/contracts` + `packages/db` (genuinely valuable, genuinely shared).
- Drop the separate quant app → the pipeline becomes **one backend app**:
  `apps/api` = ingest → indicators → agents → auth → portfolio.
- Target structure: `apps/web` + `apps/api` (packages: `contracts`, `db`).
  Everything TypeScript, one `pnpm`, one `vitest`, one lint, one `tsconfig`.

### 2.3 Keep the API/frontend split (don't rush into Next.js)

Merging web + api into Next.js is the maximal "unify" move, but it is **not
recommended now**: this is a cookie-session SPA with client-rendered dashboards;
Next.js App Router would add SSR/RSC complexity and migration cost with no payoff
at this size. The 2-app model is the sweet spot — keep it unless full-stack SSR
becomes a real need.

## 3. Other simplification wins (cheap)

| Issue | Fix |
|---|---|
| `httpx` never imported (`apps/quant/requirements.txt`) | removed with §2.1 |
| `@committee/contracts` is an unused devDependency of `packages/db` (`packages/db/package.json:23`) | remove it |
| `QUANT_SERVICE_URL`, `.env` docs, `docs/masterclass/masterclass-part2.md` `/indicators` docs all stale | delete/update |
| Two competing lazy-DB patterns — `apps/api/src/auth/db.ts` `getDb()` vs inline `await import("@committee/db")` in `ingest/store.ts`, `agents/persistence.ts`, `agents/technical/snapshots.ts` — while `packages/db/src/client.ts` Proxy is already import-safe | collapse to static `import { db }` |
| Hand-rolled per-route `schema.safeParse` + manual 400 responses (Fastify 5 supports type-providers) | use a `ZodTypeProvider` / one validation plugin |
| Redundant `if (!request.user) return 401` after `requireAuth` in 5 handlers | delete; guard already fails closed |
| No `lint` target exists anywhere (root `pnpm lint` silently does nothing); no Prettier; per-app vitest configs | add root eslint + prettier configs, single shared test config |
| `backtest/` package with no route or caller | ship it behind an endpoint or delete until Sprint 2/3 |
| `tsconfig.base.json` sets `declaration`/`sourceMap` but every package overrides `noEmit: true` | clean up dead config |
| Triplicated tone logic + copy-pasted inline SVG icons in `apps/web` (3 files) | extract one shared helper / `components/ui/icons.tsx` |
| Unused UI surface: `Field.error` prop, `CardHeader.id` prop | remove or wire up |

## 4. Target state

```
pnpm monorepo — one language (TypeScript), one package manager
├── apps/web      Vite + React SPA (unchanged)
├── apps/api      Fastify + Drizzle — ingest, indicators, agents, auth, portfolio
└── packages/contracts, packages/db (keep)
docker-compose: postgres + api + web   (was postgres + quant + api + web)
```

**Net effect:** 1 language × 1 workflow × 1 test runner × 3 processes, instead of
2 languages / 2 runtimes / 2 test frameworks / 4 processes — with zero behavior
change and ~2,000 lines of Python removed. The math loss is negligible:
algorithmic fidelity for SMA/RSI/MACD/Bollinger in TypeScript is identical.

## 5. Open question

**Is the Python quant component a deliberate talent/constraint choice?** If a
teammate is a pandas/numpy specialist, folding it to TypeScript trades that for
single-stack simplicity. Otherwise, the fold is the recommended path.

Next step: prototype the TypeScript indicator port to validate numeric parity
before committing to the migration.
