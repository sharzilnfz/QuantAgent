# The Committee

A multi-agent paper-trading **reference system**. Three specialist agents (technical, sentiment,
fundamental) independently analyze an asset; when they disagree a debate/synthesis step resolves it and
preserves the dissent; a **deterministic risk gate — never an LLM** — approves or blocks the trade; an
allocator sizes the position; approved trades execute against Alpaca's **paper** API.

The distinguishing contribution is not the architecture (which parallels published multi-agent trading
systems) — it's the **evaluation harness** and the **point-in-time data discipline** baked in from the
first commit.

> ⚠️ **Paper trading only, permanently.** This system makes no claim to predict markets and must not
> inform real investment decisions.

---

## Status — Sprint 1 (walking skeleton)

| Spec | Feature | Owner |
|---|---|---|
| 01 | Database schema & core models (`as_of` from day one) | M4 |
| 02 | Shared contracts (Zod schemas) | M1 |
| 03 | Auth, sessions & encrypted Alpaca credential vault | M4 |
| 04 | Market data ingestion (Alpaca) | M2 |
| 05 | Technical indicator engine + backtest skeleton | M2 |
| 06 | Agent framework & base interface + stub agents | M1 |
| 07 | Technical analyst agent | M1 |
| 08 | Dashboard shell & portfolio view | M3 |

Sprints 2–4 (debate/consensus, risk gate, execution, memory, evaluation & ablation suite, Telegram bot)
are specced in [`PRD.md`](PRD.md) and not yet implemented.

---

## Architecture

Data flows bottom-up through seven layers plus two cross-cutting concerns:

| Layer | Responsibility | LLM? |
|---|---|---|
| **L0 Data** | Ingest + timestamp prices, news, fundamentals. Every record carries an `as_of`. | No |
| **L1 Signal** | Deterministic indicators (RSI, MACD, Bollinger, MAs) + portfolio math. | **Never** |
| **L2 Agent** | Three specialists, each constrained to a fixed output schema. | Yes |
| **L3 Consensus** | 2-of-3 check, then one synthesis call on disagreement. *(Sprint 2)* | On disagreement |
| **L4 Risk** | Deterministic rules engine. Can be satisfied or violated, never persuaded. | **Never** |
| **L5 Allocation** | Explainable non-LLM sizing rule. *(Sprint 3)* | **Never** |
| **L6 Execution** | Alpaca paper orders; outcomes written back to L0. *(Sprint 3)* | No |
| **Memory** | Short/episodic/long-term, queried into L2/L3. *(Sprint 3)* | — |
| **Orchestrator** | State machine; parallel L2 fan-out, per-stage failure isolation, replayable run ids. | — |

### The three laws

1. **Point-in-time discipline.** Every fact carries an `as_of` = when it became knowable. No query may
   read a fact whose `as_of` is after the current decision timestamp. This is the single mechanism
   preventing look-ahead bias, and the reason the evaluation results mean anything.
2. **Facts vs. narration.** Any number that *can* be computed deterministically is computed in code.
   LLMs only reason over and narrate already-computed facts — they never invent or restate a number.
3. **Schema-first.** Raw model text is untrusted until it validates against its Zod schema. A validation
   failure is a handled error (neutral "no opinion"), never a crash.

---

## Repo layout

```
apps/
  api/        Node + TypeScript + Fastify — auth, ingestion, agents, orchestration, REST API
  web/        React + Vite + Tailwind — dashboard
  quant/      Python + FastAPI — indicators, backtesting, evaluation
packages/
  contracts/  Shared Zod schemas + inferred types (the cross-service source of truth)
  db/         Drizzle schema, migrations, seed
specs/        Implementation specs, one per feature
```

**Ownership** (so no two people touch the same files): `packages/db` → M4 · `packages/contracts` → M1 ·
`apps/quant` → M2 · `apps/web` → M3. Cross-service data crosses only through Postgres or the quant HTTP API.

---

## Getting started

### Prerequisites
Node ≥ 20, pnpm ≥ 9, Python ≥ 3.12, Docker (for Postgres + the full stack).

### 1. Install
```bash
pnpm install
cp .env.example .env      # then fill in the values below
```

### 2. Configure `.env`
| Var | What it's for |
|---|---|
| `DATABASE_URL` | Postgres connection (pgvector image) |
| `CREDENTIAL_ENC_KEY` | base64 32-byte AES key for the credential vault — `openssl rand -base64 32` |
| `ALPACA_KEY` / `ALPACA_SECRET` | Alpaca **paper** account, for market data + (later) execution |
| `ANTHROPIC_API_KEY` | Claude API, for the agents |

Never commit a real `.env`. Only `.env.example` belongs in the repo.

