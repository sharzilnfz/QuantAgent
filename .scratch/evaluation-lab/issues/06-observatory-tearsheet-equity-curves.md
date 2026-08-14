# 06 — Observatory Comparison Tearsheet & Equity Curves

**What to build:** Web application dashboard in `apps/web` displaying a side-by-side Experiment Comparison Matrix and interactive comparative equity curve charts. Enables researchers to visually compare LLM agent strategies (Single Specialist, Consensus, Debate ON, Debate OFF) against Buy & Hold and SMA/RSI deterministic baselines across financial metrics (Total Return, Sharpe, Sortino, MaxDD) and operational metrics (Token Cost, Latency, Fallback Rate).

**Mandatory Pre-Design Gate:**
- **MUST** invoke and follow the `/impeccable` skill before authoring UI components.
- Run `node .agents/skills/impeccable/scripts/context.mjs --target apps/web/src/routes/observatory.tsx`.
- Use **`Operate` mode** (optimized for scanability, financial precision, data density, typography tracking, and native layout expectations).
- Adhere strictly to the craft floor: no cliché dashboard tropes, no textureless surfaces, thoughtful typography, and fluid responsive containers.

**Blocked by:** 05 — Consensus Short-Circuit & Conditional Debate vs. Neutral Ablation Harness

**Status:** completed

- [x] Run `/impeccable` setup and align visual tokens and layout hierarchy before writing UI code.
- [x] Experiment Tearsheet view renders side-by-side comparison table across all evaluated strategy variants and deterministic baselines.
- [x] Displays computed deltas for Total Return, Sharpe Ratio, Sortino Ratio, Max Drawdown, and Brier Score relative to Buy & Hold.
- [x] Multi-series time-series equity curve chart (Recharts) renders strategy growth vs. Buy & Hold and SMA/RSI baselines with drawdown visualization.
- [x] Strategy selector allows toggling between different evaluation runs or ablation experiments (e.g. Debate ON vs Debate OFF).
- [x] UI components consume live/replayed API manifest JSON data without hardcoded static mocks.
- [x] Responsive layout adapts cleanly with accessible color contrast, clear visual hierarchy, and high data density.
