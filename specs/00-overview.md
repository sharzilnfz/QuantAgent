# Sprint 1 Specs — Overview & Conventions

> **The Committee** — a multi-agent paper-trading reference system.
> This directory holds **implementation specs**: one file per Sprint 1 feature, each written as a
> self-contained work-order that a single implementing agent can pick up and complete without
> needing the rest of the team online. Read this file first; it defines the shared architecture,
> stack, conventions, and the template every spec follows.

Source of truth for *what* and *why*: [`../PRD.md`](../PRD.md) and
[`../QuantAgent_Capstone_Guide.md`](../QuantAgent_Capstone_Guide.md). These specs are the *how*.

---

## Sprint 1 goal (the walking skeleton)

Login works, market data flows in **with as-of timestamps**, the technical agent produces real
schema-valid output, the dashboard renders portfolio state, and the Python backtest harness exists
(even if empty). Nothing here executes real trades yet — Sprint 1 proves the spine is wired.

---

## The eight specs (build order)

Numbered by dependency, not by owner. An agent should be able to start any spec once its
**Dependencies** section is satisfied. Specs `01` and `06` unblock almost everything else, so start
there.

| # | Spec | Owner | Layer | Unblocks |
|---|------|-------|-------|----------|
| 01 | [DB Schema & Core Models](sprint-1/01-m4-db-schema-core-models.md) | M4 | L0 | everything |
| 02 | [Shared Contracts Package (Zod)](sprint-1/02-m1-shared-contracts.md) | M1 | cross | 06, 07, 08 |
| 03 | [User Auth & Session Management](sprint-1/03-m4-auth-session.md) | M4 | platform | 08 |
| 04 | [Market Data Ingestion Service](sprint-1/04-m2-market-data-ingestion.md) | M2 | L0 | 05, 07 |
| 05 | [Technical Indicator Engine](sprint-1/05-m2-technical-indicator-engine.md) | M2 | L1 | 07 |
| 06 | [Agent Framework & Base Interface + stubs](sprint-1/06-m1-agent-framework-stubs.md) | M1 | L2 | 07, downstream sprints |
| 07 | [Technical Analyst Agent](sprint-1/07-m1-technical-analyst-agent.md) | M1 | L2 | dashboard signal view |
| 08 | [Dashboard Shell & Portfolio View](sprint-1/08-m3-dashboard-shell-portfolio.md) | M3 | UI | demo |

