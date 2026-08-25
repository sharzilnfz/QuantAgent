# Project Direction Report — Compact Summary
*Synthesized from a multi-session strategy review (PRD → feasibility report → code-audited strategy report → this conversation). Written to be read skeptically by all four teammates, not accepted as-is. Where something is a judgment call rather than a fact, it's marked.*

---

## 1. What We're Actually Building

**One paragraph:** An evaluation environment that tests whether structured multi-agent LLM reasoning (specialists → debate → deterministic risk gate → memory) actually improves financial and prediction-market decisions over simple, deterministic baselines — under strict point-in-time data discipline (no look-ahead), with every decision reproducible and every claim of "the AI helped" backed by a measured before/after delta, not a demo.

**One-line pitch:** *"We built an environment for measuring whether AI reasoning structure earns its complexity, using finance and prediction markets as test workloads — not a trading bot, an evaluation harness."*

**What it is NOT, on purpose:**
- Not a trading bot or hedge fund — no claim of predicting or beating markets.
- Not a Polymarket clone — no order matching, no market creation, no custody of funds.
- Not a research paper or thesis — it's a working system with an honest measurement built in, sized for a university team, not a publishable contribution.

---

## 2. Why This Direction (compact rationale)

- **The base pattern (N agents debate a stock) is now extremely common.** Reference implementations sit somewhere around 60,000–100,000+ GitHub stars depending on the snapshot date, and venture money is actively flowing into the space. "We built a multi-agent trading bot" reads as a tutorial exercise to anyone technical who reviews it.
- **What's genuinely underrepresented right now is rigorous agent evaluation.** Recent 2026 hiring-signal writeups call out agentic orchestration *and* evaluation/observability as the two most underrepresented, highest-signal skills in candidate portfolios. There's now a dedicated academic workshop (RLEval, co-located with ACM's Conference on AI and Agentic Systems, May 2026) specifically about designing environments to evaluate — not just train — AI agents. This is a live, current niche, not something invented for this pitch.
- **Your Sprint 1 already independently contains the right instincts for that niche:** point-in-time (`as_of`) timestamps, deterministic math strictly overwriting LLM-authored numbers, schema-validated agent output, graceful per-agent failure isolation. These are not typical "clone" engineering choices — they're the actual hard, valuable parts.
- **But the evaluation machinery itself doesn't exist in code yet.** Risk gate, consensus/debate, memory, and the ablation suite are still unimplemented, and a code audit found the core pipeline isn't fully wired end to end (see §7). Right now you have neither a trading bot nor an evaluation environment — you have a partially-connected skeleton with some good bones. That's actually a fine place to redirect from, since nothing finished is being thrown away.

---

## 3. The Narrative Shift — very high level

**Before:** *"We built a 3-agent AI trading bot that decides buy/sell/hold."* Success = does it look impressive, did it make money in backtest.

**After:** *"We built an environment that measures whether AI reasoning structure actually improves decisions, using finance and prediction markets as bounded test domains."* Success = did we get an honest, reproducible answer — including if the answer is "no, debate didn't help."

That's the whole shift. The agents, the risk gate, the memory system — all the same components — just stop being "the product" and become "the thing being measured." The domain (finance) doesn't change. What changes is the question you're answering with it.

---

## 4. Will This Still Resonate After Sprint 2? (the durability question)

Worth naming directly, since you flagged it: a fixed "trading bot" identity tends to get less interesting over time because every sprint is just "add another feature to the same static product," and the excitement was front-loaded in the idea, not sustained by the work. An evaluation framing is structurally different — each phase answers a genuinely open question you don't know the answer to yet ("does debate help?", "does memory help?", "does a prediction-market signal help around Fed decisions?"). That's closer to curiosity-driven work than feature-shipping, and it's more likely to hold up over months.

**But this only holds if you actually run the measurements.** If the team builds all the machinery but skips actually looking at and reporting the ablation results, it quietly reverts to being a trading-bot project with a research label taped on — and that version will feel exactly as hollow in Sprint 4 as the original one would have. The resonance isn't in the *name*, it's in whether you're genuinely curious about the answer when you run the toggle. If none of you actually care whether debate helps, that's a signal worth listening to now, not after two more sprints.

---

## 5. Where Polymarket / PMXT Fits

**Verified this session:** PMXT is real, open-source (MIT license), with a public archive of free hourly historical orderbook/price snapshots across Polymarket, Kalshi, Limitless, and Opinion in Parquet format, plus Python/TypeScript SDKs. Reading historical data needs only an API key — no private keys, no custody, no on-chain signing setup, since you're not placing trades.

**How to use it — scoped, not open-ended:**
- Treat it as a **second bounded test workload**, not a second product. Same evaluation harness, different domain.
- Pick **one precise, falsifiable question**, e.g.: *"Does a timestamped prediction-market probability improve decisions around 2–3 macro events (Fed rate calls, major earnings, elections) compared to the technical/sentiment agents alone?"*
- **Do not build:** order matching, market creation, a general ticker-to-market mapper, or anything resembling a live Polymarket clone. That's a distinct, much larger project (order books, resolution/oracle logic, and — worth knowing — the CFTC has previously taken enforcement action against Polymarket over unregistered event contracts, which is a good reason to stay clearly simulated and non-monetary regardless).
- If, once you're in Sprint 3, this doesn't produce an interesting evaluation question — drop it. It's an optional extra data source for one ablation, not a milestone you're contractually bound to hit.

---

## 6. Realistic Scope for a 4-Person University Team

Your existing M1–M4 split (agent/orchestration, data/quant/eval, frontend, platform/risk/execution) still works structurally. What changes is the *definition of done* — not maximum feature breadth, but one truthful, reproducible slice first.

**Must build:**
1. One complete real vertical slice: historical data → deterministic indicators → one agent → one deterministic baseline → one backtest → one stored experiment → dashboard comparison — running end to end on real (not stub) data.
2. An experiment runner that captures model/prompt version, input snapshot, decision timestamp, output, latency, and rough token cost per run.
3. A point-in-time enforcement test that explicitly rejects any fact timestamped after its decision point, and a UI surface that shows when this fires.
4. Baseline comparisons (buy-and-hold, simple SMA/RSI rule, the LLM agent) with Sharpe, Sortino, max drawdown, and trade count — including transaction-cost assumptions.
5. Ablation toggles: debate on/off, memory on/off, PMXT signal on/off (if you keep it) — each showing a metric delta.
6. A replayable trace view: click a decision, see every input that produced it.
7. A one-command offline demo that runs from committed fixtures — no live API keys required to prove the claim in a few minutes.

**Defer or drop:** live Alpaca execution beyond a minimal demo flourish, Telegram bot, episodic memory, a general prediction-market order-matching layer, React Flow pipeline visualization polish, production deployment hardening.

---

## 7. Known Gaps — a checklist to personally verify, not take on faith

An earlier code-level audit (not verified independently by me — you or a teammate should spot-check these against the actual repo before trusting them, especially since a previous report in this same chain got two things factually wrong — Argon2-vs-bcrypt and an npm package-version claim — that a later, more careful pass caught) found:

| Claim | Where to check |
|---|---|
| Portfolio endpoint returns placeholder/empty state | `apps/api/src/portfolio/service.ts` |
| `POST /agents/run` passes empty bars / null indicators | `apps/api/src/agents/plugin.ts:88-96` |
| `QUANT_SERVICE_URL` configured but never called | `apps/api/src/config.ts:23` |
| `/agents/latest` response shape doesn't match what the frontend expects | `apps/api/src/agents/plugin.ts:62`, `apps/web/src/lib/api.ts:227` |
| `/portfolio/history` is called by the UI but has no backend route | `apps/web/src/lib/api.ts:221` |
| Risk gate, debate/consensus, memory, execution, ablations are not implemented | `packages/contracts/src/index.ts`, `packages/db/src/schema/stubs.ts` |
| DB-backed tests silently skip without a running Postgres | `specs/sprint-1/FOLLOW-UPS.md:104` |
| No integration test covering ingest → quant → agent → dashboard as one path | — |

The practical takeaway regardless of exact accuracy: **before layering evaluation/ablation machinery on top, confirm the underlying pipeline actually runs end to end on real data.** An impressive-sounding evaluation claim built on a broken chain is worse than no claim at all — it's the one thing a reviewer can disprove in five minutes.

---

## 8. Suggested Sprint Mapping

| Phase | Sprint | Goal | Explicitly cut |
|---|---|---|---|
| 1 | Early Sprint 2 | Fix the wiring — real data flows ingest → quant → agent → dashboard, one baseline computed alongside it | Debate, memory, 2nd/3rd agent |
| 2 | Sprint 2 | Experiment manifest + point-in-time rejection test + offline fixtures | Live Alpaca execution |
| 3 | Sprint 3 | Sentiment + fundamental agents, consensus/debate, ablation toggle for debate | Telegram, episodic memory |
| 4 | Sprint 3–4 | Memory layer + ablation toggle for memory; PMXT signal as an optional third ablation | React Flow polish, full prediction-market build |
| 5 | Sprint 4 | Replayable trace UI, one-command offline demo, README/demo script that leads with the measured result | Everything not load-bearing for the demo |

---

## 9. Questions Worth Settling With Your Team Before Committing

- Does this framing genuinely land for all four of you, or does it feel like a rebrand of the same project to some teammates? Worth an honest gut-check, not just a nod.
- **Check your actual grading rubric or ask your professor directly:** does your course reward a rigorous, honest result (including a negative one), or does it implicitly reward a flashy, impressive-looking demo? This changes how much weight to put on the evaluation thesis vs. demo polish, and it's worth knowing before you build around it rather than after.
- How many real working sprints are left? The phase mapping above assumes something like a full Sprint 2–4 runway — compress or cut phases if the timeline is tighter.

---

## 10. Sources Referenced

- TradingAgents (GitHub): https://github.com/TauricResearch/TradingAgents
- ai-hedge-fund (GitHub): https://github.com/virattt/ai-hedge-fund
- RLEval Workshop, ACM CAIS 2026: https://rl-eval.github.io/
- PMXT (GitHub): https://github.com/pmxt-dev/pmxt
- PMXT historical data archive: https://archive.pmxt.dev/
- Alpaca paper trading docs: https://docs.alpaca.markets/docs/paper-trading
- CFTC — Polymarket enforcement action (Jan 2022): https://www.cftc.gov/PressRoom/PressReleases/8478-22
- Anthropic — Building Effective Agents: https://www.anthropic.com/research/building-effective-agents
- Langfuse (open-source LLM observability/eval): https://github.com/langfuse/langfuse
- OpenTelemetry GenAI semantic conventions: https://github.com/open-telemetry/semantic-conventions-genai

*Note: star counts and market-saturation figures are snapshots from August 2026 and move quickly — treat as directional, not exact.*
