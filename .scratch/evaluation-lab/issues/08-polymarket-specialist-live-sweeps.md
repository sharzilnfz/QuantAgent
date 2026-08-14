# 08 — Macro Prediction Market Specialist (Polymarket) & Bounded Live Sweeps

**What to build:** An optional Macro Prediction Market Specialist agent that consumes Polymarket crowdsourced probability distributions on macroeconomic events (e.g., FOMC rate hikes, CPI reports) timestamped strictly $\le T$, providing a testable ablation against news sentiment alone. A live evaluation harness that executes budget-capped $N=3$ variance sweeps over a focused validation window (20–30 decision points) to measure nondeterministic LLM variance within a strict $< \$5.00$ API budget.

**Blocked by:** 07 — Decision Lineage DAG Inspector & Telemetry HUD

**Status:** completed

- [x] Prediction Market Agent evaluates Polymarket Gamma API historical probability curves strictly $\le T_{\text{decision}}$.
- [x] Ablation switch allows comparing Technical + Sentiment + Polymarket vs Technical + Sentiment alone to measure macro odds value-add.
- [x] Live evaluation harness executes $N=3$ runs across a budget-capped validation window (20–30 decision points) and calculates mean, standard deviation, and variance across runs.
- [x] Total spend is capped with hard budget limit enforcing cumulative cost $< \$5.00$ per sweep.
- [x] Observatory UI displays variance bands across live runs alongside deterministic baseline overlays.
