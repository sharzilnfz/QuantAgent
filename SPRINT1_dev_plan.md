# Sprint 1 Development Plan — CSE470 Multi-Agent Paper-Trading Platform

> **Sprint 1 — "Foundation" (Weeks 1–2).** Goal: a runnable end-to-end skeleton
> — auth working, market data flowing and stored, indicators computed, the first
> agent producing schema-valid output, and a dashboard shell showing the live
> Alpaca paper portfolio.

---

## 0. How to use this plan (instructions for the coding agent)

You are implementing **Sprint 1 only**. Work **feature by feature in the build
order given in §9**, not all at once. After each feature:

1. Write the code + its tests in the same step.
2. Run lint + tests; do not move on until they pass (external calls are mocked).
3. Make a small, focused commit.

Honor two non-negotiable design rules throughout:

- **Facts vs. narration:** every number (indicators, P&L, returns) is computed by
  deterministic code. LLMs, if used at all, only narrate already-computed facts.
  In Sprint 1 the technical agent's rationale is deterministic; no LLM is on the
  critical path.
- **Point-in-time discipline:** every stored data row carries an `as_of`
  availability timestamp, and any decision may only read rows whose `as_of` is at
  or before the decision timestamp. This is enforced in code and tested (§6, §8).

Where this plan says "recommended library X," prefer the current stable version;
do not pin to a version this document names unless a lockfile already exists.

---

## 1. Sprint 1 Definition of Done

The sprint is complete when **all** of the following are true and demonstrable:

- A user can **register and log in**; the session **persists across a browser
  reload** (refresh-token flow).
- A user can **save their Alpaca paper API keys**, stored **encrypted at rest**;
  the backend can call Alpaca on their behalf without ever exposing the secret to
  the client.
- The **portfolio page** shows the user's **real Alpaca paper account**: open
  positions, cash balance, and P&L.
- The **data-ingestion service** pulls OHLCV bars for watchlist symbols and stores
  them with `as_of` timestamps; ingestion is idempotent.
- The **quant service** computes RSI, MACD, Bollinger Bands, SMA, and EMA; the
  backend stores indicator snapshots with `as_of`.
- The **technical agent** runs on a watchlist asset and returns a **schema-valid
  `AgentOutput`** (bias, confidence, rationale, features); the run is persisted
  and visible in structured logs. (Bonus: surfaced on the dashboard.)
- The **backtesting harness skeleton** exists with a **passing synthetic-series
  unit test** and a **point-in-time guard test** that fails if a signal uses data
  timestamped after its decision time.
- The whole stack runs with a single **`docker compose up`**.
- **CI** runs lint + unit tests with all external calls (Alpaca, any LLM) mocked.

---

## 2. Consolidated tech stack (from the two source documents)

| Layer | Choice | Source |
|---|---|---|
| Repo | Monorepo, pnpm workspaces | PRD (monorepo) + gap-fill (pnpm) |
| Backend / API | Node.js + TypeScript + Express | PRD |
| Realtime | Socket.IO (scaffold only in Sprint 1) | PRD |
| DB | PostgreSQL + Drizzle ORM (SQL-first), drizzle-kit migrations | PRD |
| Shared schemas | Zod (shared package) | PRD |
| Quant service | **Python + FastAPI** (indicators + backtest harness) | Strategy doc (Sprint 1) |
| Indicators | pandas + pandas-ta (Python) | Strategy doc |
| Backtesting | vectorbt (research) — skeleton only this sprint | Strategy doc |
| Frontend | React + Vite + TypeScript, Zustand, Tailwind + shadcn/ui | PRD + strategy doc |
| Broker / market data | Alpaca (paper trading + market data) | PRD |
| LLM client | OpenRouter/Claude abstraction — **scaffolded, off critical path** | PRD + gap-fill |
| Deploy | Docker Compose (postgres, backend, frontend, quant) | PRD |
| Logging | pino (Node), structlog/std logging (Python) — structured JSON | gap-fill |
| Tests | Vitest (TS), Pytest (Python) | strategy doc |

Deferred to later sprints (do **not** build now): sentiment/fundamental agents,
debate engine, risk gate, allocator, execution, layered memory, reflection,
Telegram bot, pipeline visualization, config panel, WebSocket streaming.

---

## 3. Architectural decisions & gap-filling

These are the calls made where the documents were silent or in conflict. A human
reviewer should skim these first.

