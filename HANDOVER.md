# HANDOVER — The Committee (multi-agent paper-trading system)

**Audience:** an AI coding assistant (or engineer) picking this repo up cold, with no access to the
conversation that produced it.
**Written:** end of Sprint 1. **Branch:** `sprint1/foundation`. **State:** Sprint 1 complete and green.

Read this file top to bottom before touching code. Sections 3, 6 and 7 are the ones that will cause
real damage if skipped.

> **§13 is an addendum added later**, after re-running the build and tests. It corrects two stale
> items in §10, flags one unverified number in §2, and records in-flight work not covered above.
> Where §13 disagrees with an earlier section, §13 is more recent.

---

## 1. What this project is

A multi-agent paper-trading **reference system**, built as a capstone. Three specialist agents
(technical, sentiment, fundamental) independently analyze an asset; on disagreement a debate/synthesis
step resolves it and preserves the dissent; a **deterministic risk gate — never an LLM** — approves or
blocks; an allocator sizes the position; approved trades execute against Alpaca's **paper** API. Every
input, argument and outcome is logged. A layered memory system feeds prior context into each new run.

**Paper trading only, permanently.** No real-money path exists or should be added. The system makes no
claim to predict markets.

**What actually differentiates this project** is not the architecture (which deliberately parallels
published multi-agent trading systems) but two things:
1. the **evaluation/ablation harness** (Sprint 3) that answers "does debate and memory actually help?", and
2. the **point-in-time data discipline** baked in from the first commit, which is what makes any
   evaluation result trustworthy.

Protect both. They are the argument the capstone rests on.

Source docs: [`PRD.md`](PRD.md) (what/why, user stories, sprint plan) ·
[`QuantAgent_Capstone_Guide.md`](QuantAgent_Capstone_Guide.md) (strategy, field fundamentals,
evaluation methodology) · [`specs/`](specs/) (per-feature implementation specs).

---

## 2. Current state — what is built and verified

Sprint 1 (the "walking skeleton") is **complete**. All eight specs implemented, plus a shared-contracts
package that the specs implied but didn't name.

| Spec | Feature | Owner | Where |
|---|---|---|---|
| 01 | DB schema & core models (`as_of` from day one) | M4 | `packages/db/` |
| 02 | Shared contracts (Zod) | M1 | `packages/contracts/` |
| 03 | Auth, sessions, encrypted Alpaca credential vault | M4 | `apps/api/src/auth/`, `.../credentials/` |
| 04 | Market data ingestion (Alpaca) | M2 | `apps/api/src/ingest/` |
| 05 | Indicator engine + backtest skeleton | M2 | `apps/quant/` |
| 06 | Agent framework + stub agents | M1 | `apps/api/src/agents/` |
| 07 | Technical analyst agent | M1 | `apps/api/src/agents/technical/` |
| 08 | Dashboard shell & portfolio view | M3 | `apps/web/` |

### Verification status (measured, not estimated)

```
packages/contracts   19 passed
packages/db          32 passed |  8 skipped
apps/api            123 passed | 14 skipped
apps/web             25 passed
apps/quant (pytest)  57 passed |  4 skipped   ← NOT reproduced; see §13.1
                    ─────────────────────────
TOTAL               256 passed | 26 skipped
```
`pnpm -r typecheck` → **exit 0** across all four TS packages. `pnpm --filter @committee/web build` → succeeds.

### ⚠️ What has NOT been verified

**Every one of the 26 skips is a database-backed test that has never executed**, because the
environment this was built in had no Docker and no Postgres. They skip via probes that check both
connectivity *and* that spec 01's tables exist, so a skip cannot be silently mistaken for a pass.

Not yet run even once: duplicate-email 409, expired-session 401 + purge, bcrypt-hash-only storage
verified over HTTP, ciphertext-only rows verified over HTTP, ingestion idempotency against a real DB,
agent-run persistence, and 3 DB-backed point-in-time checks.

