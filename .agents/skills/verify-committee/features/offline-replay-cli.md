# Offline Replay CLI

The Offline Replay CLI executes single-asset and multi-asset evaluation benchmarks completely offline at $0.00 token cost using frozen deterministic fixtures.

## Sub-features

- `cli-single-asset-replay` runs full AAPL historical replay across Buy & Hold, SMA/RSI, Multi-Agent Debate ON/OFF, and Polymarket strategies.
- `cli-multi-asset-universe` executes cross-asset portfolio backtests across AAPL, NVDA, and SPY.
- `cli-metrics-summary` outputs formatted tables with Total Return, Annualized Return, Sharpe Ratio, Sortino Ratio, Max Drawdown, Directional Accuracy, and Brier Score.
- `cli-zero-cost-verification` enforces zero external network calls and sub-5000ms execution SLA.

## How to get to it (user POV)

- Run `pnpm demo:replay` in the project root directory.
- Or run `pnpm --filter @committee/api demo:replay`.

## Driving it with Terminal Harness

Preconditions:
- Node.js >= 20 and `pnpm` are installed.
- Repository dependencies are installed (`pnpm install`).
- Fixture files exist under `packages/fixtures/data/*.json`.

- **Execute Replay.** Run the replay command:
  ```bash
  pnpm demo:replay
  ```
- **Verify Exit Code.** Assert exit code is `0`.
- **Verify Output Content.** Check stdout for:
  - `QUANTLAB OFFLINE REPLAY ENGINE — ZERO CREDENTIAL EVALUATION`
  - `1. Single-Asset Evaluation Results (AAPL)`
  - `2. Multi-Asset Universe Portfolio Evaluation Results (AAPL + NVDA + SPY)`
  - `Token LLM Cost:        $0.00 (100% Offline / Deterministic)`
  - `✓ Full single-asset and multi-asset replay completed successfully under 15.0s SLA.`
- **Capture Proof.** Save CLI stdout to `artifacts/verify-committee/replay-cli.log`:
  ```bash
  mkdir -p artifacts/verify-committee
  pnpm demo:replay > artifacts/verify-committee/replay-cli.log 2>&1
  ```

## Gotchas

- Do not set external live broker or LLM flags when running offline replay.
- The replay CLI loads frozen local JSON datasets (`AAPL.json`, `NVDA.json`, `SPY.json`) and must not attempt outbound API connections.
- Ensure the replay completes in under the 15,000ms SLA threshold.
