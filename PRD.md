# PRD — The Committee: A Multi-Agent Paper-Trading Reference System

*Synthesized from our full conversation. No issue tracker is connected for this project, so this is delivered as a document rather than published — copy the Feature Breakdown into whatever board your team uses.*

---

## Problem Statement

Students building agentic AI projects almost always end up with a single model making an isolated call — no disagreement, no memory, no checkpoint for a human to intervene. There's no accessible, well-evaluated reference implementation showing how a *structured* multi-agent decision process — specialists, debate, a hard risk gate, persistent memory — actually gets built end to end, or whether that structure meaningfully outperforms a single model guessing alone.

## Solution

A multi-agent paper-trading platform: three specialist agents (technical, sentiment, fundamental) independently analyze an asset; when they disagree, a debate/synthesis step resolves it and preserves the dissent; a deterministic risk gate — never an LLM — approves or blocks the trade against hard constraints; an allocator sizes the position; approved trades execute against Alpaca's paper API. Every input, argument, and outcome is logged. A layered memory system (short-term, episodic, long-term) feeds prior context back into every new decision. The system is evaluated, not just demoed — backtested with strict point-in-time data discipline against buy-and-hold and rule-based baselines, with ablations showing whether debate and memory actually help.

---

## User Stories

**Authentication & Platform Access**
1. As a user, I can register and log in securely so my portfolio and history stay private.
2. As a user, I can connect my Alpaca paper-trading API keys so the system can execute on my behalf.
3. As a returning user, my session persists across reloads so I don't re-authenticate constantly.

**Portfolio & Watchlist**
4. As a researcher, I see the paper portfolio (positions, cash, P&L) at a glance.
5. As a researcher, I can manage a watchlist so agents focus on assets I care about.
6. As a researcher, I can view portfolio value over time to evaluate cumulative performance.

**Data & Signals**
7. As a researcher, I see price data alongside agent outputs, each stamped with the moment it became knowable.
8. As a researcher, I see computed technical indicators (RSI, MACD, Bollinger Bands, MAs) per asset.
9. As a researcher, curated headlines are ingested and sentiment-scored so I see what feeds the sentiment agent.
10. As a researcher, company profiles and factual context are stored, embedded, and retrievable so the fundamental agent can ground its reasoning.
11. As a researcher, I can trace per-asset signal history before each decision.
12. As a developer, no stored fact is ever readable by an agent past its own decision timestamp.

**Agent Reasoning & Debate**
13. As a researcher, I see each agent's structured output (bias, confidence, rationale) per cycle.
14. As a researcher, the fundamental agent emits bull/bear/neutral signals grounded in retrieved context, not free recall.
15. As a researcher, the sentiment agent emits a score and rationale from ingested headlines.
16. As a researcher, the technical agent emits a bias and confidence from deterministically computed indicators.
17. As a researcher, when two of three agents already agree, the system proceeds without spending an extra LLM call.
18. As a researcher, when agents disagree, I can observe the full debate (arguments, synthesis, resolution).
19. As a researcher, the final decision record preserves the winning rationale and every dissenting view.

**Risk & Allocation**
20. As a risk-conscious user, the risk agent blocks trades that violate position, concentration, or stop-loss rules, regardless of how confident the debate outcome was.
21. As a researcher, the allocator recommends a position size using an explainable, non-LLM rule.
22. As a risk-conscious user, trades above a threshold require explicit human approval.

**Execution & Orders**
23. As a researcher, approved recommendations submit as paper trades via Alpaca.
24. As a researcher, I can audit full order history with execution details.
25. As a researcher, failed or rejected orders are logged with reasons.

**Memory & Reflection**
26. As a researcher, short-term memory (recent trades, open positions, recent debates) feeds every new cycle.
27. As a researcher, long-term memory (company facts, persistent rules) survives across sessions.
28. As a researcher, episodic weekly summaries capture recurring patterns, once the core pipeline is stable.
29. As a researcher, a post-trade reflection agent reviews each filled trade and records what worked or didn't, flagging contradictions (e.g., sentiment was bullish but price fell).

**Dashboard & Observability**
30. As a user, the homepage shows portfolio state, recent agent activity, and active alerts.
31. As a user, a read-only pipeline diagram highlights the active stage during a run.
32. As a user, an agent configuration panel lets me enable/disable agents and tune thresholds.
33. As a user, debate transcripts read as threaded conversations, not raw logs.
34. As a user, an end-of-day summary gives me a digest without reviewing every trade.