### 3. Run the stack
```bash
docker compose up -d postgres     # Postgres 16 + pgvector
pnpm db:migrate                   # create tables
pnpm db:seed                      # demo user + watchlist

pnpm dev:api                      # API on :3000
pnpm dev:web                      # dashboard on :5173

cd apps/quant                     # quant service on :8000
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Or bring up everything at once: `docker compose up --build`.

---

## Testing

```bash
pnpm test                                          # all TS packages
pnpm --filter @committee/api test                  # API (agents, auth, ingestion)
pnpm --filter @committee/web test                  # dashboard
cd apps/quant && uv run pytest                     # indicators + backtest (Python)
pnpm typecheck                                     # whole workspace
```

The suites follow the PRD's testing decisions: agents are asserted on **schema validity and plausible
bounds, never exact LLM wording**; LLM calls are **mocked** so CI neither flakes on non-determinism nor
burns API budget; indicators are verified against a **synthetic series with hand-computed expected
values**; pipeline resilience is tested by **simulating an agent timeout** and confirming the run still
completes.

Tests requiring Postgres skip gracefully when no database is reachable, so the pure-logic suites run
anywhere.

---

## Manual Testing & Verification

### 1. Service Status & Health Checks

| Service | Port / URL | Health Check / Endpoint | Status |
| :--- | :--- | :--- | :--- |
| **Observatory Web UI** | `http://localhost:5173` | `GET /` (React Dashboard) | `200 OK` |
| **Backend API (Fastify)** | `http://localhost:3000` | `GET http://localhost:3000/health` | `{"status":"ok"}` |
| **Python Quant Engine** | `http://localhost:8000` | `GET http://localhost:8000/health`<br>`GET http://localhost:8000/docs` (Swagger UI) | `{"status":"ok"}` |
| **PostgreSQL + pgvector** | `localhost:5432` | `pg_isready -U committee` | Ready |

---

### 2. Demo Credentials
- **Email**: `demo@committee.local`
- **Password**: `demo-committee`
- **Pre-seeded Watchlist**: `AAPL`, `MSFT`, `SPY`

---

### 3. Individual Dev Starters (if running locally without full Docker)

```bash
# Terminal 1 — Database
docker compose up -d postgres && pnpm db:migrate && pnpm db:seed

# Terminal 2 — Backend API (:3000)
pnpm dev:api

# Terminal 3 — Python Quant Service (:8000)
cd apps/quant && uv run uvicorn app.main:app --port 8000 --reload

# Terminal 4 — Observatory Web UI (:5173)
pnpm dev:web
```

*Or launch the entire containerized stack in one command:*
```bash
docker compose up --build -d
```

---

### 4. Manual Test Workflows

1. **Web Dashboard & Watchlist**:
   - Navigate to `http://localhost:5173` and log in with demo credentials (`demo@committee.local` / `demo-committee`).
   - Verify portfolio summary and pre-seeded watchlist items (`AAPL`, `MSFT`, `SPY`).
2. **Observatory & Tearsheets**:
   - Switch to the **Observatory** tab.
   - Inspect comparison tearsheets, multi-series equity curves, drawdown profile, and benchmark deltas (SMA/RSI vs Buy & Hold).
3. **Decision Lineage DAG Inspector**:
   - In the tearsheet view, click **"Audit Lineage"** on any evaluated run.
   - Inspect the interactive specialist agents' debate synthesis DAG, timestamps, and confidence telemetry.
4. **Live Variance Sweeps ($N=3$)**:
   - Toggle the **Variance Sweep** harness on the Observatory header to inspect empirical variance bands across non-deterministic LLM evaluation runs.
5. **Offline Multi-Agent Replay (CLI)**:
   - Run deterministic evaluation replay across frozen fixtures ($0.00 API cost):
     ```bash
     pnpm demo:replay
     # Or inside Docker:
     docker compose exec api pnpm demo:replay
     ```

---

## Documentation

- [`docs/prd/PRD.md`](docs/prd/PRD.md) — Problem, solution, user stories, sprint breakdown
- [`docs/prd/PRD_EVALUATION_LAB.md`](docs/prd/PRD_EVALUATION_LAB.md) — Evaluation lab PRD, master specification, and ablation harness
- [`specs/00-overview.md`](specs/00-overview.md) — Architecture, conventions, spec index
- [`docs/guides/QuantAgent_Capstone_Guide.md`](docs/guides/QuantAgent_Capstone_Guide.md) — Strategy, field fundamentals, evaluation methodology
- [`Git_Workflow_Branches_Worktrees.md`](Git_Workflow_Branches_Worktrees.md) — Branching, worktrees, commit conventions

> **Naming note:** If this project is published, avoid the name "QuantAgent" — it collides with an existing arXiv paper title.