1. **Indicators live in the Python quant service, not Node.** The PRD suggested a
   JS indicator library; the strategy doc overrides this and says stand up the
   Python service in Sprint 1. The quant service is **stateless**: it receives a
   bar series over HTTP and returns indicator values. The **Node backend owns the
   database** (single schema via Drizzle) and persists the results. This keeps one
   source of truth and avoids dual-ORM drift. *Fallback if the team rejects a
   second service this early:* compute indicators in Node with `technicalindicators`
   and migrate later — but this is explicitly not recommended.
2. **Data ingestion = REST polling of bars in Sprint 1.** WebSocket streaming is
   deferred; polling historical + latest bars is enough for the skeleton and far
   simpler. Store bars idempotently (upsert on `symbol + timeframe + bar_time`).
3. **Auth = short-lived JWT access token + refresh token in an httpOnly, secure,
   sameSite cookie.** Access token held in frontend memory (not localStorage).
   Refresh-token rotation on each `/refresh`. This gives reload-persistence
   without exposing tokens to XSS via localStorage.
4. **Alpaca keys encrypted with AES-256-GCM**, key from `APP_ENCRYPTION_KEY`
   (32-byte, base64, from env). Store ciphertext + iv + authTag. Decrypt only
   server-side at call time; never return secrets to the client.
5. **Password hashing = argon2id.**
6. **No LLM on the critical path in Sprint 1.** The technical agent's rationale is
   deterministic (templated from the features it used). The `LLMClient`
   abstraction is scaffolded (interface + config) but unused, so no API cost is
   incurred during foundation work.
7. **Backtest harness is a skeleton this sprint:** a Python module with a
   walk-forward runner interface, a point-in-time guard, and one unit test on a
   synthetic price series with a hand-computed expected SMA-crossover outcome. Not
   wired to real strategies yet — it exists so it isn't dropped later.
8. **Point-in-time is enforced now, not retrofitted:** `as_of` columns on
   `price_bars`, `indicator_snapshots`, and `agent_outputs`; a shared read helper
   that filters `as_of <= decision_time`; and a failing-on-violation test.

---

## 4. Monorepo structure

```
repo-root/
├─ docker-compose.yml
├─ .env.example
├─ pnpm-workspace.yaml
├─ package.json                     # workspace root
├─ packages/
│  ├─ shared/                       # TS types + Zod schemas (agent I/O, DTOs)
│  │  └─ src/
│  │     ├─ schemas/agent.ts        # AgentInput / AgentOutput (Zod)
│  │     ├─ schemas/market.ts       # Bar, IndicatorSnapshot (Zod)
│  │     └─ index.ts
│  ├─ backend/                      # Express API, auth, ingestion, orchestration
│  │  └─ src/
│  │     ├─ index.ts                # server bootstrap
│  │     ├─ db/                     # drizzle schema + client + migrations
│  │     │  ├─ schema.ts
│  │     │  └─ client.ts
│  │     ├─ modules/
│  │     │  ├─ auth/                # F1
│  │     │  ├─ credentials/         # F1 (Alpaca key storage)
│  │     │  ├─ market/              # F3 ingestion + bars/indicators endpoints
│  │     │  ├─ portfolio/           # F7 Alpaca portfolio proxy
│  │     │  ├─ watchlist/
│  │     │  └─ agents/              # F5 framework + F6 technical agent
│  │     ├─ lib/
│  │     │  ├─ crypto.ts            # AES-256-GCM encrypt/decrypt
│  │     │  ├─ alpaca.ts            # Alpaca client wrapper
│  │     │  ├─ quantClient.ts       # HTTP client to Python quant service
│  │     │  ├─ pointInTime.ts       # as_of read guard
│  │     │  ├─ llmClient.ts         # scaffold, unused in Sprint 1
│  │     │  └─ logger.ts            # pino structured logger
│  │     └─ config.ts               # env parsing (zod-validated)
│  └─ frontend/                     # React + Vite + TS
│     └─ src/
│        ├─ main.tsx, App.tsx, router.tsx
│        ├─ store/                  # Zustand (auth, watchlist)
│        ├─ lib/api.ts              # fetch wrapper w/ token refresh
│        ├─ pages/{Login,Register,Portfolio,Watchlist}.tsx
│        └─ components/ui/          # shadcn/ui
└─ services/
   └─ quant/                        # Python FastAPI
      ├─ app/
      │  ├─ main.py                 # FastAPI app, /health, /indicators, /backtest
      │  ├─ indicators.py           # pandas-ta computations
      │  └─ backtest/
      │     ├─ harness.py           # walk-forward runner skeleton + PIT guard
      │     └─ __init__.py
      ├─ tests/test_indicators.py
      ├─ tests/test_backtest_pit.py
      ├─ pyproject.toml
      └─ Dockerfile
```

---

## 5. Environment & secrets (`.env.example`)