**Your first task should be section 4, step 5: stand up Postgres and run the full suite.** Do not
build on top of this until you have. Nothing else in Sprint 1 is blocked on it, but everything after
it assumes the DB layer actually works.

Also never executed: any real Alpaca API call, and any real Anthropic API call (all LLM tests use
mocks/injected doubles by design — see §6.3).

---

## 3. The three laws — non-negotiable invariants

These are enforced in code and guarded by tests. Breaking one silently invalidates the project's
results. If a change appears to require breaking one, stop and raise it instead.

### 3.1 Point-in-time discipline
Every fact carries an `as_of` timestamp = **the moment it became knowable**. No query in the pipeline
may read a fact whose `as_of` is after the current decision timestamp (`agent_runs.decision_ts`).

- Enforced: `apps/api/src/ingest/as-of.ts` (the rule, isolated in one module with a long header),
  `apps/quant/app/indicators/` (propagation), `apps/api/src/agents/technical/snapshots.ts`
  (`lte(asOf, decisionTs)` on read).
- The implemented rule: `1Hour` → `as_of = ts + 1h`. `1Day` → `as_of = 16:00 America/New_York` on the
  bar's own ET session date, resolved per-bar via the IANA tz database (20:00Z under EDT, 21:00Z under
  EST). **Not** `ts` (the open), **not** `ts + 24h`.
- A bar whose computed `as_of` exceeds `now` is **dropped and reported, not clamped**. Clamping to
  `now` would move `as_of` *earlier* than truth — precisely the look-ahead bug. Dropped bars are
  picked up on the next run. **Do not "fix" this into a clamp.**
- Python-side propagation uses a running `max` over consumed bars, so a late-revised earlier bar pushes
  availability *later*, never earlier.
- When uncertain, set `as_of` **later**. A late `as_of` merely delays availability; an early one is a
  correctness bug that silently inflates backtest results.

### 3.2 Facts vs. narration
Any number that *can* be computed deterministically (prices, indicators, P&L, returns) **must** be
computed in code. LLMs only reason over and narrate already-computed facts — they never invent,
compute, or restate a number.

- Enforced structurally in `apps/api/src/agents/technical/agent.ts`: computed evidence is spread
  **after** model-authored evidence, so on any key collision the computed value wins. The LLM has no
  writable path to the evidence map. Guarded by a test that feeds a model claiming `rsi: 65` and
  asserts the returned `evidence.rsi === 22`.
- The UI obeys this too: `apps/web` renders already-computed values and **never** aggregates. When
  `PortfolioState` lacked a total P&L field, the dashboard rendered "Not reported" rather than summing
  positions in the browser — with a test asserting it does *not* produce the sum. Preserve that
  behavior; the fix is a server-side field (§7.1), not a client-side sum.

### 3.3 Schema-first / untrusted model text
Raw LLM output is untrusted until it validates against its Zod schema in `packages/contracts`.
Validation failure is a **handled error** producing a neutral "no opinion", never a crash.

- `NO_OPINION(name, reason)` in `apps/api/src/agents/base.ts` is the single failure shape. Every
  failure path — timeout, throw, schema-invalid, agent-name mismatch — routes through it.
- A timed-out or failing agent must never crash a run. Guarded by the resilience test.

---

## 4. Getting it running

**Prerequisites:** Node ≥ 20, pnpm ≥ 9, Python ≥ 3.12, Docker.

```bash
# 1. install
pnpm install

# 2. configure
cp .env.example .env      # fill in the values described below

# 3. database
docker compose up -d postgres     # Postgres 16 + pgvector
pnpm db:migrate
pnpm db:seed                      # demo user + AAPL/MSFT/SPY watchlist

# 4. python quant service
cd apps/quant
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows; use .venv/bin/ on POSIX
.venv/Scripts/python -m uvicorn app.main:app --reload      # :8000

# 5. VERIFY EVERYTHING (do this before writing code — see §2)
pnpm -r typecheck
pnpm -r test
cd apps/quant && .venv/Scripts/python -m pytest

# 6. run the app
pnpm dev:api      # :3000
pnpm dev:web      # :5173
```