> **Note on `02`:** The PRD lists 8 Sprint-1 *features*; the shared Zod contracts package is not a
> named feature but is a hard prerequisite the PRD implies ("all agent inputs/outputs follow a
> consistent, validated schema"). It is split out as spec `02` so `06`/`07`/`08` have a stable,
> ownable dependency instead of racing to define schemas ad hoc. The "Backtesting Harness Skeleton"
> feature is folded into spec `05` (same owner M2, same Python service scaffold) — see that spec's
> **Non-goals** for the boundary.

---

## Architecture (recap — see PRD "Implementation Decisions")

Data flows bottom-up through seven layers plus two cross-cutting concerns:

- **L0 Data** — ingest + timestamp prices, news, fundamentals. *Every record carries an as-of timestamp.*
- **L1 Signal** — deterministic indicators (RSI, MACD, Bollinger, MAs) + portfolio math. No LLM.
- **L2 Agent** — three specialists, each constrained to a fixed output schema.
- **L3 Consensus** — 2-of-3 check, then one synthesis LLM call on disagreement. *(Sprint 2)*
- **L4 Risk** — deterministic rules engine, never an LLM. *(Sprint 2)*
- **L5 Allocation** — explainable non-LLM sizing. *(Sprint 3)*
- **L6 Execution** — Alpaca paper orders; outcomes written back to L0. *(Sprint 3)*
- **Memory** (cross-cutting) — short/episodic/long-term, queried into L2/L3. *(Sprint 3)*
- **Orchestrator** (outer frame) — state machine, parallel L2 fan-out, per-stage failure isolation. *(Sprint 2)*

Sprint 1 touches **L0, L1, one L2 agent + the framework, and the UI shell**.

---

## Tech stack (fixed — do not re-litigate per spec)

| Concern | Choice |
|---|---|
| App backend / API / orchestration | TypeScript, Node.js, **Fastify**, **Drizzle ORM**, **Zod**, PostgreSQL 16 + `pgvector` |
| Quant service | **Python 3.12**, **FastAPI**, `pandas`, `pandas-ta`, `vectorbt`, `pytest` |
| Frontend | **React + Vite**, TypeScript, **Tailwind**, `shadcn/ui`, **Recharts**, React Flow (later) |
| Vector / RAG | `pgvector` on the same Postgres instance |
| LLM provider | **Claude API** (`@anthropic-ai/sdk`). Cheap tier `claude-haiku-4-5` for agent narration; strong tier reserved for debate/reflection (later sprints). Verify current model IDs against `docs.claude.com` at build time. |
| Prices / news | **Alpaca** paper API (bundled market data + news) |
| Fundamentals | Financial Modeling Prep *(Sprint 2)* |
| Testing | **Vitest** (TS), **Pytest** (Python), mocked/replayed LLM responses |
| Deploy | **Docker Compose**, one service per component |

---

## Monorepo layout (agreed for Sprint 1)

```
/apps
  /api            Node/TS Fastify backend — auth, DB access, agent orchestration, REST API
  /web            React + Vite frontend
  /quant          Python FastAPI service — indicators, backtesting, evaluation
/packages
  /contracts      Shared Zod schemas + inferred TS types (spec 02) — the cross-service source of truth
  /db             Drizzle schema, migrations, seed (spec 01)
/docker
  docker-compose.yml, per-service Dockerfiles
/specs            these files
```

Rules of the road so **no two agents touch the same files**:

- `packages/db` is owned by **M4**. Others import generated types; they do not edit the schema.
  Need a column? File it against spec `01`, don't add it locally.
- `packages/contracts` is owned by **M1**. It is the *only* place Zod agent/signal schemas live.
- `apps/quant` is owned by **M2**. `apps/api` and `apps/web` never import Python.
- Cross-service data crosses **only** through Postgres tables (spec 01) or the quant HTTP API (spec 05).

---

## Cross-cutting laws (apply to every spec — non-negotiable)

1. **Point-in-time discipline.** Every fact table carries an `as_of` timestamp = the moment the
   datum became knowable. Every decision/output row references the data window it was allowed to
   see. **No query in the pipeline may read a fact whose `as_of` is after the current decision
   timestamp.** This is baked in from commit one, never retrofitted. Spec `01` provides the columns;
   spec `04`/`05`/`07` must honor them; a dedicated integrity test (Sprint 3) will fail the build if
   violated.
2. **Facts vs. narration.** Any number that *can* be computed deterministically (prices, indicators,
   P&L, returns) **must** be computed in code, never generated or restated by an LLM. LLMs only
   reason over and narrate already-computed facts. See spec `07` for how the technical agent obeys
   this.
3. **Schema-first / untrusted model text.** Raw LLM output is untrusted until it validates against
   its Zod schema (spec `02`). Validation failure is a handled error, not a crash.
4. **Graceful degradation.** A timed-out or failing agent yields a neutral "no opinion," never a
   crashed run. (Framework-level; spec `06`.)
5. **Every run is logged** with a replayable run id. (Framework-level; spec `06`.)
6. **Secrets encrypted at rest.** Alpaca credentials are AES-encrypted in the DB (spec `03`), never
   logged, never returned to the client in plaintext.

---

## Spec template (every file in `sprint-1/` follows this)

```
# NN — <Feature> (<Owner>, <Layer>)
> one-line purpose. PRD user stories: #x, #y.

## 1. Context & Goal          — why this exists, what "done" buys the team
## 2. Scope                   — In scope / Non-goals (explicit out-of-scope)
## 3. Dependencies            — upstream specs + external services/keys needed to start
## 4. Interface & Contracts   — DB tables, Zod schemas, HTTP routes, function signatures (the seams)
## 5. Implementation notes    — approach, gotchas, ordering, the point-in-time obligation
## 6. Acceptance criteria      — checklist, each item observable; maps to PRD user stories
## 7. Tests                    — specific cases (unit/integration), incl. the resilience/PIT tests
## 8. Files & Definition of Done — files to create/modify + the merge bar
```

---

## How an implementing agent should use a spec

1. Read this overview, then the target spec top to bottom.
2. Confirm every item in **Dependencies** is merged/available. If not, stop and surface it.
3. Implement to the **Interface & Contracts** exactly — those are the seams other agents build against.
   Changing a contract is a cross-team event: update spec `02`/`01` and flag owners, don't diverge silently.
4. Write the tests in section 7 first where practical (TDD-friendly; the `tdd` skill is installed).
5. A spec is done only when **every acceptance-criteria box is checked and its tests are green**.
6. Keep changes surgical and within your owned files (see monorepo rules). No drive-by edits to
   another owner's package.