Never commit real values. `config.ts` and FastAPI settings must validate these at
startup and fail fast if missing.

```
# --- Postgres ---
DATABASE_URL=postgres://app:app@postgres:5432/trading

# --- Auth ---
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d

# --- Encryption for Alpaca keys (32-byte base64) ---
APP_ENCRYPTION_KEY=base64:change-me

# --- Services ---
QUANT_SERVICE_URL=http://quant:8000
BACKEND_PORT=4000
FRONTEND_ORIGIN=http://localhost:5173

# --- Alpaca (per-user keys are stored in DB; these are optional defaults) ---
ALPACA_BASE_URL=https://paper-api.alpaca.markets
ALPACA_DATA_URL=https://data.alpaca.markets

# --- LLM (scaffold only; unused in Sprint 1) ---
OPENROUTER_API_KEY=
```

---

## 6. Data model — Sprint 1 tables (Drizzle, PostgreSQL)

Implement these fully. Forward-declare (create empty migration stubs, comment
"deferred") the tables Sprint 1 references but doesn't use yet: `orders`,
`memory_*`, `debate_*`, `reflections`, `reports`.

Point-in-time rule: `as_of` = the timestamp at which this data first became
available to the system. It is distinct from the domain timestamp (e.g. a bar's
market time) and from `created_at` (row insert time), though for live-ingested
data `as_of` ≈ ingestion time.

| Table | Key columns |
|---|---|
| `users` | `id` (uuid pk), `email` (unique), `password_hash`, `created_at` |
| `refresh_tokens` | `id`, `user_id` fk, `token_hash`, `expires_at`, `revoked_at`, `created_at` |
| `alpaca_credentials` | `user_id` fk (unique), `key_ciphertext`, `secret_ciphertext`, `iv`, `auth_tag`, `is_paper` (bool, default true), `created_at` |
| `assets` | `symbol` (pk), `name`, `exchange`, `asset_class` |
| `watchlist_items` | `id`, `user_id` fk, `symbol` fk, `added_at`, unique(`user_id`,`symbol`) |
| `price_bars` | `id`, `symbol` fk, `timeframe`, `bar_time`, `open`, `high`, `low`, `close`, `volume`, **`as_of`**, unique(`symbol`,`timeframe`,`bar_time`) |
| `indicator_snapshots` | `id`, `symbol` fk, `timeframe`, `bar_time`, `values` (jsonb: rsi, macd, macd_signal, macd_hist, bb_upper, bb_mid, bb_lower, sma, ema...), `computed_at`, **`as_of`** |
| `agent_runs` | `id`, `user_id` fk, `agent_name`, `symbol`, `status` (enum: pending/success/error), `error`, `started_at`, `finished_at`, `decision_as_of` |
| `agent_outputs` | `id`, `agent_run_id` fk, `symbol`, `bias` (enum), `confidence` (numeric), `rationale`, `features` (jsonb), **`as_of`**, `schema_version`, `created_at` |

`packages/backend/src/lib/pointInTime.ts` exposes a helper used by every read
that feeds a decision, e.g. `barsAsOf(symbol, timeframe, decisionTime)` returning
only rows with `as_of <= decisionTime`.

---

## 7. Feature specifications

Each feature lists owner (PRD role), objective, tasks, endpoints/contract, and
acceptance criteria.

### F2 — Database schema & core models (Owner: M4) — *build first*
**Objective:** the Drizzle schema (§6), a working migration, and a seed script.
**Tasks:** define `schema.ts`; configure `drizzle-kit` (generate + migrate); DB
client with a pool; seed a few `assets` (e.g. AAPL, MSFT, SPY) and a demo user.
**Acceptance:** `drizzle-kit migrate` creates all Sprint-1 tables against the
Compose Postgres; seed runs idempotently.

### F1 — Auth & session management (Owner: M4)
**Objective:** register/login, refresh-token session persistence, encrypted
Alpaca key storage.
**Tasks:** argon2id hashing; issue access JWT + rotating refresh token (httpOnly
cookie, hash stored in `refresh_tokens`); auth middleware; `crypto.ts`
(AES-256-GCM) for Alpaca keys.
**Endpoints:**
`POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/refresh` ·
`POST /api/auth/logout` · `GET /api/auth/me` ·
`PUT /api/credentials/alpaca` (store encrypted) ·
`GET /api/credentials/alpaca/status` (returns `{ configured: boolean }` only).
**Acceptance:** register→login returns an access token + sets refresh cookie;
`/refresh` issues a new access token after the old expires; Alpaca keys round-trip
through encrypt/decrypt and are never returned to the client; unit tests cover
hashing, token rotation, and encryption.