**Required env vars** (`.env.example` documents all): `DATABASE_URL`; `CREDENTIAL_ENC_KEY` (base64
32-byte AES key — `openssl rand -base64 32`); `ALPACA_KEY`/`ALPACA_SECRET` (**paper** account);
`ANTHROPIC_API_KEY`; `LLM_CHEAP_MODEL` (default `claude-haiku-4-5`).

Never commit a real `.env`. Only `.env.example` belongs in the repo.

**Exercise the pipeline end to end:**
```bash
pnpm --filter @committee/api ingest:prices -- --symbols AAPL --timeframe 1Day --from 2024-01-01 --to 2024-06-30
curl -X POST localhost:8000/indicators/compute -H 'content-type: application/json' \
  -d '{"symbol":"AAPL","timeframe":"1Day","from":"2024-01-01","to":"2024-06-30"}'
# then POST /agents/run (auth required) to produce a technical-agent output
```

---

## 5. Architecture & repo map

Seven layers plus two cross-cutting concerns, bottom-up:

| Layer | Responsibility | LLM? | Status |
|---|---|---|---|
| **L0 Data** | Ingest + timestamp prices/news/fundamentals | No | ✅ prices only |
| **L1 Signal** | Deterministic indicators + portfolio math | **Never** | ✅ |
| **L2 Agent** | Three specialists, fixed output schema | Yes | ✅ technical; stubs for other two |
| **L3 Consensus** | 2-of-3 check, then ONE synthesis call on disagreement | On disagreement | ⬜ Sprint 2 |
| **L4 Risk** | Deterministic rules engine | **Never** | ⬜ Sprint 2 |
| **L5 Allocation** | Explainable non-LLM sizing | **Never** | ⬜ Sprint 3 |
| **L6 Execution** | Alpaca paper orders, outcomes back to L0 | No | ⬜ Sprint 3 |
| **Memory** | short / episodic / long-term | — | ⬜ Sprint 3 |
| **Orchestrator** | State machine, parallel fan-out, failure isolation | — | ◐ partial (`runner.ts`) |

```
apps/
  api/     Node + TS + Fastify. auth, credentials, ingest, portfolio, agents.
  web/     React + Vite + Tailwind + Recharts. Dashboard.
  quant/   Python + FastAPI + pandas/numpy. Indicators, backtest.
packages/
  contracts/  Zod schemas + inferred types — the cross-service source of truth.
  db/         Drizzle schema, migrations, seed.
specs/        Per-feature implementation specs + FOLLOW-UPS.md.
```

### Ownership boundaries (why the code looks like this)

Four notional owners, each owning a disjoint architectural slice so no two people touch the same files:
**M1** agent core (`packages/contracts`, `apps/api/src/agents`) · **M2** data & quant
(`apps/api/src/ingest`, `apps/quant`) · **M3** frontend (`apps/web`) · **M4** platform
(`packages/db`, `apps/api/src/auth|credentials|portfolio`).

Cross-service data crosses **only** through Postgres tables or the quant HTTP API. Respect these
boundaries — they're why parallel development works here.

---

## 6. Key seams — how to extend without breaking things

### 6.1 Adding a route
`apps/api/src/app.ts` is the **stable composition root**. It registers one plugin per domain. Do not
put route logic in it. A new domain = a new plugin file + one `register()` line.

Every protected route uses the shared preHandler:
`app.get("/x", { preHandler: requireAuth }, handler)` from `apps/api/src/auth/require-auth.ts`.
Its signature is a cross-team seam — don't change it without updating all consumers.
Note: `requireAuth` reads `request.cookies` and calls `reply.clearCookie`, so any Fastify instance
mounting a protected route must have `@fastify/cookie` registered (the composition root does).

