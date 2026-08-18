# Portfolio Strategy Analysis — QuantAgent / The Committee

*Date: August 14, 2026. Analysis of the project's portfolio value, market positioning, and a recommended path forward.*

---

## 1. Bottom Line

Do not abandon the project, but abandon its current headline:

> "I built a multi-agent AI trading bot."

That framing is common, hard to validate, and insufficiently differentiated. The repository contains the foundations of a stronger project:

> "I built a reproducible observability and evaluation platform for testing agentic decisions under strict point-in-time constraints."

**Recommendation:** keep the existing codebase, but pivot toward an **AI Decision Observatory / Agent Evaluation Lab**. Finance becomes the difficult benchmark domain — not the entire identity of the product. Do **not** build a full brokerage or a general Polymarket clone.

---

## 2. Candid Assessment

The original idea was partly an agent-suggested project adopted before it was fully understood. That does not make it worthless. The important question is whether the implementation now contains genuine engineering judgment. It does.

### 2.1 What the codebase does well (genuine engineering judgment)

- **Point-in-time `as_of` timestamps** — the primary mechanism preventing look-ahead bias in backtests.
- **Deterministic computation** — indicators and financial numbers are computed in code, never invented by an LLM.
- **Schema validation around untrusted LLM output** — raw model text must validate against a Zod schema.
- **Failure isolation** — agent timeouts degrade to a neutral "no opinion", never a crash.
- **Parallel execution** — `Promise.allSettled` for concurrent agent runs.
- **Credential security** — encrypted Alpaca key storage with per-field nonces and AAD binding.
- **Transparent quant implementation** — hand-written pandas/numpy indicators (SMA-seeded EMA, Wilder RSI, population-stdev Bollinger) with pinned conventions.
- **Honest documentation of known gaps** — deferred work and contract gaps are explicitly recorded rather than hidden.

These are not superficial "call three models and print opinions" choices. They show the right engineering concerns are being learned.

### 2.2 What is currently missing (the product is not yet provable)

The repository does not yet prove the product described in the PRD:

| Gap | Status | Evidence |
|---|---|---|
| Portfolio endpoint returns placeholder (empty) state | Unimplemented | `apps/api/src/portfolio/service.ts` |
| `POST /agents/run` passes empty bars / null indicators | Broken chain | `apps/api/src/agents/plugin.ts:88-96` |
| `QUANT_SERVICE_URL` configured but never consumed | Broken chain | `apps/api/src/config.ts:23` |
| `/agents/latest` envelope vs. frontend bare `AgentOutput` | Contract mismatch | `apps/api/src/agents/plugin.ts:62`, `apps/web/src/lib/api.ts:227` |
| `/portfolio/history` requested by UI, no backend route | Missing route | `apps/web/src/lib/api.ts:221` |
| Hard risk gate, consensus/debate, memory, execution, ablations | Not implemented | `packages/contracts/src/index.ts`, `packages/db/src/schema/stubs.ts` |
| DB-backed tests skip without Postgres | Infrastructure proof incomplete | `specs/sprint-1/FOLLOW-UPS.md:104` |
| No ingest → quant → agent → dashboard integration test | Missing | — |
| Report says Argon2; code uses bcrypt | Doc inaccuracy | `docs/FEASIBILITY_AND_STRATEGY_REPORT.md:60` vs `apps/api/src/auth/service.ts` |
| Report calls contracts a 1.0.0 npm package; it's a private 0.1.0 internal package | Doc inaccuracy | `packages/contracts/package.json:3` |

### 2.3 Scoring summary

| Dimension | Score |
|---|---|
| Engineering foundation | 7.5/10 |
| Sprint 1 implementation | 6.5/10 |
| End-to-end proof | 3/10 |
| Current differentiation | 4/10 |
| Current portfolio readiness | 6/10 |
| Potential after a focused pivot | 8–9/10 |

**Interpretation:** a strong foundation with an overstated product narrative.

---

## 3. Market Comparison of the Four Directions

### 3.1 Generic Multi-Agent Stock Trading Bot — weakest framing

Popular open-source saturation is high:

