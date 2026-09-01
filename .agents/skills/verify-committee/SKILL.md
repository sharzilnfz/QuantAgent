---
name: verify-committee
description: "Drive and verify The Committee (QuantAgent) multi-agent trading system across Web UI, Fastify API, and offline replay CLI. Use when validating portfolio views, experiment observatory tearsheets, decision lineage auditing, signals radar, agent configuration, or deterministic backtests."
---

# Verify The Committee (QuantAgent)

This skill provides reproducible, programmatic instructions for launching, health-checking, driving, and capturing evidence across all surfaces of **The Committee (QuantAgent)** — including the Web UI (Vite SPA on port 5173), Fastify API (port 3000), PostgreSQL database (port 5432), and offline evaluation replay CLI.

---

## 1. Surfaces

- **Web UI (Primary User Surface):** React 18 SPA (`apps/web`) powered by Vite, Tailwind CSS, and TanStack Query on `http://127.0.0.1:5173`.
- **Backend API:** Fastify TypeScript service (`apps/api`) on `http://127.0.0.1:3000`.
- **Database:** PostgreSQL with `pgvector` (`quantagent-postgres-1`) on `localhost:5432`.
- **Deterministic Replay CLI:** Offline zero-cost backtest and benchmark engine (`pnpm demo:replay`).

---

## 2. Launch

To start the full stack for verification:

### Step 1: Start PostgreSQL & Seed Database
```bash
# Start Postgres container
docker compose up -d postgres

# Apply Drizzle migrations and seed demo credentials (demo@committee.local / demo-committee)
pnpm db:migrate && pnpm db:seed
```

### Step 2: Start API Server (Background Task)
```bash
pnpm --filter @committee/api dev
```
- **Ready Signal:** Port `3000` answering `GET /health` with `{"status":"ok"}`.
- **Log check:** Look for `API listening on http://0.0.0.0:3000`.

### Step 3: Start Web UI (Background Task)
```bash
pnpm --filter @committee/web dev
```
- **Ready Signal:** Port `5173` answering `GET /` with HTTP 200 containing `<title>The Committee</title>`.
- **Log check:** Look for `VITE ... ready in ... ms` and `Local: http://localhost:5173/`.

---

## 3. Doctor

Before driving features, execute this read-only doctor check to verify that all systems are healthy:

```bash
# 1. Check API Health
curl -s -f http://127.0.0.1:3000/health || (echo "API is DOWN" && exit 1)

# 2. Check Web Server
curl -s -f http://127.0.0.1:5173 > /dev/null || (echo "Web UI is DOWN" && exit 1)

# 3. Check Offline Fixture Ingestion & Experiment API
curl -s -f "http://127.0.0.1:3000/experiments/suite?symbol=AAPL" | grep -q "datasetHash" || (echo "Experiments API failed" && exit 1)

echo "✓ All systems healthy and ready for verification."
```

If any check fails:
1. Ensure Postgres is running: `docker compose ps`
2. Ensure migrations were applied: `pnpm db:migrate`
3. Inspect dev server task logs.

---

## 4. Drive

The application is driven using the **Playwright Browser MCP** for the Web UI and standard command execution for the CLI.

### Web UI Driving Conventions
- **Browser Navigation:** Navigate to `http://localhost:5173/`.
- **Authentication:** Unauthenticated sessions are automatically bounced to `/login`.
  - Email: `demo@committee.local`
  - Password: `demo-committee`
  - Fill inputs using `browser_fill_form` with `input[type='email']` and `input[type='password']`.
  - Submit using `browser_click` on `button[type='submit']`.
- **Navigation:** Primary navigation links in sidebar:
  - `Portfolio`: `a[href='/']`
  - `Observatory`: `a[href='/observatory']`
  - `Lineage`: `a[href='/lineage']`
  - `Agent Config`: `a[href='/config']`
  - `Signals`: `a[href='/signals']`
- **Stable Selectors:**
  - Role-based selectors: `button:has-text('AAPL')`, `button:has-text('Audit Lineage')`, `button:has-text('Evaluate Now')`.
  - Form fields: `input[name='email']`, sliders, comboboxes `select`.
  - Avoid fragile DOM indices or arbitrary coordinates.

### CLI Driving Conventions
- Execute offline evaluation: `pnpm demo:replay`
- Ingest prices: `pnpm ingest:prices --symbol AAPL --asOf 2024-12-31`

---

## 5. Evidence

All verification artifacts must be saved under `artifacts/verify-committee/` (or the active task artifact directory):
- **Web UI Screenshots:** Captured using `browser_take_screenshot` (saved to `artifacts/verify-committee/<feature-name>.png`).
- **ARIA & DOM Snapshots:** Captured using `browser_snapshot` (saved to `artifacts/verify-committee/<feature-name>.snapshot.yml`).
- **API Payloads:** Saved as `.json` files.
- **CLI Transcripts:** stdout/stderr logs saved with exit code confirmation.

### Proof Standards
1. Exercise authentic user paths (sign in -> navigate -> trigger action -> observe result).
2. Capture both the action and the resulting mutated/inspected state.
3. Validate temporal integrity (`as_of <= T_decision`) in lineage records.
4. Verify $0.00 token cost and deterministic execution for offline benchmarks.

---

## 6. Cleanup

When verification is complete:
1. Terminate background server tasks launched for the session (Web & API dev servers) via `manage_task` (Action: `kill`).
2. Do **NOT** delete the `artifacts/verify-committee/` directory — proof artifacts must survive teardown.
3. Optionally stop the Postgres container if no longer needed: `docker compose stop postgres`.

---

## 7. Helpers

This skill includes an automated verification helper script at `.agents/skills/verify-committee/scripts/doctor.sh`:

```bash
# Run the verification doctor script
bash .agents/skills/verify-committee/scripts/doctor.sh
```

---

## 8. Feature Map Index

Detailed verification recipes for specific user-facing capabilities:
- [Auth & Portfolio Dashboard](features/auth-and-portfolio.md): Session login, KPI summary cards, equity history curve, positions table, agent activity cards.
- [Evaluation Observatory](features/evaluation-observatory.md): Single & multi-asset strategy comparisons, equity trajectories, strategy overlay toggles, performance metrics tearsheet.
- [Decision Lineage Inspector](features/decision-lineage.md): Full decision provenance DAG, specialist deliberation transcripts (Technical, Sentiment, Fundamental, Polymarket), prompt & completion inspector, timeline stepping.
- [Signals & Indicator Radar](features/signals-radar.md): Real-time technical gauges (RSI, MACD, Bollinger Bands, SMA 20/50), specialist stance matrix, on-demand signal evaluation.
- [Agent Configuration Center](features/agent-configuration.md): Specialist weight sliders, debate consensus thresholds, risk gate parameters (drawdown circuit breaker, max exposure, cash reserve).
- [Offline Replay CLI](features/offline-replay-cli.md): Deterministic $0.00 token cost offline benchmark replay CLI.
