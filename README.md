# The Committee

A multi-agent paper-trading **reference system**. Four specialist agents (technical, sentiment/news,
fundamental/EDGAR XBRL, Polymarket macro odds) independently analyze an asset. When they disagree,
a multi-round debate with adversarial cross-examination resolves it and preserves the dissent. A
**deterministic risk gate, never an LLM**, approves or blocks the trade. A volatility-targeted
fractional-Kelly allocator sizes the position. Approved trades execute against Alpaca's **paper** API.

The distinguishing contribution is not the architecture (which parallels published multi-agent trading
systems). It is the **evaluation harness** and the **point-in-time data discipline** enforced from the
first commit.

> ⚠️ **Paper trading only, permanently.** This system makes no claim to predict markets and must not
> inform real investment decisions.

---

## How it works

Data flows bottom-up through seven layers plus two cross-cutting concerns. All layers are implemented
and verified on `main`.

| Layer | Responsibility | LLM? |
|---|---|---|
| **L0 Data** | Ingest + timestamp prices, news, fundamentals, prediction-market odds. Every record carries an `as_of`. | No |
| **L1 Signal** | Deterministic indicators (Wilder RSI, MACD, Bollinger Bands, SMA/EMA) + portfolio math. | **Never** |
| **L2 Agent** | Four specialists, each constrained to a fixed Zod output schema. | Yes |
| **L3 Consensus** | 2-of-4 check; on disagreement, R=2 adversarial cross-examination rounds then one synthesis call. Short-circuits when consensus is reached early. | On disagreement |
| **L4 Risk** | Deterministic rules engine: circuit breakers, exposure ceilings, volatility limits. Can be satisfied or violated, never persuaded. | **Never** |
| **L5 Allocation** | Volatility-targeted fractional Kelly sizing with cash buffer preservation. | **Never** |
| **L6 Execution** | Alpaca paper orders via a live execution router (deterministic mock broker for tests); outcomes written back to L0. | No |
| **Memory** | Short-term cache, pgvector long-term memory, episodic trade reflections, queried into L2/L3. | — |
| **Orchestrator** | State machine; parallel L2 fan-out, per-stage failure isolation, replayable run ids. A daemon drives continuous cycles. | — |

### The three laws

1. **Point-in-time discipline.** Every fact carries an `as_of`: when it became knowable. No query may
   read a fact whose `as_of` is after the current decision timestamp (`TemporalGuard` throws on
   violations). This single mechanism prevents look-ahead bias, and it is why evaluation results mean
   anything.
2. **Facts vs. narration.** Any number that *can* be computed deterministically is computed in code.
   LLMs reason over and narrate already-computed facts; they never invent or restate a number.
3. **Schema-first.** Raw model text is untrusted until it validates against its Zod schema. A validation
   failure is a handled error (neutral "no opinion"), never a crash.

---

## Repo layout

```
apps/
  api/        Node 20 + TypeScript + Fastify — auth, ingestion, agents, debate,
              risk, allocation, execution, memory, daemon, Telegram, MCP, REST API
  web/        React + Vite + Tailwind — Decision Observatory UI
  quant/      Python 3.12 + FastAPI — indicators, backtesting, benchmarks
packages/
  contracts/  Shared Zod schemas + inferred types (cross-service source of truth)
  db/         Drizzle schema, migrations, seed
  fixtures/   Frozen fixtures, market calendar, temporal guard, seed CLI
```

Cross-service data crosses only through Postgres or the quant HTTP API. All request/response shapes
live in `packages/contracts` and are parsed at both boundaries.

---

## Getting started

### Prerequisites