**Evaluation (new — not in the original PRD, and the project's core differentiator)**
35. As a researcher, I can run the pipeline against a historical window and get a full metrics tearsheet (Sharpe, Sortino, max drawdown, win rate) rather than a single return number.
36. As a researcher, I can compare the full system against buy-and-hold and a simple rule-based baseline on the same window.
37. As a researcher, I can toggle debate and memory off independently and see the resulting metric deltas, to know whether the added structure actually helps.
38. As a developer, a specific test fails if any backtest run ever used data timestamped after its own decision point.

**Telegram Bot**
39. As a mobile user, I get buy/sell/hold alerts with short debate summaries.
40. As a mobile user, `/portfolio` and `/latest` commands return current status.
41. As a mobile user, an EOD recap is pushed automatically.
42. As a risk-conscious user, the bot can ask for approval before high-risk trades (stretch — see Out of Scope).

**System Quality**
43. As a developer, all agent inputs/outputs follow a consistent, validated schema so agents are interchangeable and testable.
44. As a developer, every pipeline run produces structured, queryable logs.
45. As a developer, one failing agent times out gracefully and does not crash the run.
46. As a developer, the stack deploys via Docker Compose with minimal local setup.

---

## Implementation Decisions

**Architecture — seven layers plus two cross-cutting concerns**, in the order data flows:

- **L0 Data Layer** — ingests and timestamps prices, news, fundamentals. Every record carries an as-of timestamp; this is the single mechanism preventing look-ahead bias, and it must exist from the first commit, not be retrofitted.
- **L1 Signal Layer** — deterministic indicator computation (RSI, MACD, Bollinger, MAs) and portfolio-state math. No LLM involvement, ever — this layer's output is treated as ground truth by everything above it.
- **L2 Agent Layer** — three specialists (technical, sentiment, fundamental), each constrained to a fixed output schema (direction, confidence, rationale). Raw model text is untrusted until it validates against the schema.
- **L3 Consensus Layer** — a cheap deterministic agreement check first (2-of-3 majority); only on disagreement does a single LLM synthesis call run, producing a resolved decision plus a preserved dissent record. This replaces a multi-round negotiation protocol for the MVP — cheaper, faster to build, and still captures the debate's information value.
- **L4 Risk Layer** — a deterministic rules engine (position limits, concentration, stop-loss), deliberately not an LLM. It can be satisfied or violated, never persuaded.
- **L5 Allocation Layer** — an explainable, non-LLM sizing rule (equal-weight or conviction-weighted).
- **L6 Execution Layer** — Alpaca paper order submission and fill tracking; execution outcomes are written back to L0 as new facts.
- **Memory (cross-cutting)** — short-term/episodic/long-term tiers, queried into L2 and L3 on every run; a feedback loop, not a passive store.
- **Orchestrator (outer frame)** — a state machine owning the pipeline run: fires L2 agents in parallel, isolates per-stage failures (a timed-out agent yields a neutral "no opinion," not a crash), and logs every run with a replayable ID.

**Stack split:** the Node/TypeScript + Drizzle + Zod + Postgres backend (as originally proposed) stays for orchestration, API, and the web app. A **separate Python quant service** is added for indicator computation, backtesting, and evaluation, since that tooling ecosystem (`pandas-ta`, `vectorbt`, `pyfolio`/`quantstats`, and optionally `FinRL`) is overwhelmingly Python-based; the two services talk over internal HTTP. `pgvector` on the existing Postgres instance backs the fundamental agent's retrieval store rather than a separate vector database.

**Facts-vs-narration rule (applies everywhere):** any number that can be computed deterministically (prices, indicators, P&L, returns) must be computed in code, never generated or restated by an LLM. LLMs only ever reason over and narrate already-computed facts.

**Mitigating the single-point-of-failure risk:** the agent framework (F5-equivalent) ships with stub/mock agents in the first days of Sprint 1, so downstream work (dashboard, watchlist, risk gate) isn't blocked on the real agent implementations landing.

---

## Team & Sprint Feature Breakdown

Four roles, chosen so each owns a distinct architectural slice with no shared files or overlapping responsibility:

| Member | Role | Owns |
|---|---|---|
| **M1** | Agent Architecture Lead | The reasoning core: agent framework, the agents themselves that require framework-level decisions, debate, orchestration, memory |
| **M2** | Data, Quant & Evaluation Engineer | Everything upstream of agents (data, indicators, retrieval) and everything that judges the result (backtesting, evaluation, reporting) |
| **M3** | Frontend & Visualization Engineer | All UI — dashboard, transcripts, diagrams, config panel. Zero backend logic. |
| **M4** | Platform, Risk & Execution Engineer | Everything from "decision approved" to "trade in the world," plus auth, database, and deployment |

This is a deliberate change from a naive split: in the original draft, one person ended up owning agent framework, two agents, debate, orchestration, memory, *and* reflection — nine of the hardest, most interdependent features. Here, M1's scope is trimmed to exactly the framework-level work; the fundamental agent moves to M2 (it's tightly coupled to the RAG store M2 already owns), and allocation/execution/reflection move to M4 (they're a single coherent "decision → action → outcome" chain).

### Sprint 1 — Foundation (walking skeleton)

| Feature | Owner |
|---|---|
| User Auth & Session Management | M4 |
| Database Schema & Core Models (point-in-time fields from day one) | M4 |
| Market Data Ingestion Service | M2 |
| Technical Indicator Engine | M2 |
| Backtesting Harness Skeleton (Python quant service scaffold) | M2 |
| Agent Framework & Base Interface + stub agents | M1 |
| Technical Analyst Agent (first real agent) | M1 |
| Dashboard Shell & Portfolio View | M3 |

*Deliverable: login works, data flows in with timestamps, the technical agent produces real output, the dashboard renders it, and the backtest harness exists (even if empty) so it's never a Sprint 3 scramble.*

### Sprint 2 — The Committee (agent pipeline & debate)

| Feature | Owner |
|---|---|
| News/Headline Ingestion | M2 |
| Company Profile & RAG Context Store (`pgvector`) | M2 |
| Fundamental Analyst Agent | M2 |
| Sentiment Agent | M1 |
| Debate & Consensus Engine (2-of-3 check + synthesis call) | M1 |
| Agent Orchestration Pipeline (parallel run, per-stage error isolation) | M1 |
| Risk Manager Agent & Approval Gate | M4 |
| Watchlist Management UI | M3 |

*Deliverable: the full committee runs end to end. Debate fires on disagreement. The risk gate blocks unsafe trades. Every run is logged.*

### Sprint 3 — Memory, Execution & Evaluation

| Feature | Owner |
|---|---|
| Layered Memory System (short-term, long-term; episodic deferred) | M1 |
| Portfolio Allocator Agent | M4 |
| Paper Trade Execution via Alpaca | M4 |
| Post-Trade Reflection Agent | M4 |
| Evaluation & Ablation Suite (baselines, walk-forward, debate/memory on-off deltas) | M2 |
| Agent Output & Debate Transcript UI | M3 |
| Pipeline Visualization (read-only, React Flow) | M3 |
| Signal History & Asset Detail Page | M3 |

*Deliverable: trades actually execute, memory shapes new decisions, and — the part most teams skip — you have a real, honest answer to "does the extra structure help?"*

### Sprint 4 — Interface, Reporting & Hardening

| Feature | Owner |
|---|---|
| Telegram Alert Bot (read-only alerts; approve/reject only if ahead of schedule) | M4 |
| Agent Configuration Panel | M3 |
| End-of-Day Performance Summary (cron report) | M2 |
| Episodic Memory Summarization (stretch, only if ahead) | M1 |
| Integration testing & E2E (pipeline, agent contracts, API) | All |
| Docker Compose Deployment | M4 |
| Documentation & README | All |
| Demo Preparation | All |

*Deliverable: a demo-ready system with alerts, configurability, daily reports, and test coverage.*

**Per-member totals across all four sprints:** M1 — 6 core features; M2 — 8; M3 — 6; M4 — 8 (plus each member's share of the all-hands Sprint 4 items). The split isn't perfectly even by count, but it is even by *coherence* — nobody touches another member's files, and each person's features form one understandable story (M1: the mind; M2: the senses and the scorecard; M3: the face; M4: the hands and the guardrails).

---

## Testing Decisions

- Unit-test each agent against fixed inputs for schema validity and plausible output bounds — never assert on exact LLM wording.
- Integration-test the pipeline with recorded/mocked LLM responses so CI doesn't flake on model non-determinism or burn API budget.
- Test the backtesting harness against synthetic price series with a hand-computed expected outcome (e.g., a series with a known SMA-crossover point), so indicator or backtest bugs surface immediately rather than as suspiciously good results later.
- Explicitly test pipeline resilience: simulate one agent timing out and confirm the run still completes with a neutral output for that agent.
- A dedicated point-in-time integrity test: fail if any stored signal, agent output, or backtest result references data timestamped after its own decision point.
- Test encrypted-at-rest storage of Alpaca credentials.

---

## Out of Scope

- Real-money trading of any kind — paper trading only, permanently.
- High-frequency or intraday microsecond-level strategies — the system reasons on daily/hourly bars, not tick data.
- Multi-round adversarial debate protocols — the MVP uses a single synthesis call on disagreement; a fuller negotiation protocol is a stretch item only if Sprints 1–3 finish early.
- An RL-trained allocator as the default — the rule-based allocator is the baseline; an RL arm (via FinRL) is an optional ablation, not a dependency.
- Telegram approve/reject interactivity by default — ships read-only first; the pending-trade state machine needed for approve/reject is a distinct, non-trivial feature and only attempted with time to spare.
- Full MCP-native tool architecture for the MVP — ad-hoc typed function calls are sufficient; migrating to MCP servers is a stretch goal, not a blocker.
- Any claim that this system predicts markets or should inform real investment decisions.

---

## Further Notes

- The architecture closely parallels existing published multi-agent trading systems (specialist agents, debate rounds, risk gates, layered memory). That's expected and fine — the project's distinguishing contribution is the evaluation harness (Sprint 3, "Evaluation & Ablation Suite") and the point-in-time discipline (baked in from Sprint 1), not architectural novelty.
- Budget LLM calls explicitly: at minimum 3 calls per pipeline run (one per agent) plus 0–2 for debate synthesis. Use a cheap/fast model tier for the three agents and a stronger tier only for debate synthesis and reflection, where reasoning quality matters most.
- If a project name is chosen publicly, avoid "QuantAgent" — it collides with an existing arXiv paper title.