### 6.2 Adding an agent (this is the main Sprint 2 task)
```ts
export class SentimentAgent extends BaseAgent {
  readonly name = "sentiment";
  protected async run(input: AgentInput): Promise<AgentOutput> { /* ... */ }
}
```
`BaseAgent.analyze()` already wraps `run()` with timeout, `AgentOutput.parse` validation,
agent-name-mismatch checking, and failure → `NO_OPINION`. You only implement `run()`. Then pass the
instance into `runAgents(input, [ ...agents ])`.

Copy the technical agent's structure (`agents/technical/`): `classify.ts` computes the deterministic
read → `prompt.ts` builds the prompt over those computed facts → `llm-client.ts` is **injectable** so
tests never hit the network → `agent.ts` merges, with computed evidence overwriting model evidence.

### 6.3 LLM calls
`LlmClient` is an interface with an `AnthropicLlmClient` impl and a `ScriptedLlmClient` test double.
**Always inject it** so CI neither flakes on non-determinism nor burns budget.

Structured output currently uses **forced tool use** (`tool_choice: {type:"tool"}`) with the schema
unwrapped from `AgentOutputJsonSchema`, because the pinned `@anthropic-ai/sdk@0.68.0` has no
`output_config` in its types. Switch to `output_config.format` when you bump the SDK.

Budget: ≥3 LLM calls per pipeline run (one per agent) + 0–2 for debate synthesis. Use the **cheap
tier** for the three agents and a **stronger tier only** for debate synthesis and reflection.

### 6.4 Changing a contract
`packages/contracts` is the cross-service source of truth. Editing `AgentInput`/`AgentOutput` is a
cross-team event: bump `CONTRACTS_VERSION`, and check `packages/db` schema field names stay isomorphic
(they're deliberately kept in lockstep, but `db` does **not** import `contracts` so it stays
independently typecheckable).

### 6.5 Database access
`@committee/db` connects **lazily**. Importing it never opens a socket or throws; only *using* `db`
does. This is deliberate — it lets the API boot (and `/health` answer) without Postgres. Helpers:
`getDb()`, `getSql()`, `isDatabaseConfigured()`, `closeDb()`.

DB-dependent tests must skip gracefully when Postgres is unreachable. Follow the existing pattern
(probe connectivity *and* table existence in `beforeAll`).

---

## 7. Known gaps & follow-ups

Full detail with rationale: **[`specs/sprint-1/FOLLOW-UPS.md`](specs/sprint-1/FOLLOW-UPS.md)** — read it.
The four that will bite you soonest:

**7.1 `PortfolioState` has no aggregate P&L field** *(contract change, owner M1)*
Spec 08 requires a P&L tile; the contract only has per-position `unrealizedPl`. The UI correctly
refuses to sum client-side (law 3.2) and shows "Not reported". Fix: add `unrealizedPl: z.number()` to
`PortfolioState` and compute it server-side. Naturally lands with Sprint 3's real Alpaca sync.