- [TradingAgents](https://github.com/TauricResearch/TradingAgents) — specialist agents, research, debate, risk, portfolio (created Dec 2024; ~98k stars).
- [ai-hedge-fund](https://github.com/virattt/ai-hedge-fund) — explicitly educational, makes no real trades (~63k stars).
- [AI-Trader](https://github.com/HKUDS/AI-Trader), [QuantDinger](https://github.com/OpenByteInc/QuantDinger), [AutoHedge](https://github.com/The-Swarm-Corporation/AutoHedge) — further examples.
- [TradingAgents paper](https://arxiv.org/abs/2412.20138) — makes the specialist/debate/risk architecture familiar.

Another "N agents analyze stocks" project will look like an implementation exercise unless it proves something rigorous. The README of TradingAgents itself emphasizes that performance depends on model choice, temperature, data quality, and non-determinism — weakening the value of a merely pretty backtest curve.

**Differentiation must come from:** did agents beat a deterministic baseline? Did debate/memory actually help? What did it cost in latency/tokens? Does the result survive point-in-time evaluation? What fails under agent timeouts?

### 3.2 AI Decision Observatory / Evaluation Platform — strongest direction

The agent-engineering market is moving from "can we make agents?" toward tracing, evaluation, regression testing, cost/latency measurement, and reliability:

- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — add agentic complexity only when it measurably improves outcomes; evaluate comprehensively.
- [LangChain State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering) — observability and evaluation are becoming standard concerns for teams deploying agents.
- [LangSmith observability concepts](https://docs.smith.langchain.com/observability/concepts) — runs, traces, threads, feedback, evaluation.
- [Langfuse](https://github.com/langfuse/langfuse) — open-source LLM observability/eval platform (~33k stars).
- [OpenTelemetry GenAI conventions](https://github.com/open-telemetry/semantic-conventions-genai) — standardized generative-AI telemetry is active engineering.
- [Stanford AI Index 2025 (Economy)](https://hai.stanford.edu/ai-index/2025-ai-index-report/economy) — rising organizational AI adoption; generative-AI skill demand trending up (Lightcast data: ~66k US postings mentioning gen-AI skills in 2024 vs ~16k in 2023).

Finance is an ideal benchmark workload because it makes evaluation genuinely hard: data has availability timestamps, backtests can leak future information, LLM output is nondeterministic, and "made money" is not evidence without leakage control. A credible result can be:

> "The debate stage increased agreement but did not improve risk-adjusted returns."

That is a stronger engineering result than "our AI hedge fund returned 17% in backtesting."

### 3.3 Full-Fledged Stock / Trading Platform — poor scope

- Real requirements: account/position ledgers, order state machines, simulated fills, data normalization, corporate actions, reconciliation, permissions, audit logs, risk controls, security, recovery.
- Alpaca's [paper-trading docs](https://docs.alpaca.markets/docs/paper-trading) note simulated results do not model market impact, latency slippage, queue position, or liquidity.
- A "full-fledged brokerage" claim invites questions the implementation cannot answer.

Possible only as a narrower "paper-trading platform," and even then less distinctive unless it includes the evaluation/observability thesis.

### 3.4 Polymarket / Prediction-Market Clone — distinctive but high risk

- Requires: market creation, liquidity provision, order book or AMM, matching/cancellation, positions/balances, resolution rules, oracle behavior, settlement, dispute handling, replayable events.
- Product complexity: [Polymarket docs](https://docs.polymarket.com/polymarket-101), [Kalshi API](https://docs.kalshi.com/welcome), [Kalshi demo env](https://docs.kalshi.com/getting_started/demo_env).
- Regulatory risk: [CFTC Polymarket enforcement action](https://www.cftc.gov/PressRoom/PressReleases/8478-22) (Jan 2022, $1.4M penalty for unregistered off-exchange event contracts). A university project must remain clearly **simulated** — no real-money deposits, withdrawals, or settlement.

A simulated prediction market is a legitimate distributed-systems project, but it abandons most of the current Sprint 1 work and carries a different core thesis. Choose it only if genuinely more interested in market microstructure than in agentic systems.

---

## 4. Comparison Summary

| Direction | Differentiation | Engineering depth | Feasibility | Recruiter clarity | Risk |
|---|---:|---:|---:|---:|---:|
| Generic multi-agent trading bot | Low | Medium-high | High | High | Medium |
| AI decision observatory | High | High | Medium-high | High | Medium |
| Full stock/trading platform | Low-medium | High | Low-medium | High | High |
| Simulated Polymarket clone | Medium-high | High | Medium | Medium-high | High |
| **Observatory using finance as a workload** | **Very high** | **Very high** | **Medium-high** | **Very high** | **Medium** |

---

## 5. Recommended Product

> **A reproducible platform for evaluating agentic decisions against deterministic baselines under point-in-time data constraints.**

Finance is the first benchmark workload. There is no claim of market prediction. The platform answers questions like:

1. Does a technical LLM agent outperform a simple moving-average strategy?
2. Does adding sentiment improve decisions after transaction costs?
3. Does debate improve consistency or only increase token cost?
4. Does memory improve decisions or introduce stale information?
5. Does the system stay correct when an agent times out?
6. Do apparent gains disappear when future information is removed?
7. Which model, prompt, or data source produced each decision?
8. Can another person reproduce a result from a stored experiment manifest?

**Core thesis:**

> Agentic complexity should be justified by measured improvement — not assumed to be valuable because it sounds intelligent.

---

## 6. Concrete Scope

### 6.1 Must build

1. **One complete vertical slice** — historical price data → deterministic indicators → one technical agent → one deterministic baseline → one backtest → one stored experiment → one dashboard comparison.
2. **Experiment runner** — captures dataset version, model/prompt version, agent configuration, decision timestamp, input snapshot, output, latency, token/estimated cost, error state.
3. **Point-in-time enforcement** — reject facts with `as_of > decision_ts`, test the rejection explicitly, surface rejected future facts in the UI as a data-quality event.
4. **Baseline comparison** — buy-and-hold, simple SMA/RSI strategy, LLM strategy; transaction costs and slippage assumptions; Sharpe/Sortino, max drawdown, total return, trade count, cost, latency.
5. **Ablation view** — toggle agents, debate, news, and model/prompt versions independently and show metric deltas.
6. **Replayable trace** — every decision inspectable from input facts to final output; one click per run tells the whole story.
7. **One-command demo** — seed local data, run an offline experiment, start the app, and populate the dashboard **without** Alpaca or Anthropic credentials.

### 6.2 Defer

- Real Alpaca execution
- Telegram bot
- Episodic memory
- Multiple market domains
- PMXT / Polymarket ingestion (unless a specific experiment requires it)
- Full prediction-market order matching
- Three genuinely autonomous LLM agents
- Complex React Flow pipeline visualization
- Production deployment polish
- Any claim of live profitability

The single biggest improvement: **make the system run offline from committed fixtures**, so a reviewer can verify the claim in minutes.

---

## 7. What to Do With Polymarket

Do not add Polymarket merely to sound unique. Add it later only to test a precise hypothesis:

> "Does a timestamped prediction-market probability improve stock-market decisions around macroeconomic events?"

If adopted, treat Polymarket as a **read-only external signal adapter** scoped to 2–3 macro events. Do not build a clone, an order-execution layer, or a generalized market mapper. If the signal does not yield a meaningful evaluation question, leave it out.

---

## 8. Final Recommendation

- **Keep** the project; the point-in-time, schema-first, deterministic-foundation engineering is worth preserving.
- **Reposition** the product as an AI Decision Observatory / Agent Evaluation Lab.
- **Finance** is the benchmark domain, point-in-time correctness the technical foundation, evaluation and ablation the core contribution, observability the product surface.
- **Trading** is a controlled workload, not the claim; **profitability** is one metric, not the definition of success.
- The project stands out when its demo shows a surprising, **reproducible** result and explains *why* — not because it has more agents, more charts, or a Polymarket integration.

---

## 9. Sources

### Market / hiring signals
- Anthropic — Building Effective Agents: https://www.anthropic.com/research/building-effective-agents
- LangChain — State of Agent Engineering: https://www.langchain.com/state-of-agent-engineering
- LangSmith — Observability concepts: https://docs.smith.langchain.com/observability/concepts
- Langfuse: https://github.com/langfuse/langfuse
- OpenTelemetry GenAI semantic conventions: https://github.com/open-telemetry/semantic-conventions-genai
- Stanford AI Index 2025 — Economy: https://hai.stanford.edu/ai-index/2025-ai-index-report/economy
- Lightcast — Generative AI Job Market 2025: https://lightcast.io/resources/blog/the-generative-ai-job-market-2025-data-insights
- LinkedEconomic Graph — Talent infrastructure powering AI transformation: https://economicgraph.linkedin.com/blog/understanding-the-talent-infrastructure-powering-ai-transformation

### Saturation / popularity
- TradingAgents: https://github.com/TauricResearch/TradingAgents · paper: https://arxiv.org/abs/2412.20138
- ai-hedge-fund: https://github.com/virattt/ai-hedge-fund
- AI-Trader: https://github.com/HKUDS/AI-Trader
- QuantDinger: https://github.com/OpenByteInc/QuantDinger
- AutoHedge: https://github.com/The-Swarm-Corporation/AutoHedge
- Polymarket/agents (archived): https://github.com/Polymarket/agents

### Trading / brokerage constraints
- Alpaca Market Data API: https://docs.alpaca.markets/docs/about-market-data-api
- Alpaca Paper Trading: https://docs.alpaca.markets/docs/paper-trading
- FINRA broker-dealer registration: https://www.finra.org/registration-exams-ce/broker-dealers/registration-forms/form-bd

### Prediction markets / regulation
- Polymarket 101: https://docs.polymarket.com/polymarket-101
- Polymarket docs: https://docs.polymarket.com/
- Kalshi API: https://docs.kalshi.com/welcome
- Kalshi demo environment: https://docs.kalshi.com/getting_started/demo_env
- CFTC — Understanding prediction markets: https://www.cftc.gov/LearnandProtect/PredictionMarkets
- CFTC — Polymarket enforcement action: https://www.cftc.gov/PressRoom/PressReleases/8478-22

### Repository evidence
- PRD: `PRD.md`
- Feasibility & strategy report: `docs/FEASIBILITY_AND_STRATEGY_REPORT.md`
- Sprint 1 gaps: `specs/sprint-1/FOLLOW-UPS.md`
- Agent pipeline: `apps/api/src/agents/plugin.ts`
- Portfolio reads: `apps/api/src/portfolio/plugin.ts`
- Frontend API client: `apps/web/src/lib/api.ts`
- Contracts package: `packages/contracts/package.json`
- Auth hashing: `apps/api/src/auth/service.ts`
- Credential crypto: `apps/api/src/credentials/crypto.ts`
- Point-in-time logic: `apps/api/src/ingest/as-of.ts`
- Backtest skeleton: `apps/quant/app/backtest/runner.py`

*Note: star counts and survey percentages are volatile snapshots (August 2026) or vendor research with proprietary definitions — directional signals, not exact statistics.*