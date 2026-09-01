# The Committee Verification Map

This directory is the maintained source for verifying the user-facing behavior of **The Committee (QuantAgent)**. Read this index before driving the app, then use the matching feature file as the verification recipe.

---

## Baseline Preconditions

- Start PostgreSQL and ensure migrations and seeds are applied: `pnpm db:migrate && pnpm db:seed`.
- Launch the API backend at `http://localhost:3000` via `pnpm --filter @committee/api dev`.
- Launch the Web UI at `http://localhost:5173` via `pnpm --filter @committee/web dev`.
- Run the doctor check: `bash .agents/skills/verify-committee/scripts/doctor.sh`.
- Default demo user credentials: `demo@committee.local` / `demo-committee`.
- Never drive an instance that was not started by this verification run.

---

## Driving Conventions

- Start every recipe from the baseline authenticated state unless the feature's preconditions specify unauthenticated behavior.
- Prefer ARIA roles, accessible names, and stable button text (`button:has-text('AAPL')`, `a[href='/observatory']`) over CSS classes or arbitrary coordinates.
- Run browser actions through Playwright MCP tools (`browser_navigate`, `browser_fill_form`, `browser_click`, `browser_snapshot`, `browser_take_screenshot`).
- Run terminal actions through `run_command` (e.g. `pnpm demo:replay`).
- Proof artifacts must be stored under `artifacts/verify-committee/` and survive session cleanup.

---

## Proof Standards

- Capture both the user action and the resulting observable state.
- UI proof includes an ARIA snapshot (`.snapshot.yml`) and a screenshot (`.png`).
- CLI proof includes command invocation, stdout/stderr, and exit code 0.
- Point-in-time and zero-cost proofs must verify that historical replays operate at $0.00 token cost without external API keys.
- Record the feature ID and entry point with every artifact.

---

## Feature Map Index

- [Auth & Portfolio Dashboard](./auth-and-portfolio.md): Covers login authentication, session rehydration, KPI summary metrics, equity curves, positions table, and agent activity cards.
- [Evaluation Observatory](./evaluation-observatory.md): Covers single-asset and multi-asset benchmark suite comparisons, multi-series equity curves, strategy overlay toggles, and financial metrics tearsheets.
- [Decision Lineage Inspector](./decision-lineage.md): Covers decision provenance inspection, multi-round specialist deliberation transcripts (Technical, Sentiment, Fundamental, Polymarket), raw LLM prompts, and temporal guard checks.
- [Live Signals & Indicator Radar](./signals-radar.md): Covers real-time Wilder RSI, MACD, Bollinger Bands, specialist stance matrix, and on-demand deliberation triggers.
- [Agent Committee Configuration](./agent-configuration.md): Covers specialist weight adjustments, consensus threshold tuning, risk parameter overrides, and reset to defaults.
- [Offline Replay CLI](./offline-replay-cli.md): Covers zero-credential offline benchmark CLI execution, deterministic backtesting, and SLA performance.
