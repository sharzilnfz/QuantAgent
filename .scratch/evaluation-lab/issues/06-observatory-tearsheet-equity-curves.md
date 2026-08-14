# 06 — Observatory Comparison Tearsheet & Equity Curves

**What to build:** Web application dashboard in `apps/web` displaying a side-by-side Experiment Comparison Matrix and interactive comparative equity curve charts. Enables researchers to visually compare LLM agent strategies (Single Specialist, Consensus, Debate ON, Debate OFF) against Buy & Hold and SMA/RSI deterministic baselines across financial metrics (Total Return, Sharpe, Sortino, MaxDD) and operational metrics (Token Cost, Latency, Fallback Rate).

**Blocked by:** 05 — Consensus Short-Circuit & Conditional Debate vs. Neutral Ablation Harness

**Status:** ready-for-agent

- [ ] Experiment Tearsheet view renders side-by-side comparison table across all evaluated strategy variants and deterministic baselines.
- [ ] Displays computed deltas for Total Return, Sharpe Ratio, Sortino Ratio, Max Drawdown, and Brier Score relative to Buy & Hold.
- [ ] Multi-series time-series equity curve chart (Recharts) renders strategy growth vs. Buy & Hold and SMA/RSI baselines with drawdown visualization.
- [ ] Strategy selector allows toggling between different evaluation runs or ablation experiments (e.g. Debate ON vs Debate OFF).
- [ ] UI components consume live/replayed API manifest JSON data without hardcoded static mocks.
- [ ] Responsive layout adapts cleanly with accessible color contrast and data density.