- Node ≥ 20 and pnpm ≥ 9 (`corepack enable` works)
- Python ≥ 3.12 with [uv](https://docs.astral.sh/uv/)
- Docker (Postgres + pgvector, or the full stack)

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
| `SESSION_TTL` | Session lifetime in seconds (default 7 days) |
| `ALPACA_KEY` / `ALPACA_SECRET` | Alpaca **paper** account, for market data + execution |
| `LLM_PROVIDER` | `auto` \| `gemini` \| `openrouter` \| `openai` \| `anthropic`, plus the matching key var(s) |
| `QUANT_SERVICE_URL` | Quant service URL (default `http://localhost:8000`) |

Provider selection runs automatically when keys are present. If Gemini is configured alongside a
primary provider, it acts as a zero-cost fallback when the primary fails or rate-limits. Never commit
a real `.env`; only `.env.example` belongs in the repo.

### 3. Run the stack

```bash
docker compose up -d postgres     # Postgres 17 + pgvector
pnpm db:migrate                   # create tables
pnpm db:seed                      # demo user + watchlist
pnpm seed:data                    # frozen fixture data

pnpm dev:api                      # API on :3000
pnpm dev:web                      # dashboard on :5173

cd apps/quant                     # quant service on :8000
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Or bring up everything at once:

```bash
docker compose up --build -d
```

### Service health

| Service | URL | Health check |
|---|---|---|
| Observatory web UI | http://localhost:5173 | loads the dashboard |
| Backend API (Fastify) | http://localhost:3000 | `GET /health` → `{"status":"ok"}` |
| Quant engine (FastAPI) | http://localhost:8000 | `GET /health`, Swagger at `/docs` |
| Postgres + pgvector | localhost:5432 | `pg_isready -U committee` |

Demo credentials after seeding: `demo@committee.local` / `demo-committee`, with a pre-seeded watchlist
of AAPL, MSFT, SPY.

---

## Offline replay

The deterministic evaluation replay runs the full pipeline over frozen fixtures at **$0.00 API cost**
with no LLM keys required:

```bash
pnpm demo:replay
# inside Docker:
docker compose exec api pnpm demo:replay
```

---

## API surface

Highlights of the Fastify REST API on :3000 (full schemas in `packages/contracts/src/`):

- **Auth**: `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me` (cookie sessions, bcrypt hashes)
- **Portfolio**: `/portfolio`, `/portfolio/history`, `/portfolio/allocate`
- **Agents**: `/agents/run`, `/agents/latest`, `/agents/config` (per-run agent configuration)
- **Signals**: `/signals/radar`, `/signals/evaluate`
- **Risk / Execution**: `/risk/assess`, `/execution/order`, `/execution/orders`
- **Experiments**: `/experiments/suite`, `/experiments/multi-asset/suite`, `/experiments/variance-sweep`
- **Reports**: `/reports/eod/latest`, `/reports/eod/history`, `/reports/eod/trigger`
- **Daemon**: `/daemon/status`, `/daemon/start`, `/daemon/stop`, `/daemon/run-cycle`, `/daemon/config`
- **Streaming**: `/streaming/market-data`, `/streaming/history`
- **Telegram**: two-way approval state machine with inline buttons (`/telegram/webhook`,
  `/telegram/approvals/*`)
- **Ingestion**: `/ingest/prices`
- **Credentials**: encrypted Alpaca credential vault (`/credentials`, `/credentials/status`)

### MCP server

Model Context Protocol integration exposed both ways:

```bash
pnpm mcp:server        # JSON-RPC 2.0 stdio CLI
# or over HTTP:
curl http://localhost:3000/mcp/tools
```

---

## Testing

```bash
pnpm test                                          # all TS packages
pnpm typecheck                                     # whole workspace
pnpm --filter @committee/api test                  # API (agents, auth, ingestion)
pnpm --filter @committee/web test                  # dashboard
cd apps/quant && uv run pytest                     # indicators + backtest (Python)
```

Testing decisions worth knowing:

- Agents are asserted on **schema validity and plausible bounds**, never exact LLM wording. LLM calls
  are mocked, so CI neither flakes on non-determinism nor burns API budget.
- Indicators are verified against a synthetic series with hand-computed expected values; backtests are
  asserted deterministic across repeated runs.
- Pipeline resilience is tested by simulating an agent timeout and confirming the run still completes.
- Tests requiring Postgres skip gracefully when no database is reachable, so the pure-logic suites run
  anywhere.

---

## License

Private reference implementation. Not licensed for external use.