### F3 — Market data ingestion (Owner: M2)
**Objective:** pull OHLCV bars for watchlist symbols from Alpaca and store them
point-in-time.
**Tasks:** `alpaca.ts` wrapper (uses the user's decrypted keys); an ingestion
routine that fetches historical + latest bars per timeframe; normalize → upsert
into `price_bars` with `as_of = now()`; rate-limit handling with backoff;
idempotent on re-run.
**Endpoints:** `POST /api/ingest/:symbol` (manual trigger for Sprint 1) ·
`GET /api/assets/:symbol/bars?timeframe=1D`.
**Acceptance:** triggering ingest for a seeded symbol stores bars with `as_of`;
re-running does not duplicate rows; Alpaca is mocked in tests.

### Quant service + F4 — Indicator engine (Owner: M2)
**Objective:** stateless Python service computing indicators; backend persists
snapshots.
**Tasks (Python):** FastAPI app with `GET /health`, `POST /indicators`
(`{ bars: Bar[] }` → `{ rsi, macd, macd_signal, macd_hist, bb_upper, bb_mid,
bb_lower, sma, ema }`) using pandas-ta; Dockerfile; pytest with a fixed input.
**Tasks (Node):** `quantClient.ts`; after ingest, send the bar series to
`/indicators`, store result in `indicator_snapshots` with `as_of` = the newest
contributing bar's `as_of` (so the snapshot cannot claim knowledge earlier than
its inputs); `GET /api/assets/:symbol/indicators`.
**Acceptance:** ingest→compute produces a snapshot whose values match the Python
unit test's expected numbers within tolerance; `as_of` is set correctly.

### F5 — Agent framework & base agent interface (Owner: M1) — *build before F6*
**Objective:** the contract every future agent implements, so M2–M4 and later
sprints build against a stable interface.
**Tasks:** in `shared`, define Zod `AgentInput` and `AgentOutput` (below);
`BaseAgent` abstract class with `analyze(input): Promise<AgentOutput>`; an agent
**registry** (register/lookup by name); **logging hooks** (structured run
logs via pino); an **execution wrapper** providing timeout (e.g. 10s) + retry
with backoff and Zod-validating the output. Persist `agent_runs` + `agent_outputs`.
**Shared schema (authoritative):**
```ts
AgentInput  = { symbol, timeframe, decisionAsOf: ISODateTime, features: Record<string, number> }
AgentOutput = {
  agentName: string,
  symbol: string,
  bias: 'bullish' | 'bearish' | 'neutral',
  confidence: number,          // 0..1
  rationale: string,
  features: Record<string, number>,  // the exact numbers used (facts)
  asOf: ISODateTime,           // = input.decisionAsOf
  schemaVersion: string        // e.g. "1.0.0"
}
```
**Acceptance:** a dummy agent registered and run through the wrapper produces a
schema-valid output; a forced timeout and a forced schema-invalid output are both
caught and recorded as `agent_runs.status = 'error'`; contract round-trip test on
the Zod schemas passes.

### F6 — Technical analyst agent (Owner: M1)
**Objective:** the first real agent — deterministic, rule-based, facts-first.
**Tasks:** implement `BaseAgent`; input is the indicator snapshot fetched via the
point-in-time guard for `decisionAsOf`; map indicators → bias + confidence with
explicit rules (e.g. RSI<30 bullish / >70 bearish; MACD histogram sign; close vs
SMA); build a **deterministic rationale** string that names the features used;
`features` echoes the exact numbers. No LLM call.
**Endpoint:** `POST /api/agents/technical/run` `{ symbol, decisionAsOf? }` →
`AgentOutput` (defaults `decisionAsOf` to now).
**Acceptance:** running on a symbol with stored indicators returns a schema-valid
output; the run is visible in structured logs and persisted; unit tests cover the
rule mapping for bullish/bearish/neutral cases.

### F7 — Dashboard shell & portfolio view (Owner: M3)
**Objective:** the runnable frontend — auth flow, portfolio, and an agent trigger.
**Tasks:** Vite + React + TS; Tailwind + shadcn/ui; dark theme; react-router with
protected routes; Zustand `authStore`; `api.ts` fetch wrapper that transparently
calls `/api/auth/refresh` on 401 and retries; pages: Register, Login, Portfolio,
Watchlist. Portfolio calls `GET /api/portfolio` (backend proxies Alpaca account +
positions using decrypted keys) and renders positions, cash, and P&L. Watchlist
lists symbols with an **"Analyze"** button that calls the technical-agent endpoint
and shows the returned bias/confidence/rationale.
**Backend endpoint needed:** `GET /api/portfolio` → `{ cash, equity, positions[], pnl }`.
**Acceptance:** unauthenticated users are redirected to login; after login the
portfolio page shows the real Alpaca paper account and survives a page reload;
the Analyze button renders a live agent result.

