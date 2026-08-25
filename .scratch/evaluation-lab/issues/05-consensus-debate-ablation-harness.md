# 05 — Consensus Short-Circuit & Conditional Debate vs. Neutral Ablation Harness

**What to build:** Multi-agent decision coordinator that reconciles Technical and Sentiment specialist signals. When specialists agree on directional bias, fast-passes the signal immediately (0 extra tokens). When specialists disagree, branches conditionally: invokes a single-pass LLM debate synthesis step if debate is enabled (Debate ON), or falls back to a deterministic neutral stance (`bias: neutral, confidence: 0.0` / Abstain) if debate is disabled (Debate OFF control). Records full input/output lineage for every decision.

**Blocked by:** 04 — Point-in-Time Sentiment Specialist & Failure Isolation

**Status:** completed

- [x] Consensus short-circuit detects matching directional bias between Technical and Sentiment specialists and emits final signal without additional LLM synthesis calls.
- [x] Debate Mode (ON): When specialists disagree, triggers a structured single-pass LLM synthesis prompt providing both specialist arguments, outputting reconciled bias, confidence, rationale, and dissenting view.
- [x] Ablation Mode (OFF): When specialists disagree and debate is disabled, deterministically defaults to neutral signal (`bias: neutral, confidence: 0.0`), preventing position changes.
- [x] Decision Lineage Recorder captures point-in-time state: input bar window, indicators, news items, prompt texts, raw LLM completions, parsed schemas, and execution fills.
- [x] Manifest calculates decision intelligence metrics: Directional Accuracy (% correct direction), Brier Score (calibration MSE on active trades), and Abstention Quality (market return during neutral vs active periods).
- [x] Unit tests verify consensus short-circuiting, debate synthesis triggering, and neutral fallback ablation behavior.
