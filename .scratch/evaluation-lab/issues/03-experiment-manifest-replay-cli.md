# 03 — Experiment Manifest Engine & Zero-Credential Offline Replay CLI

**What to build:** The core evaluation orchestrator (`runExperiment`) and immutable JSON manifest generator. A single CLI command (`pnpm demo:replay`) executes a full 1-year historical backtest evaluation across deterministic baselines and recorded agent runs using frozen fixtures in under 3.0 seconds at $0.00 cost without requiring API credentials or database infrastructure.

**Blocked by:** 02 — Pure TypeScript Indicator Engine & Deterministic Baselines

**Status:** done

- [x] `runExperiment` orchestrator takes a strategy configuration and frozen dataset fixture and coordinates the backtest run.
- [x] Immutable `ExperimentManifest` JSON is generated and persisted, capturing `id`, `createdAt`, `gitCommit`, `datasetHash`, strategy parameters, returns, Sharpe, Sortino, MaxDD, and trade counts.
- [x] Replay CLI command `pnpm demo:replay` executes the benchmark run for AAPL (2023–2024) and outputs summary performance tables in terminal stdout.
- [x] Replay run completes in $< 3.0$ seconds without external network requests or missing credential errors.
- [x] Manifest and evaluation schemas are defined in `packages/contracts` and exported for use in frontend and backend.
- [x] Replay mode accurately computes delta in Sharpe and Return between strategies and the Buy & Hold benchmark.