### Backtest harness skeleton (Owner: M2, in the quant service)
**Objective:** exist now so it isn't dropped later; prove point-in-time is real.
**Tasks:** `backtest/harness.py` with a walk-forward runner interface and a
point-in-time guard (a signal at time *t* may only see bars with `as_of <= t`);
`POST /backtest` stub returning a not-implemented-yet marker; two pytest tests —
(a) a synthetic price series with a hand-computed expected SMA-crossover signal,
(b) a **point-in-time violation test** that constructs a signal referencing a
future-`as_of` bar and asserts the guard raises.
**Acceptance:** both tests pass; the PIT test fails if the guard is removed.

---

## 8. Cross-cutting concerns

- **Structured logging:** pino (Node) and structlog/std logging (Python) emitting
  JSON. Log every agent run, external call, and error with correlation ids. No
  free-text `print`/`console.log` for anything you'd want to query later.
- **Point-in-time:** the `pointInTime.ts` guard is the *only* sanctioned way to
  read decision-feeding data. The backtest PIT test is the enforcement mechanism.
- **Testing:** Vitest (backend, shared) + Pytest (quant). **Mock all external
  calls** — Alpaca and any LLM — so CI never hits the network, flakes, or spends
  money. Contract-test the Zod schemas (round-trip parse).
- **Docker Compose:** services `postgres`, `backend`, `frontend`, `quant`. Backend
  waits for Postgres healthcheck; frontend proxies `/api` to backend; backend
  reaches quant at `QUANT_SERVICE_URL`.
- **CI:** one workflow — install, lint, run Vitest + Pytest with mocks. Block merge
  on failure.

---

## 9. Build sequence & parallel tracks

Critical path is left-to-right; items stacked vertically can run in parallel once
their upstream dependency lands.

```
Day 0   Repo scaffold: pnpm workspaces, Docker Compose, shared package, CI, .env
          │
Track A (M4):  F2 schema+migrations  ─►  F1 auth + encrypted creds  ─►  /api/portfolio proxy
Track B (M2):                            F3 ingestion  ─►  quant service + F4 indicators  ─►  backtest skeleton
Track C (M1):  F5 agent framework (shared contracts)  ─►  F6 technical agent
Track D (M3):  frontend scaffold + auth pages  ─►  portfolio page  ─►  watchlist + Analyze button
          │
End of wk2   Integration pass: docker compose up → register → save keys →
             see portfolio → ingest → compute indicators → run technical agent → see output
```

**Ordering constraints the agent must respect:**
- F2 (schema) is a hard prerequisite for F1, F3, F4, F6.
- **F5's shared `AgentInput`/`AgentOutput` schemas must be published early** (day 0–1
  of the agent track) so F6, F7, and later sprints code against a stable contract.
- F4 (indicators) requires F3 (bars) to have data; F6 requires F4.
- F7's portfolio page requires F1 (auth + decrypted Alpaca access).

Suggested milestone split: **end of week 1** = auth + DB + ingestion + quant
service reachable, frontend auth flow working; **end of week 2** = indicators +
technical agent + portfolio page + backtest skeleton, full integration pass green.

---

## 10. Sprint 1 acceptance checklist (copy into the PR description)

- [ ] `docker compose up` brings up postgres, backend, frontend, quant.
- [ ] Register + login; session survives reload via refresh token.
- [ ] Alpaca keys saved encrypted; never returned to client.
- [ ] Portfolio page shows real Alpaca paper positions, cash, P&L.
- [ ] Ingestion stores bars with `as_of`; idempotent on re-run.
- [ ] Quant service computes RSI/MACD/Bollinger/SMA/EMA; snapshots stored with `as_of`.
- [ ] Technical agent returns schema-valid `AgentOutput`; run persisted + logged.
- [ ] Agent framework enforces timeout/retry + Zod validation (error paths tested).
- [ ] Backtest harness skeleton + synthetic-series test + PIT-violation test pass.
- [ ] CI green with all external calls mocked.

---

## 11. Explicitly out of scope for Sprint 1 (do not build)

Sentiment/fundamental agents · debate & consensus · risk gate · allocator · trade
execution/orders · layered memory & reflection · Telegram bot · pipeline
visualization · agent config panel · WebSocket price streaming · any live LLM
calls on the critical path. These belong to Sprints 2–4.