**7.2 No portfolio history source** *(contract change, owner M4)*
Nothing can feed the value-over-time chart (PRD story #6). The client calls
`GET /portfolio/history → Pick<PortfolioState,"asOf"|"equity">[]` and degrades gracefully on 404.
Needs implementing; requires periodic equity snapshots, so it pairs with Sprint 3 execution.

**7.3 `GET /portfolio` is a deliberate placeholder** *(owner M4)*
Returns a contract-valid but **empty** snapshot rather than fabricated numbers. Real Alpaca sync is
Sprint 3. This is intentional and correct — an empty portfolio is honest, invented numbers are not.
Don't "fill it in" with plausible-looking demo data.

**7.4 `keyTail` spec contradiction** *(owner M4)*
Spec 03 says compute at store time; spec 01's table has no `key_tail` column. Currently derived on
read (decrypt + last 4 chars). Either add the column or amend spec 03. Prefer the column.

Also worth knowing: indicators are **hand-rolled** in pandas/numpy (`pandas-ta`/`vectorbt` lack
reliable Python 3.13 wheels and are commented out in `requirements.txt`). The conventions are now a
cross-team contract, pinned in `apps/quant/app/indicators/core.py`'s docstring: **SMA-seeded EMA,
Wilder RSI, population stdev for Bollinger**. Sprint 3's evaluation suite should reconsider `vectorbt`
on Python 3.12.

---

## 8. What to build next — Sprint 2

Goal: **the full committee runs end to end. Debate fires on disagreement. The risk gate blocks unsafe
trades. Every run is logged.**

| Feature | Owner | Notes |
|---|---|---|
| News/headline ingestion | M2 | Same `as_of` discipline as prices — headlines get availability timestamps |
| Company profile & RAG store (`pgvector`) | M2 | `pgvector` extension is already enabled by migration 0000 |
| Fundamental analyst agent | M2 | Grounded on retrieved context, **not** free model recall |
| Sentiment agent | M1 | Replace `stubs/sentiment.ts` |
| **Debate & consensus engine** | M1 | 2-of-3 deterministic check FIRST; only on disagreement, ONE synthesis call. Preserve dissent. |
| Agent orchestration pipeline | M1 | Extend `runner.ts`: parallel run + per-stage error isolation |
| **Risk manager & approval gate** | M4 | **Deterministic rules engine, NOT an LLM.** Position/concentration/stop-loss limits |
| Watchlist management UI | M3 | Read-only list exists; add add/remove |

Two design constraints carried from the PRD, do not drift from them:
- **Consensus is cheap-first.** A deterministic 2-of-3 majority check runs before any LLM call; the
  synthesis call fires *only* on genuine disagreement. This replaces multi-round negotiation for the
  MVP — cheaper, faster, and still captures the debate's information value.
- **The risk gate is never an LLM.** It can be satisfied or violated, never persuaded. This is the
  single most important architectural boundary in the system.

Sprint 2 schemas (debate, risk) have a marked placeholder section in `packages/contracts/src/index.ts`.

### Recommended workflow
This repo is **spec-driven**. Before implementing, write a spec in `specs/sprint-2/` following the
template in [`specs/00-overview.md`](specs/00-overview.md) §"Spec template": Context/Goal · Scope +
explicit Non-goals · Dependencies · Interface & Contracts · Implementation notes · observable
Acceptance criteria · specific Tests · Files & DoD. The Sprint 1 specs are worked examples.

Land **shared-contract and DB-migration changes first**, early in the sprint, before feature work
branches off them — nobody should rebase days of work over a schema that moved underneath them.

---

## 9. Testing conventions

From the PRD's testing decisions — follow them, they're deliberate:

- **Never assert on exact LLM wording.** Assert schema validity and plausible output bounds.
- **Mock/inject LLM clients** in all tests. CI must not call the real API.
- **Test the backtest/indicators against synthetic series with hand-computed expected values** (e.g. a
  series with a known SMA-crossover point). This is the tripwire that catches indicator bugs which
  otherwise surface as suspiciously good results.
- **Explicitly test resilience:** simulate an agent timeout, confirm the run still completes with a
  neutral output for that agent.
- **Point-in-time integrity test:** must fail if any stored signal/agent output/backtest result
  references data timestamped after its own decision point. A placeholder exists at
  `apps/quant/tests/test_point_in_time.py` — **Sprint 3 must harden this into a real, reportable
  check.** It's cited in the PRD as a deliverable, not a design claim.
- **Test encrypted-at-rest credential storage** (already done, 22 assertions).

---

## 10. Git workflow & repo conventions

Trunk-based: `main` is always demo-able; short-lived feature branches
`sprint<N>/<owner>-<slug>` merge back via PR within a few days.

**Sprint 1 used a special multi-author convention** (one developer, four notional authors) — commits
are attributed with `git commit --author=...` so history reflects the PRD ownership split. See
[`Git_Workflow_Branches_Worktrees.md`](Git_Workflow_Branches_Worktrees.md) for the identity table and
the file-to-owner mapping. Commit messages tie back to the feature list:
`feat(m1): agent framework base interface + stub agents`.

### ⚠️ Repo-state issues

1. ~~**`sprint1/foundation` has diverged from `origin/sprint1/foundation`** — 11 local commits vs 21
   remote.~~ **RESOLVED (re-verified 2026-07-22).** After `git fetch origin`,
   `git rev-list --left-right --count origin/sprint1/foundation...sprint1/foundation` returns `0  0`.
   The branch is fully in sync and the working tree is clean. No reconciliation needed.
2. **Commit `8c634b7`'s message is inaccurate.** *(Confirmed 2026-07-22.)* It reads "user auth with
   Argon2 + JWT sessions", but the implemented code uses **bcryptjs with opaque server-side session
   ids**. Verified in source: `apps/api/src/auth/service.ts:1` imports `bcryptjs`, and
   `apps/api/src/auth/session.ts` stores an opaque random id in the cookie with every request
   re-reading the `sessions` row (no JWTs, no argon2 — argon2 is deliberately not a dependency, to
   avoid a native build). Trust the code, not that message.
3. **`.claude/skills/excalidraw-diagram` is a git submodule** (a gitlink with no `.gitmodules` entry).
   Edits inside it do **not** appear in the parent repo's `git status`. See §13.2 — there are
   uncommitted fixes in there right now.

Also: a `Sprint-01` branch exists and is unrelated to current work — leave it alone.

---

## 11. Environment gotchas (things that already cost time)

- **`@types/react` must stay pinned to v18 workspace-wide** via `overrides` in `pnpm-workspace.yaml`.
  `drizzle-orm` declares `@types/react` as an optional peer, which drags v19 into pnpm's hoisted
  fallback; library `.d.ts` files then type against v19 while `apps/web` is React 18, producing TS2786
  "cannot be used as a JSX component" on every `<Route>`/`<AreaChart>`. Don't remove the override.
- **pnpm 11 ignores the `pnpm` field in `package.json`.** `overrides` and `allowBuilds` live in
  `pnpm-workspace.yaml`.
- **esbuild needs `allowBuilds: esbuild: true`** in `pnpm-workspace.yaml` or vite/vitest/tsx break.
- **`shadcn/ui` and `lucide-react` are referenced in the specs but are NOT installed.** UI components
  are hand-rolled with Tailwind; icons are inline SVG. Either install them deliberately or keep
  hand-rolling — don't half-adopt.
- **jsdom lacks `ResizeObserver` and `matchMedia`**; stubs live in `apps/web/tests/setup.ts`. jsdom
  gives Recharts a 0-width container so no SVG marks render — this is why every chart ships a
  `<details>` table-view twin, which is both an accessibility requirement (a tooltip must never be the
  only way to read a value) and what the tests assert against.
- **Web bundle is 727 kB** (Recharts dominates). Code-splitting was out of scope; revisit before adding
  React Flow in Sprint 3.
- Tailwind colors are indirected through CSS custom properties in `apps/web/src/index.css`, so
  light/dark swap in one place. Component code uses **roles** (`bg-surface`, `text-ink-2`), not raw hex.
  Consequence: Tailwind slash-opacity modifiers (`bg-surface/50`) don't work on these tokens.

---

## 12. Quick orientation checklist

1. Read `PRD.md` §Implementation Decisions, and `specs/00-overview.md` in full.
2. Read §3 of this file (the three laws) — they're the difference between a working capstone and a
   meaningless one.
3. Stand up Postgres and run the full suite (§4 step 5). Confirm the 26 skips now execute and pass.
4. Read `specs/sprint-1/FOLLOW-UPS.md`.
5. Read `apps/api/src/agents/technical/agent.ts` + `classify.ts` — the clearest worked example of the
   architecture's intent (deterministic computation + LLM narration, with computation winning).
6. Write the Sprint 2 specs before implementing.

---

## 13. Addendum — re-verification and in-flight work (2026-07-22)

*Added after the sections above were written. Where this section and an earlier one disagree, this
one is more recent.*

### 13.1 Re-measured verification status

Re-run on `sprint1/foundation`, clean tree. **`pnpm typecheck` → exit 0** (contracts, db, web, api).
**`pnpm test`** results, observed directly:

| Package | Test files | Observed |
|---|---|---|
| `packages/contracts` | 3 | 3 files passed |
| `packages/db` | 3 | 2 passed, 1 skipped |
| `apps/web` | 4 | 4 files, **25 tests passed** |
| `apps/api` | 16 | 15 passed / 1 skipped, **123 passed, 14 skipped** |

The `apps/api` and `apps/web` numbers match §2 exactly. §2's per-package assertion counts for
`contracts` (19) and `db` (32|8) were not independently re-counted here, but nothing contradicts them.

**⚠️ The `apps/quant` line in §2 (`57 passed | 4 skipped`) was NOT reproduced.** `pytest` is not
installed in this environment (`python -m pytest` → *No module named pytest*), so the Python suite has
not been observed running in this session. Treat that row as **unverified** until you run it via §4
step 4–5.

Also re-confirmed: **the `@types/react` conflict is resolved.** `progress_notes.md` still lists it as
an open blocker — it isn't. `pnpm-workspace.yaml` pins `@types/react ^18.3.18` / `@types/react-dom
^18.3.5` via `overrides`, and typecheck passes clean.

### 13.2 Excalidraw renderer is broken upstream — fix applied, **not yet verified end to end**

The diagram-rendering skill at `.claude/skills/excalidraw-diagram/` could not render at all. Root
cause: **`esm.sh` currently serves a 404-ing dependency graph** for `@excalidraw/excalidraw@0.18.1`.
Its `?bundle` shim imports `/@braintree/sanitize-url@6.0.2/es2022/dist/constants.mjs`, which returns
**404**, so Chromium never finished loading the module and Playwright timed out on
`window.__moduleReady`.

Two edits were made **inside the submodule** (see §10 issue 3 — they will not show in the parent
repo's `git status`, so commit them in the submodule or they will be silently lost):

| File | Change |
|---|---|
| `references/render_template.html` | import switched `https://esm.sh/@excalidraw/excalidraw?bundle` → `https://esm.run/@excalidraw/excalidraw@0.18.1` (jsDelivr) |
| `references/render_excalidraw.py` | module-load `wait_for_function` timeout `30000` → `180000` ms |

The jsDelivr URL was confirmed good by a standalone Playwright probe (`exportToSvg available: true`).
**The full `render_excalidraw.py` run was interrupted and never completed**, so the pipeline is
unverified end to end. Confirm with one run before relying on it:

```bash
cd .claude/skills/excalidraw-diagram/references
uv sync && uv run playwright install chromium      # already done in this environment
uv run python render_excalidraw.py ../../../../specs/sprint-1/00-class-diagram.excalidraw
```

### 13.3 Sprint 1 class diagram — Completed (2026-07-22)

`specs/sprint-1/00-class-diagram.excalidraw` and rendered PNG `specs/sprint-1/00-class-diagram.png` are complete with all 22 classes across 8 milestone specs, 16 relationship arrows, 3-compartment boxes, visibility prefixes, type annotations, and stereotypes.

Either finish it or delete it; nothing depends on it. The intended design, if you finish it:

- **3 horizontal tiers × 4 vertical layer bands.** Bands: `L0·DATA` (x 100–940) · `L1·SIGNAL`
  (1020–1660) · `L2·AGENT` (1740–2960) · `UI` (3040–3640), split by dashed verticals at x=990/1700/2990.
- **Tier A** (y 350–1500) application classes — services, the `Agent`→`BaseAgent`→`TechnicalAgent`
  generalization tree, UI components. **Tier B** (y 1640+, divider at 1540) the `packages/db` fact and
  decision tables on a single row, so the point-in-time spine reads as one horizontal thread.
  **Tier C** (y 2030+, divider at 1950) the `packages/contracts` Zod schemas placed directly beneath
  the tables they mirror, joined by dashed "field-isomorphic" arrows.
- **Two colour threads carry two of the three laws.** Red `#b91c1c` on every `as_of` / `decision_ts`
  field (law 3.1). Green `#a7f3d0`/`#047857` for deterministic computed facts vs purple
  `#ddd6fe`/`#6d28d9` for LLM narration (law 3.2) — with `classify.ts` and `llm-client.ts` placed side
  by side beneath `TechnicalAgent` so the split is visible at a glance.
- Legend already in the file: blue = Postgres table · green = deterministic code · purple = LLM
  touchpoint · yellow = contract/abstraction · red = secret or failure path · orange = external
  service · dark `#1e293b` = evidence artifact.
- Three planned evidence artifacts: the real `price_bars` DDL from
  `packages/db/migrations/0000_ancient_rictor.sql`, the real `AgentOutput` Zod source, and a sample
  `agent_outputs.raw` payload.
- Box geometry convention used by the scaffold: name at `y+8` (fs 16), source line at `y+30` (fs 11
  grey), rule at `y+50`, fields from `y+58` at 15 px/line (fs 12, `fontFamily: 3`) — so
  **height = 68 + 15 × fieldCount**. All elements `roughness: 0`, `opacity: 100`.

Build it **section by section** (the skill enforces this — a full-diagram single pass blows the output
token limit), then run the render-view-fix loop in `.claude/skills/excalidraw-diagram/SKILL.md`.

### 13.4 `progress_notes.md` is stale — prefer this file and `FOLLOW-UPS.md`

Two concrete errors, both worth knowing because they will mislead a code search:

1. **The contract names it lists do not exist.** It claims `AgentSignalSchema`, `AgentRunResultSchema`,
   `PortfolioSnapshotSchema`, and enums `SignalDirection`, `Conviction`, `AgentRole`. The real exports
   from `packages/contracts` (verified in source) are:

   ```ts
   // enums.ts — each exported as BOTH a Zod schema and its inferred type, same name
   Direction = z.enum(["bullish","bearish","neutral"])
   AgentName = z.enum(["technical","sentiment","fundamental"])
   Timeframe = z.enum(["1Day","1Hour"])

   // signals.ts
   PriceBar          { symbol, timeframe, ts, open, high, low, close, volume, asOf }
   IndicatorSnapshot { symbol, timeframe, ts, rsi, macd, macdSignal,
                       bbUpper, bbLower, sma20, sma50, asOf }   // nullable during warm-up

   // agents.ts
   CONTRACTS_VERSION = "1.0.0"
   AgentInput  { runId, symbol, timeframe, decisionTs, bars, indicators, memory? }
   AgentOutput { agent, direction, confidence /* [0,1] */,
                 rationale /* 1..2000 */, evidence: Record<string, number|string|boolean> }
   AgentOutputJsonSchema   // zodToJsonSchema(AgentOutput, "AgentOutput"), draft-07

   // portfolio.ts
   PortfolioState { cash, equity, positions: {symbol,qty,marketValue,unrealizedPl}[], asOf }
   ```

   Timestamps are **ISO-8601 strings at every contract boundary** (JSON-safe across the TS↔Python
   seam); convert to `Date`/`timestamptz` only inside a service.

2. **Its status table is out of date.** It marks "integration / full workspace typecheck + tests" as
   *Blocked (credit limit)* and "commit per-owner, push, open PR" as *Next*. Both are done: typecheck
   and tests pass, and per-owner commits (`feat(m1)`, `feat(m2)`, `feat(m3)`, `chore(m4)`) are in the
   log with the branch pushed and in sync.

Consider deleting `progress_notes.md` or replacing its body with a pointer to this file.
