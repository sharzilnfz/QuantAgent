# 04 — Point-in-Time Sentiment Specialist & Failure Isolation

**What to build:** A dedicated news sentiment specialist agent evaluating Benzinga news headlines timestamped strictly $\le T_{\text{decision}}$. Enforces strict Zod output contract validation (`bias`, `confidence`, `rationale`) and graceful failure degradation to neutral (`bias: neutral, confidence: 0.0`) on timeouts, rate limits, or malformed LLM completions without crashing the evaluation pipeline.

**Blocked by:** 03 — Experiment Manifest Engine & Zero-Credential Offline Replay CLI

**Status:** ready-for-agent

- [ ] Sentiment Specialist Agent accepts point-in-time filtered news headlines ($\text{created\_at} \le T$) and evaluates market sentiment.
- [ ] Output is validated against Zod schema (`bias: 'bullish' | 'bearish' | 'neutral'`, `confidence: number` between 0 and 1, `rationale: string`).
- [ ] Agent timeout, schema parse error, or network interruption gracefully degrades to `{ bias: 'neutral', confidence: 0.0, rationale: '<fallback error>' }`.
- [ ] Fallback events are tracked in telemetry counters without halting the evaluation loop.
- [ ] Replay mode supports pre-recorded sentiment agent responses for zero-credential benchmark runs.
- [ ] Live mode invokes Anthropic Claude API using structured outputs when API credentials are provided.
