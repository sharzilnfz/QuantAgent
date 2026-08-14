# 07 — Decision Lineage DAG Inspector & Telemetry HUD

**What to build:** Interactive Decision Lineage Inspector and Telemetry HUD in `apps/web`. Allows users to audit any discrete decision point in an experiment by clicking a point on the chart/timeline to inspect the exact input bar window, computed indicator values, news headlines, rendered prompt text, raw LLM completion, Zod parse result, and resulting execution order. Displays operational telemetry cards for Cost per 100 Decisions ($ USD), Median Decision Latency (ms), and Schema Fallback/Error Rate.

**Blocked by:** 06 — Observatory Comparison Tearsheet & Equity Curves

**Status:** ready-for-agent

- [ ] Decision Lineage Inspector modal/drawer opens upon clicking any historical trade or decision point in the timeline.
- [ ] Displays exact historical inputs: OHLCV bar window, point-in-time indicators (RSI, SMA, MACD), and Benzinga news headlines filtered to $\le T$.
- [ ] Displays exact LLM prompt rendered for the decision, raw model completion string, and parsed Zod signal contract.
- [ ] Visualizes debate transcript showing individual specialist votes, consensus check outcome, and synthesis arguments (if debate occurred).
- [ ] Telemetry HUD displays total token expenditure, estimated API cost in USD, median inference latency in ms, and degradation/fallback rate.
- [ ] Unit tests verify inspector renders correct lineage data for selected decision points without crashing on edge cases.
