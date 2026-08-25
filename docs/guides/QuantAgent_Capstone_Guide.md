# QuantAgent — Capstone Strategy & Learning Guide

*A critical companion to your PRD (CSE470, Section 8, Group 4) — not a replacement for it.*

---

## How to use this document

This is long because your ask was long. It's organized so you can jump around:

1. **Critical analysis of your current PRD** — what's strong, what's shaky, what's missing
2. **Six strategic questions**, answered in depth
3. **A from-zero curriculum** across 15 topics, in learning order
4. **Three candidate architectures**, compared, with a recommendation
5. **An implementation roadmap** — stack, data, timeline, risk, testing, evaluation
6. **A short punch-list** of concrete edits to make to your existing PRD

---

# Part 1 — Critical Analysis of the Current PRD

## The single most important thing to know before you read anything else

Your idea is not original in the "nobody has built this" sense — and that's fine, but you need to know it explicitly so you can position the project correctly. What you've described (specialist analyst agents → bull/bear-style debate → risk-management team → trader/allocator → execution, with layered memory) is architecturally very close to **TradingAgents** (Xiao, Sun, Luo & Wang, arXiv:2412.20138), an open-source framework from Tauric Research that has become one of the most visible projects in this space — tens of thousands of GitHub stars, an accepted paper at a multi-agent-AI workshop, and active development. It's also close in spirit to **FinMem** (layered memory + character design for an LLM trading agent), **FinCon** (multi-agent system with reflective "conceptual verbal reinforcement"), and **FinRobot** (an open-source agent platform for finance). There's even a paper literally titled **"QuantAgent"** (arXiv:2509.09995, on price-driven multi-agent LLMs for high-frequency trading) — the same name you've chosen for your project.

This isn't a reason to abandon the idea. It's a reason to do two things immediately:

1. **Rename the project.** "QuantAgent" collides with an existing arXiv paper. Pick something else before it's on a poster.
2. **Change what you claim your contribution is.** If your PRD's story is "we built a multi-agent trading platform," a capstone committee that knows this space will read it as a student reimplementation of TradingAgents. If your story is "we built a *rigorously evaluated* reference implementation, and we ran controlled ablations that TradingAgents-style papers gesture at but rarely test cleanly" — that's a real, defensible, and genuinely interesting capstone. The engineering is nearly identical either way; the framing and the evaluation section are what change. More on this in Part 2, Question 6.

This is good news, by the way: it means the architecture you sketched is *validated* by independent research groups converging on the same design. You're not making things up. You're behind a well-lit path, which is exactly where a capstone team with 8 weeks and no domain background should be.

## Strengths of the current PRD

- **The core pipeline is sound and matches the field's actual state of the art**: parallel specialist agents → conflict resolution → risk gate → execution, with structured, schema-typed agent I/O (Zod) and a persisted reasoning trail. This mirrors what the published multi-agent finance systems actually do.
- **"This is not a market-prediction tool"** is the right framing instinct. It pre-empts the unanswerable question ("did it make money?") that dooms most trading-bot student projects, which almost never have a long enough live window to say anything statistically meaningful.
- **Paper trading via Alpaca, not real money** — correct call, removes a huge amount of regulatory and ethical overhead.
- **Schema-first agent contracts (F5)** and **error isolation per pipeline stage (F14)** show real systems-engineering maturity — this is the part of the project that will actually be hard and is worth the most credit.
- **Sprint 1 is a genuine walking skeleton** (auth → data → one agent → dashboard), which is the correct way to de-risk a multi-service system early.
- Team roles map reasonably to natural specialties (agents/backend, data/integration, frontend, platform/devops).

## Weaknesses, unrealistic assumptions, and gaps

**1. Persona mismatch.** The Problem Statement says the audience is "students of agentic AI who want a buildable reference implementation." The user stories are almost entirely written as if for a retail trader ("As a trader, I see my paper portfolio…", "As a risk-conscious user…"). These are different products. A reference implementation for researchers wants: reproducibility, ablation switches, exportable logs, clear separation between "facts" and "LLM narration." A retail-trader product wants: onboarding, alerts, a clean mobile experience. You can keep both flavors, but be explicit that the *primary* user is a researcher/evaluator, and the trader-facing polish (Telegram bot, EOD digest, config panel) is a demonstration layer on top, not the product itself. Right now the PRD reads like it forgot its own thesis statement halfway through.

**2. 25 features across 4 sprints, 4 people, 8 weeks is not achievable at the depth implied.** Do the arithmetic: July 10 – September 5 is 8 weeks, 4 people, so roughly 32 person-weeks of *nominal* capacity before subtracting classes, other coursework, onboarding, and debugging. TradingAgents — a research team, not students learning the domain from scratch — took a paper's worth of iteration to get right, and it still only handles a fraction of what your Sprint 2–3 features ask for (debate engine, risk gate, allocator, layered memory, reflection agent, orchestration, two dashboards' worth of UI, and a Telegram bot) in the same 4–6 week window. This isn't a reason to panic; it's a reason to explicitly triage now, before week 1, rather than discovering it in week 6. See Part 2 Q5 and Part 5 for the concrete cut list.

**3. Sprint 2 is the load-bearing wall and it's overloaded.** F8–F15 (sentiment agent, fundamental agent, news ingestion, company-profile store, debate engine, risk gate, orchestration pipeline, watchlist UI) is eight non-trivial features in two weeks. The debate engine and risk gate are individually PhD-adjacent design problems (how do you *actually* resolve disagreement between three LLM outputs in a way that's better than majority vote, and how do you make hard-constraint risk checks that can't be "argued around" by an LLM?). Both are owned by M4 and M1 with no slack.

**4. M1 is a single point of failure.** Backend Lead owns the agent framework, both early agents, the debate engine, the orchestration pipeline, the memory system, *and* the reflection agent — the hardest and most interdependent nine features in the whole project. Everyone else's work (dashboard, watchlist, Telegram) is downstream of M1's contracts. If M1 is even a week behind, the whole team stalls. This needs either (a) a second person pairing on agent framework/orchestration early, or (b) M1 shipping mock/stub agents in week 1 so M2–M4 can build against a fake interface while the real one is finished in parallel.

**5. No point-in-time data discipline mentioned anywhere.** This is the single most common and most damaging mistake in student (and, frankly, published) trading-agent projects: using data in a backtest that wouldn't have been available at decision time (look-ahead bias). A fundamental-agent context store seeded from "public APIs" needs an explicit as-of-date mechanism, or every backtest number you produce is fiction. There's recent academic work specifically benchmarking *this exact failure mode* in LLM finance systems (a "Look-Ahead-Bench" style point-in-time bias benchmark for finance LLMs surfaced in 2026), which tells you two things: it's a real, recognized problem, and building your harness correctly is a genuine, citable point of rigor for your capstone rather than busywork.

**6. No evaluation methodology at all.** The PRD has a rich feature list and zero mention of: what baseline you're comparing against, what metrics you report (Sharpe, Sortino, max drawdown, turnover), how you avoid p-hacking your own risk thresholds against the same backtest window you evaluate on (walk-forward or out-of-sample splits), or how you'd know whether the "debate" or "memory" components are doing anything at all versus a simpler system. This is the part that turns "we built a trading bot" into a capstone with a defensible claim, and right now it's entirely absent. This is the single highest-leverage addition you can make to the project (see Part 5, Evaluation Methodology).

**7. Cost is unaddressed.** Every pipeline run triggers at least 3 LLM calls (sentiment, fundamental, technical-explanation) plus a debate round (1–2 more) plus, weekly, an episodic-summary job. Multiply by watchlist size and run frequency and this adds up fast, especially if you're testing/debugging the pipeline dozens of times a day during Sprints 2–3. Budget for this explicitly (see Part 5), and design for a cheap model on high-volume classification-style tasks and a stronger model only where synthesis/reasoning quality matters (debate resolution, reflection).

**8. Backend language choice isn't stated but is implied to be TypeScript** (Drizzle, Zod), while essentially the entire quant tooling ecosystem you'll want — vectorized backtesting, technical indicator libraries, and any reinforcement-learning work — lives in Python. This is fixable (see Part 5 stack recommendation) but needs a decision now, not discovered in Sprint 3 when someone needs `vectorbt` and the whole system is Node.

**9. "Technical indicator computation... library like `technicalindicators`"** — fine for MVP, but the Node/TS technical-indicator ecosystem is thin compared to Python's (`pandas-ta`, `ta-lib`). This is a symptom of point 8.

**10. The Telegram approve/reject flow (F23) is a genuine distributed-systems problem** disguised as a UI feature: you need a pending-trade state machine, a webhook, an expiry/timeout policy (what happens if nobody responds?), and idempotency (what if someone taps approve twice, or approves after the window already lapsed?). Currently scoped like a CRUD feature; it isn't one.

**11. No mention of testing LLM-in-the-loop components deterministically.** LLM outputs are non-deterministic by default; if your CI pipeline calls a live LLM API on every commit, tests will flake and burn budget. You'll want a record/replay or mocking strategy from day one (see Part 5, Testing Strategy).

## Missing components worth adding

- An explicit **related-work section** (TradingAgents, FinMem, FinCon, FinRobot, FinRL) — both because it's good academic practice and because it's the thing that turns "we copied an architecture" into "we studied the state of the art and made a deliberate, evaluated variant."
- A **backtesting harness** as a first-class deliverable, not an afterthought bolted onto Sprint 3.
- A **baseline strategy suite** (buy-and-hold, SMA crossover, single-agent LLM) to compare against.
- An explicit **cost/rate-limit budget** per pipeline run and per day.
- A **"facts vs. narration" architectural rule**: numbers (P&L, indicators, returns) are always computed deterministically in code; the LLM only ever reasons over and narrates already-computed facts, never invents them. (This exact pattern — deterministic tool calls for data, LLM strictly for narration — is becoming a best practice in 2026 finance-agent tooling and is worth stating explicitly as a design principle, not just an implementation detail.)
- A plan for what happens when an LLM call fails, times out, or returns something that fails schema validation mid-pipeline (partially covered by F14 but worth being explicit in the PRD).

---

# Part 2 — Six Strategic Questions

## 1. What problem should this project actually solve?

Not "can four students build a system that makes money paper-trading in six weeks" — that question is unanswerable in the time you have, and honestly it's unanswerable in *any* six-week window because six weeks of market data is statistical noise. Chasing it will waste your best engineering effort on tuning thresholds against a backtest you'll inevitably overfit.

The problem worth solving is closer to what your own Problem Statement already gestures at: **agentic AI systems that make consequential, hard-to-reverse decisions need structured mechanisms for disagreement, accountability, and human oversight — and there's a shortage of transparent, well-evaluated reference implementations showing how to build one.** Finance is your domain because it has clean signals (public data), clean success/failure metrics (returns, risk), and a safe sandbox (paper trading) — but the actual contribution is about *multi-agent system design and evaluation*, not stock picking. This reframe changes almost nothing about what you build, but it changes everything about what you claim, what you measure, and how a committee will grade it.

## 2. Who are the target users?

Be explicit that there's a primary and a secondary audience, and don't let the secondary audience's needs dilute the primary one:

- **Primary: researchers/evaluators of agentic systems** (your capstone committee, and — if you open-source it — other students or developers studying multi-agent LLM design). They want reproducibility, visible reasoning trails, ablation toggles, and honest metrics.
- **Secondary: a hypothetical quant-curious developer** who wants to run the thing and watch it paper-trade with alerts. This is the audience the Telegram bot and dashboard alerts serve — treat it as a demo layer, not the core deliverable.

Explicitly *not* the target user: an actual retail trader who wants investment advice. Keep the "not financial advice / for research purposes" framing everywhere, the way TradingAgents and FinRL both do in their own documentation — this isn't just a legal nicety, it's an honest description of what the system actually is.

## 3. Why is this problem important?

Two independent reasons, and it's worth stating both:

- **The finance-specific reason**: automated decision systems that touch real capital are proliferating, and most of them are either black-box single models or hand-wavy multi-agent demos without rigorous evaluation. Building — and *honestly evaluating* — a transparent reference system has real educational and even research value, especially the parts nobody does well: point-in-time data discipline and ablation-based evaluation of whether "debate" and "memory" actually help.
- **The general agentic-AI reason**: this project is a concrete, checkable instance of much broader open questions — how do you get multiple LLM agents to productively disagree instead of just averaging into mush? How do you keep a human meaningfully in the loop instead of rubber-stamping? How do you give an agent memory across sessions without it becoming an unauditable black box? Finance just happens to be a domain where you can measure the answers.

## 4. What is the best solution we can offer?

A **tightly scoped reference pipeline** (3 specialist agents → lightweight debate → hard-constraint risk gate → allocator → paper execution) with two things most similar projects skip:

1. A **backtesting harness with enforced point-in-time correctness**, used to run the same pipeline against historical windows, not just to watch it paper-trade in real time for a few weeks.
2. An **ablation-based evaluation section** — same pipeline, with debate/memory/risk-gate individually switched on and off, measured against baselines — as the actual "results" of the project, instead of "look, it made a trade."

Everything else (dashboard polish, Telegram bot, config panel, episodic memory) is real and valuable, but it's the demonstration layer, and should be scoped and prioritized *after* the core pipeline and evaluation harness are solid — not in parallel with them, and definitely not instead of them.

## 5. How should we scope this into an ambitious-but-achievable capstone?

Three tiers, in priority order — build them in this order, and if you run out of time, you still have something coherent to show at every stopping point:

- **Tier 0 (must-have, weeks 1–5):** auth, data ingestion, indicators, 3 agents (rule-based technical + LLM sentiment + LLM fundamental), a *simple* conflict resolution rule (majority vote when 2/3 agree, single LLM synthesis call when they don't — not a multi-round bull/bear negotiation yet), hard-constraint risk gate, orchestration with per-stage error isolation, paper execution, short-term + long-term memory (DB-backed, no cron summarization yet), and — critically — the backtesting harness with point-in-time discipline built in from the start, not bolted on later.
- **Tier 1 (should-have, weeks 5–7):** dashboard with pipeline visualization and debate/decision transcripts, reflection agent, Telegram read-only alerts, EOD summary, ablation evaluation suite with baseline comparisons.
- **Tier 2 (stretch, only if ahead of schedule):** multi-round LLM debate with configurable consensus threshold, episodic weekly memory summarization, Telegram approve/reject interactivity, agent configuration panel, an RL-trained allocator as an additional ablation arm, MCP-native tool architecture for data access.

This is a re-prioritization of your existing feature list, not a rewrite of it — almost every feature (F1–F25) still shows up, just redistributed so the *evaluation* work isn't competing for time with polish work in the final two weeks.

## 6. What would make this genuinely impressive and close to the state of the art?

In rough order of effort-to-impressiveness ratio:

1. **A real evaluation section with ablations and baselines**, done honestly (including reporting when the fancy multi-agent system *doesn't* beat a simple baseline — that's a legitimate and interesting finding, not a failure). This is rare in student projects and is the single biggest lever you have.
2. **Enforced point-in-time correctness**, explicitly tested for and reported on. Most people get this wrong; getting it right and *proving* you got it right (e.g., a unit test that fails if a signal used data from after its decision timestamp) is a concrete, demonstrable piece of rigor.
3. **A clean "facts vs. narration" separation** in the agent architecture — deterministic code computes every number, LLMs only reason over and explain already-computed facts. This avoids a whole class of hallucinated-statistic bugs and is genuinely good practice, not just a nice-to-have.
4. **An explicit related-work framing** that positions your system relative to TradingAgents/FinMem/FinCon/FinRobot/FinRL and states, in one paragraph, what you did differently and why (even if the answer is "we prioritized evaluation rigor over feature breadth, which those systems mostly don't report on").
5. **MCP-native tool access** for market/news/fundamentals data, if time allows — this is a live, fast-moving, currently-relevant piece of agent infrastructure (2026 is roughly when MCP went from "Anthropic's new thing" to "the de facto standard most agent frameworks default to"), and using it correctly signals you understand current agent architecture, not just LLM prompting.

---

# Part 3 — Field Fundamentals: A From-Zero Curriculum

Learn these **in this order**. Each entry gives you what it is, why it matters for this project specifically, the concepts you actually need (not everything that exists), and where to learn it.

### 1. Quantitative finance fundamentals

**What it is:** The vocabulary and mental toolkit for reasoning about prices, returns, and risk numerically instead of narratively — the language every other topic below is written in.

**Why it matters here:** Every agent output, every risk rule, every backtest metric in your system is expressed in this vocabulary. You can't sanity-check your own system's outputs without it.

**Key concepts:** simple vs. log returns; volatility (standard deviation of returns) and why it's the default risk proxy; the risk-free rate; the Sharpe ratio (return per unit of risk) and why raw returns alone are a meaningless metric; drawdown and max drawdown; correlation and diversification; efficient markets (weak/semi-strong/strong forms) — enough to understand *why* your system's edge, if any, is likely to be small and noisy, not because you did something wrong but because that's the null hypothesis you're up against.

**Resources:** *A Random Walk Down Wall Street* (Malkiel) for intuition and humility about market efficiency; Investopedia for on-demand vocabulary lookups; the freely available lecture notes from MIT OCW's "Finance Theory I"; Quantopian's (archived but still circulating) lecture series on quantitative finance fundamentals is a good, code-first companion.

---

### 2. Financial data sources

**What it is:** Where prices, fundamentals, and news actually come from, and the very real differences in quality, licensing, and cost between providers.

**Why it matters here:** This determines what your Data & Signals user stories can actually deliver, and picking wrong here costs you real development time mid-project when a "free" API turns out to give you 25 calls a day.

**Key concepts:** OHLCV bars and bar aggregation (1-min, 1-hour, daily); delayed vs. real-time data (most "real-time" retail feeds are 15-minute delayed unless you're paying for exchange-direct feeds); adjusted vs. unadjusted close (splits/dividends); fundamentals data (income statement, balance sheet, cash flow) and its much lower update frequency versus price data; rate limits and how they shape your caching/polling design.

**Resources (with concrete recommendations for this project):** **Alpaca Market Data** — you're already using Alpaca for execution, and its market data comes bundled with the paper account (real-time IEX feed, generous free-tier rate limits, years of historical bars) — use this as your primary price source rather than adding a second provider. For **fundamentals and company profiles**, **Financial Modeling Prep (FMP)** is purpose-built for exactly this (income statements, ratios, filings) and is explicitly positioned as affordable and developer-friendly for student/small projects. For **news**, Alpaca's bundled news API or **Finnhub's** free tier (which includes news with basic sentiment) are both reasonable; avoid Alpha Vantage as a primary source — its free tier (25 calls/day) is too restrictive for active development. Avoid `yfinance` for anything beyond quick exploratory notebooks; it's unofficial, scrapes Yahoo, and has become increasingly unreliable due to rate limiting.

---

### 3. Market microstructure

**What it is:** How trades actually get matched and executed — order books, bid/ask spreads, market makers, order types — the mechanical layer underneath the price chart.

**Why it matters here:** It's why a backtest that assumes you always get filled at the exact closing price is lying to you, and it's the entire justification for your allocator/execution layer thinking about order type and slippage instead of just "buy N shares."

**Key concepts:** bid-ask spread and why crossing it costs money every trade; market orders vs. limit orders and the fill-certainty/price-certainty tradeoff; slippage (the gap between expected and actual fill price, worse for illiquid assets and larger orders); liquidity and why it varies by time of day and by asset; why high-frequency/market-making strategies are a fundamentally different game from the daily-bar swing strategies your system will run (you don't need to build for HFT — you need to know why you shouldn't try to).

**Resources:** *Trading and Exchanges* by Larry Harris is the standard reference (dense, but the first few chapters are exactly what you need and no more); Investopedia's market microstructure and order-type explainers for quick reference; Alpaca's own documentation on order types and paper-trading fill simulation, since that's the execution layer you're actually building against.

---

### 4. Algorithmic trading

**What it is:** The practice of encoding a trading decision process into code that executes systematically, without a human re-deciding every time — the umbrella category your entire project lives inside.

**Why it matters here:** It's the connective tissue between "an agent produces a signal" and "a paper trade actually happens," and it's where concepts like position sizing, order execution, and strategy lifecycle (signal → decision → order → fill → monitor) come from.

**Key concepts:** signal generation vs. execution as separate concerns (your architecture already separates these — good instinct, keep it explicit); position sizing and why "how much" is a separate, equally important question from "buy or sell"; trade lifecycle and order states (submitted, partially filled, filled, rejected, canceled); transaction costs (commissions, spread, slippage, market impact) and why ignoring them makes every backtest look better than reality; the difference between discretionary, rule-based, and learned (ML/RL) strategies — your system spans all three (LLM reasoning is closer to discretionary, the technical agent is rule-based, and an optional RL allocator would be learned).

**Resources:** *Algorithmic Trading: Winning Strategies and Their Rationale* (Ernest Chan) is a practical, code-adjacent starting point; QuantConnect's free "Boot Camp" tutorials walk through building and backtesting simple strategies hands-on; Alpaca's own tutorial series (they publish a lot of practical, Python-first content specifically for building trading bots against their API).

---

### 5. Time series forecasting

**What it is:** Statistical and ML methods for modeling data that's ordered in time and (usually) autocorrelated — the technique family underneath any attempt to predict future prices or indicators from past ones.

**Why it matters here:** Your technical agent's indicators (moving averages, RSI, MACD) are all simple time-series transforms; if you ever want to go beyond rule-based technical signals, this is the toolbox. It's also essential for understanding *why* naive forecasting of raw prices is so hard (financial returns are close to a random walk; the signal-to-noise ratio is brutal).

**Key concepts:** stationarity and why raw price series usually aren't stationary but returns often are (crucial for not feeding garbage into models); autocorrelation; classical models (ARIMA, GARCH for volatility) as a baseline before reaching for deep learning; the random-walk hypothesis for prices as your null hypothesis to beat; why cross-validation for time series must respect temporal order (no shuffling — this connects directly to walk-forward backtesting later); overfitting risk being *especially* severe in finance because you have relatively few independent "market regimes" in any dataset, however many rows you have.

**Resources:** *Forecasting: Principles and Practice* (Hyndman & Athanasopoulos) — free online, the standard modern reference, not finance-specific but excellent on the general methodology; *Advances in Financial Machine Learning* (López de Prado) has an outstanding, finance-specific treatment of why naive cross-validation fails on financial time series (this book will come up again below — it's worth owning).

---

### 6. Machine learning approaches used in quantitative finance

**What it is:** The broader toolbox of supervised/unsupervised ML applied to financial prediction and classification tasks — feature engineering, model selection, and the finance-specific pitfalls that don't show up in a typical ML course.

**Why it matters here:** Frames what your ML-flavored components (sentiment scoring, any future signal classifier) are actually doing statistically, and why "95% backtest accuracy" in finance is a red flag for overfitting or leakage rather than a success.

**Key concepts:** feature engineering from price/volume/fundamental data; the leakage problem specific to finance (using information not actually available at decision time — this is the same failure mode as look-ahead bias in Part 3 §12, just from the ML angle); the low signal-to-noise ratio in financial data and why simple, regularized models often beat complex ones out-of-sample; ensemble methods; the specific danger of backtest overfitting when you have many tunable parameters (risk thresholds, indicator windows) and a finite, short evaluation window — directly relevant to your risk-gate thresholds.

**Resources:** *Advances in Financial Machine Learning* (López de Prado) is the standard, opinionated, and slightly contrarian text — read at least the chapters on labeling, cross-validation, and backtesting overfitting; Kaggle's historical finance/trading competitions (e.g. the Jane Street and Optiver competitions) have excellent public notebooks showing real feature-engineering and leakage-avoidance practice, even if the competitions themselves are proprietary-data.

---

### 7. Risk management

**What it is:** The discipline of quantifying and bounding how much you can lose, and building hard rules that constrain a system's behavior regardless of how confident any individual signal is.

**Why it matters here:** This is literally your Risk Manager Agent (F13) and the whole reason your architecture has an approval gate at all — it's the safety layer that a "confident" LLM debate outcome still has to pass through.

**Key concepts:** position sizing rules (fixed fractional, volatility-adjusted, Kelly criterion and why full Kelly is almost never used in practice — half-Kelly or smaller is standard); concentration limits (max exposure to one asset/sector); stop-loss and max-drawdown circuit breakers; Value-at-Risk (VaR) as a standard (if imperfect) risk metric; the crucial distinction between a *soft* signal (an agent's opinion, which can be wrong) and a *hard* constraint (a rule the system is not allowed to violate regardless of what any agent says) — this distinction should be a first-class concept in your risk-gate design, not just an implementation detail.

**Resources:** *Quantitative Risk Management* (McNeil, Frey, Embrechts) is the rigorous reference if you want depth; for something more directly applicable, Ernest Chan's books cover position sizing and risk rules in a practitioner-friendly, code-adjacent way; Investopedia for fast lookups on VaR, Kelly criterion, and drawdown.

---

### 8. Portfolio optimization

**What it is:** How to combine multiple assets/positions into a single portfolio that balances expected return against risk, rather than deciding on each position in isolation.

**Why it matters here:** This is your Allocator Agent's actual job once you have more than one open position at a time — "how much of each" is a portfolio question, not a per-asset question, the moment your watchlist has more than one ticker.

**Key concepts:** Modern Portfolio Theory and the mean-variance efficient frontier (the classical starting point, useful for intuition even though its assumptions are shaky); diversification and covariance between assets (why two "safe" assets that move together aren't actually diversifying you); equal-weight vs. conviction-weighted vs. risk-parity allocation as three progressively more sophisticated (and progressively harder to justify with an LLM's confidence score) sizing schemes; rebalancing and turnover cost.

**Resources:** *Portfolio Selection* (Markowitz, the original 1952 paper — short, foundational, and worth reading once) for the theory; PyPortfolioOpt's documentation is an excellent hands-on, code-first walkthrough of mean-variance optimization and its variants, directly usable if you want your Allocator Agent to have a real optimization backend rather than simple heuristics.

---

### 9. Reinforcement learning for trading

**What it is:** Framing trading as a sequential decision problem — an agent observes market state, takes an action (buy/sell/hold, or a position-size vector), and learns a policy from a reward signal (portfolio return, risk-adjusted return) via trial and error.

**Why it matters here:** This is a legitimate Tier-2 stretch goal for your Allocator (a learned policy compared against your rule-based one as an ablation arm), and understanding it is necessary context for evaluating whether it's worth the engineering cost for your timeline (often, it isn't — see the honest caveat below).

**Key concepts:** the RL framing (state, action, reward, policy) applied to trading (state = market/portfolio features, action = trade/position size, reward = P&L or a risk-adjusted variant); why naive "maximize P&L" reward functions tend to learn dangerous, high-variance policies unless you explicitly shape the reward for risk (e.g., penalize drawdown); the standard algorithms used in practice (PPO, A2C/A3C, SAC, DDPG/TD3 — you don't need to derive these, just know what they're for and which one is a reasonable default: PPO is the most common "reasonable first choice"); the honest limitation that RL trading agents are notoriously hard to get working reliably on real market data (highly non-stationary environment, small effective sample size, easy to overfit to a backtest period) — treat this as a controlled experiment/ablation arm, not the primary strategy your system depends on.

**Resources:** **FinRL** (AI4Finance Foundation) is the standard open-source starting point purpose-built for this — it wraps Gym-style trading environments around real market data and trains PPO/A2C/DDPG/TD3/SAC agents via Stable-Baselines3 out of the box, with tutorials that go from data download to trained agent to backtest comparison against a buy-and-hold baseline in three scripts. Start there rather than building an RL environment from scratch. (Note: AI4Finance's newer "FinRL-X" project is a more production-oriented successor aimed at AI-native deployment; for a capstone, the original FinRL library plus its tutorial notebooks is the right level of complexity.) For background theory, Sutton & Barto's *Reinforcement Learning: An Introduction* (free online) chapters 1–6 are enough to understand what FinRL is doing under the hood.

---

### 10. Backtesting frameworks

**What it is:** Software for simulating how a strategy would have performed on historical data, ranging from fast vectorized engines to slower but more realistic event-driven simulators.

**Why it matters here:** This is one of the two highest-leverage additions to your project (see Part 2, Q6) and deserves real engineering time, not a rushed script in the last week.

**Key concepts:** vectorized vs. event-driven simulation — vectorized engines treat entire price/signal series as array operations and are extremely fast but model fills/slippage/path-dependence less realistically; event-driven engines step through time bar-by-bar (or tick-by-tick) and simulate order matching more like a real broker, at the cost of speed; walk-forward (rolling out-of-sample) evaluation as the correct way to avoid fitting your risk thresholds to the exact window you evaluate on; the danger of vectorized backtests silently mis-modeling slippage/partial fills unless you're careful; benchmark comparison (always report your strategy against buy-and-hold and at least one simple rule-based baseline, on the *same* window).

**Resources and concrete recommendation for this project:** Use **`vectorbt`** (open-source) for the fast, iterative research phase — sweeping indicator parameters, quickly checking "does this even have a signal" — it's NumPy/Numba-accelerated and can evaluate thousands of parameter combinations in seconds, which is exactly what you want while tuning your technical agent and risk thresholds. For the final, "trust this number" validation pass, either hand-roll a small event-driven check pass in Python (bar-by-bar, respecting order type and a simple slippage model) or use **`backtesting.py`** for something lighter than a full framework. Avoid `backtrader` and `zipline` for a new 2026 project — `backtrader` has been in maintenance-only mode for a couple of years with accumulating unfixed bugs, and `zipline`'s community fork (`zipline-reloaded`) is usable but has a heavy, US-equities-specific data-ingestion setup that isn't worth the ramp-up time for your scope. `vectorbt`'s own documentation and tutorial notebooks are the best starting point; FinRL's own backtest scripts are a good second reference since you'll likely reuse them if you build the RL ablation arm.

---

### 11. Evaluation metrics

**What it is:** The specific numbers you compute to say whether a strategy or system is "good," and — just as important — the numbers that tell you when a good-looking result might be luck.

**Why it matters here:** Your PRD currently has zero evaluation metrics specified anywhere. This is the gap to close first.

**Key concepts:** cumulative and annualized return; Sharpe ratio (and its limitations — it assumes roughly normal returns and penalizes upside volatility same as downside); Sortino ratio (Sharpe's downside-only cousin, arguably more honest for asymmetric strategies); max drawdown and Calmar ratio (return over max drawdown — often more informative than Sharpe for trend-following-style strategies); win rate and profit factor (gross wins over gross losses; a rule of thumb is you want this comfortably above 1 to suggest a real edge rather than noise); turnover and realistic transaction-cost drag; and — the metric most projects skip — a way to sanity-check whether a good Sharpe ratio could plausibly have arisen by chance given how many strategy variants/thresholds you tried (this is the "probabilistic Sharpe ratio" idea from Bailey & López de Prado's work on backtest overfitting: essentially, an adjusted confidence measure that accounts for the number of trials and the shape of your return distribution, rather than trusting Sharpe at face value).

**Resources:** `pyfolio` and `quantstats` (both Python, both free) auto-generate a full standard tearsheet (returns, Sharpe, Sortino, drawdown, rolling metrics) from a returns series — use one of these rather than hand-computing everything, both to save time and to use metric definitions the field actually recognizes; López de Prado's chapters on backtest overfitting (again, *Advances in Financial Machine Learning*) are the right depth for understanding *why* you need more than a single Sharpe number.

---

### 12. LLM agents and multi-agent systems for finance

**What it is:** Using LLMs not as single-shot predictors but as reasoning agents — with roles, tools, memory, and (in multi-agent setups) structured interaction with other agents — applied to financial analysis and decision-making. This is the core of your project.

**Why it matters here:** It's the architecture you're building. Reading the actual papers in this space before you design your own debate/memory system will save you from re-deriving design mistakes they've already made and fixed.

**Key concepts:** role specialization (giving each agent a narrow, well-defined job and input, rather than one agent trying to do everything) as the core justification for "multi-agent" over "one big prompt"; structured debate/adversarial reasoning as a mechanism for surfacing disagreement rather than averaging it away (bull vs. bear framing, as used by the systems below); layered/tiered memory (short-term working context, episodic summaries, long-term persistent facts) as a way to give an agent continuity without an unboundedly growing prompt; reflection (having an agent review its own past decisions and outcomes to update future behavior) as a lightweight alternative to fine-tuning; and the crucial, easy-to-miss design discipline of keeping deterministic computation (indicators, P&L, returns) strictly separate from LLM reasoning/narration, so the LLM is never in a position to "hallucinate" a number that should have come from code.

**Resources — read these roughly in this order:**
- **TradingAgents** (Xiao et al., arXiv:2412.20138) — the closest architectural match to your PRD: specialized analyst agents, bull/bear researcher debate, a risk-management team, and traders with different risk profiles, evaluated against classic technical baselines. Also has an open-source implementation (`TauricResearch/TradingAgents` on GitHub) you can actually read the code of, which is worth more than the paper alone for implementation details.
- **FinMem** (Yu et al.) — a performance-focused LLM trading agent with an explicit layered memory design and "character" (risk-profile) design — read this specifically for memory-architecture ideas, since it's the closest prior art to your F18.
- **FinCon** (Yu et al., NeurIPS 2024) — a multi-agent system using "conceptual verbal reinforcement" (natural-language reflection used as a substitute for gradient-based reinforcement learning) — read this for your reflection agent (F19).
- **FinRobot** (Yang et al.) — an open-source agent *platform* rather than a single strategy, useful for seeing how a team structured a broader agent toolkit for finance.
- **FinGPT** (AI4Finance Foundation) — the open-source financial-LLM sibling project to FinRL, useful context for the "why not just fine-tune a model" alternative you're implicitly rejecting in favor of a general LLM + agent scaffolding approach.

---

### 13. Retrieval-augmented generation (RAG)

**What it is:** Giving an LLM access to a retrieval step over an external knowledge store (embeddings + vector search, typically) before it generates a response, so it can ground its output in specific, up-to-date, or proprietary documents rather than only what's in its training data.

**Why it matters here:** Your Company Profile & Factual Context Store (F11) and curated-headline ingestion (F10) are *exactly* the kind of external, updating knowledge base RAG is designed for. Right now the PRD implies a plain database CRUD store — turning it into an embeddings-backed retrieval store is a small implementation change with real architectural upside (the fundamental agent can retrieve the most relevant facts/filings for a given query instead of you hand-coding which fields it sees).

**Key concepts:** embeddings (turning text into vectors such that semantically similar text ends up near each other in vector space); vector search / nearest-neighbor retrieval; chunking strategy (how you split documents/headlines before embedding them, and why chunk size matters for retrieval quality); the retrieve-then-generate pattern (retrieve top-k relevant chunks, inject them into the prompt, then generate); grounding as a hallucination-mitigation technique — directly relevant to your "facts vs. narration" design principle in Part 2 Q6.

**Resources:** Anthropic's own documentation on retrieval and contextual embeddings (docs.claude.com) for a current, practical treatment; Pinecone's "Learning Center" articles are a good conceptual primer even if you don't use Pinecone itself; for implementation, **`pgvector`** (a Postgres extension) is the pragmatic choice for this project — you're already using Postgres via Drizzle, so adding vector columns and similarity search to your existing schema is far less overhead than standing up a separate vector database.

---

### 14. MCP, tool calling, and agent architectures

**What it is:** **Tool calling** is the general mechanism by which an LLM can invoke external functions (fetch a price, run a calculation, query a database) rather than only generating text. **MCP (Model Context Protocol)**, published by Anthropic in late 2024, is an open standard for exposing tools/data/prompts to an LLM application in a consistent way, so you're not hand-rolling a bespoke integration for every data source and every framework.

**Why it matters here:** Every one of your agents needs tools (fetch price bars, fetch indicators, fetch headlines, fetch fundamentals, submit an order). You can wire these as ad-hoc function-calling schemas (simplest, fine for an MVP) or as MCP servers your agents connect to (more current, more reusable, and directly matches something you explicitly said you want to learn). By 2026, MCP has become close to the default way serious agent frameworks and even financial-data vendors expose tool access — several market-data providers now ship their own MCP servers specifically so agents can call `get_price`, `get_fundamentals`, etc. as standardized tools rather than bespoke REST wrappers.

**Key concepts:** the three MCP primitives — *tools* (callable functions), *resources* (readable data), *prompts* (reusable prompt templates) — and how they map onto your data-fetching needs; the client/server model (your orchestrator is an MCP *client*, and you'd either run your own MCP *server* wrapping your data providers, or connect to an existing one if your chosen data provider ships one); the distinction between MCP (agent-to-tool) and the newer A2A/agent-to-agent protocols (agent-to-agent) — you likely only need the former; a real security consideration worth knowing about even for a student project: MCP tool descriptions are themselves untrusted input to the model, and malicious or malformed tool metadata is a known attack surface (tool poisoning) — worth a sentence in your write-up even if it's not a threat you need to defend against with FMP/Alpaca's own servers.

**Resources:** Anthropic's original MCP announcement and specification (docs at modelcontextprotocol.io, and the introductory post at anthropic.com/news/model-context-protocol) for the primary source; the MCP Inspector tool (`npx @modelcontextprotocol/inspector`) for hands-on testing of any server you build without needing a full LLM loop running; if you want a very concrete worked example close to your use case, look for tutorials building a small financial assistant on top of a market-data MCP server (there are several 2026-era walkthroughs doing exactly this pattern: parse the question deterministically, call MCP tools for facts, hand only the facts to the LLM for narration — directly matching the "facts vs. narration" principle from Part 2 Q6).

---

### 15. Deployment considerations

**What it is:** Everything involved in making the system actually run reliably outside your laptop — containerization, configuration, secrets management, scheduled jobs, and observability.

**Why it matters here:** Directly your F-item "stack deploys via Docker Compose," plus the parts the PRD doesn't spell out: encrypted secret storage for Alpaca keys (mentioned), scheduled jobs for cron-based memory summarization and EOD reports (not spelled out how), and basic operational logging so a failed pipeline run is debuggable after the fact rather than a mystery.

**Key concepts:** containerization and multi-service orchestration (Docker Compose is the right level of complexity here — you don't need Kubernetes for a capstone); environment-based configuration and secrets (never commit API keys; use `.env` files excluded from version control, and encrypt anything persisted to the database); scheduled/cron jobs for periodic tasks (episodic memory summarization, EOD reports) and how to make them idempotent (safe to re-run if they fail partway); structured logging (log agent runs, tool calls, and errors as structured JSON, not free-text `print` statements, so you can actually query "show me every pipeline run where the risk gate rejected a trade last week"); basic health checks so a failing service (e.g., LLM API down) is visibly unhealthy rather than silently returning stale data.

**Resources:** Docker's own "Get Started" guide plus the official Docker Compose documentation is genuinely sufficient for this project's scope; the Twelve-Factor App methodology (12factor.net) is a short, classic read on config/secrets/logging practices that will make your system meaningfully more professional for very little extra effort.

---

# Part 4 — Candidate Architectures

## Tier 1 — Safe MVP

Single orchestrator. Rule-based technical agent + one LLM sentiment agent. No debate (simple rule: if they agree, proceed; if they disagree, default to hold and log it). Manual approval for all trades above a threshold. Short-term memory only (a table of recent trades/positions, queried directly — no summarization layer). `vectorbt` for backtesting research. Dashboard is a portfolio view plus a flat run log (no pipeline diagram, no debate transcript UI).

**Achievable by:** any subset of the team, solo if needed, comfortably inside 8 weeks with slack to spare.
**Risk:** low.
**Impressiveness:** low-to-moderate — solid engineering, but doesn't showcase the "multi-agent" thesis your Problem Statement is built around.

## Tier 2 — Recommended

Three specialist agents (technical, sentiment, fundamental) with schema-typed I/O. Lightweight debate: majority vote when 2/3 agree; a single LLM synthesis call (not a multi-round negotiation) when they don't, producing a decision plus a recorded dissent trail. Hard-constraint risk gate (position limits, concentration, stop-loss) that cannot be argued around by any agent's confidence score. Allocator using a simple, explainable sizing rule (equal-weight or conviction-weighted, not RL). Orchestration pipeline with per-stage timeout/error isolation. Short-term + long-term memory (DB-backed; episodic cron summarization deferred). `pgvector`-backed retrieval for the fundamental agent's company-profile/context store (a real, contained RAG feature). Backtesting harness with enforced point-in-time correctness and walk-forward evaluation, run against buy-and-hold and a simple rule-based baseline. Dashboard with pipeline visualization and full debate/decision transcripts. Telegram read-only alerts (approve/reject deferred to stretch). Ablation-based evaluation suite (debate on/off, memory on/off, risk-gate thresholds varied) as the project's core "results."

**Achievable by:** a 4-person team in 8 weeks, with the Tier-0/1/2 prioritization from Part 2 Q5 — tight but realistic if scope discipline holds from week 1.
**Risk:** moderate — the main risk is Sprint 2 overload and the M1 single-point-of-failure issue flagged in Part 1; both are manageable with the mitigations suggested there (mock agents early, simpler debate rule than a full negotiation protocol).
**Impressiveness:** high — this is the version that actually demonstrates the multi-agent thesis *and* has a real evaluation story, which is the differentiator from a typical student trading-bot project.

## Tier 3 — Ambitious / stretch

Everything in Tier 2, plus: multi-round LLM debate with a configurable consensus threshold; episodic weekly memory summarization via a cron job; a second, RL-trained allocator (via FinRL/Stable-Baselines3) run as an additional ablation arm against the rule-based allocator; Telegram approve/reject with a proper pending-trade state machine; a full agent configuration panel; MCP-native tool architecture for all external data access, replacing ad-hoc REST wrappers; portfolio-level risk (correlation-aware concentration limits across the whole watchlist, not just per-asset).

**Achievable by:** only if Tier 2 is solid with real time left over — treat every item here as independently optional, not a package deal. The RL allocator ablation and MCP tool architecture are the two highest-value additions if you have to pick just two (they map directly to Part 2 Q6's "what makes this impressive" list).
**Risk:** high if attempted broadly — RL training is genuinely finicky (non-stationary environment, easy to overfit, real risk of "it doesn't converge to anything useful in the time you have," which is itself a defensible negative result if reported honestly, but a bad outcome if it eats your whole final sprint).
**Impressiveness:** very high, but only if executed cleanly — a broken or rushed Tier 3 feature actively hurts you more than not attempting it, since it signals scope-control problems rather than ambition.

## Comparison

| Dimension | Tier 1 (Safe) | Tier 2 (Recommended) | Tier 3 (Stretch) |
|---|---|---|---|
| Feasibility in 8 weeks / 4 people | Very high | High, with discipline | Low-to-moderate |
| Demonstrates "multi-agent debate" thesis | Weak | Strong | Strong |
| Has a real evaluation story | Possible but thin | Strong (ablations + baselines) | Strongest (adds RL comparison arm) |
| Engineering risk | Low | Moderate | High |
| Learning value across your 15-topic curriculum | Covers ~6 topics well | Covers ~12 topics well | Covers all 15, if it doesn't collapse under its own scope |
| Recommended for | A fallback if Sprint 1–2 go badly | **Your default target** | Cherry-pick 1–2 items only if ahead of schedule |

**Recommendation:** build Tier 2 as the backbone from day one, with Tier 0/1/2 sub-prioritization inside it as described in Part 2 Q5. Treat Tier 3 items as optional stretch goals selected individually in Sprint 4 based on actual velocity, not committed to up front.

---

# Part 5 — Implementation Roadmap

## Technology stack

**Recommendation — split by workload, not by team preference:**

- **Application backend & API:** TypeScript, Node.js (Fastify or Express), Drizzle ORM, Zod schemas, PostgreSQL — keep what your PRD already chose here, it's a reasonable, modern stack for the web/API/orchestration layer.
- **Quant service (new — recommended addition):** a separate Python microservice for indicator computation, backtesting, and any RL work, exposed to the Node backend over internal HTTP/REST. Use `pandas` + `pandas-ta` for indicators, `vectorbt` for research-phase backtesting, and (if you build the Tier 3 RL arm) `FinRL` + `stable-baselines3`. This is the single most important stack change from your current PRD — the quant/RL tooling ecosystem is overwhelmingly Python, and fighting that in Sprint 3–4 costs more time than standing up a second small service in Sprint 1.
- **Frontend:** React + Vite (as planned), Tailwind, `shadcn/ui`, Recharts for charts, React Flow for the pipeline diagram (as planned) — all good choices, keep them.
- **Vector/RAG storage:** `pgvector` extension on your existing Postgres instance rather than a separate vector database — less operational overhead for a capstone-scale project.
- **LLM provider:** Anthropic's Claude API. Use a fast/cheap-tier model for high-volume, low-reasoning tasks (sentiment scoring, technical-agent explanation text) and a stronger reasoning-tier model only where synthesis quality matters (debate resolution, reflection agent). Check `docs.claude.com` for current model names/pricing when you set this up, since these change.
- **Agent orchestration:** a small, custom-built orchestrator (explicit stage functions: fetch → analyze → debate → risk → allocate → execute) rather than a heavyweight framework. For a *reference implementation* meant to be readable and learnable, a transparent hand-rolled pipeline beats a framework's magic — you can always mention LangGraph/CrewAI in your related-work section as alternatives you considered.
- **Execution & price/news data:** Alpaca (paper trading + bundled market data + news), as planned. Add Financial Modeling Prep for fundamentals/company profiles.
- **Testing:** Vitest/Jest for the TS backend, Pytest for the Python quant service, with a record/replay or mocked-LLM strategy for pipeline tests (see Testing Strategy below).
- **Deployment:** Docker Compose (as planned), one service per component (Postgres, Node API, Python quant service, React frontend, Telegram bot worker).

## Database design (sketch)

Core tables beyond the obvious (`users`, `alpaca_credentials` encrypted, `watchlist_items`): `price_bars`, `indicator_snapshots`, `headlines`, `company_profiles` (with an embedding column via `pgvector` for retrieval), `agent_runs`, `agent_outputs` (schema-typed per your Zod contracts), `debate_rounds` and `debate_messages`, `risk_decisions`, `allocations`, `orders`, `memory_short_term`, `memory_episodic`, `memory_longterm_rules`, `reflections`, `reports`. Every table that represents a decision or output should carry a timestamp and an "as-of" data-window reference, so backtests can reconstruct exactly what the system knew at decision time.

## Milestones and timeline (adjusted from your existing sprints)

- **Sprint 1 (Jul 10–23):** as planned, plus: stand up the Python quant service skeleton, and bake point-in-time data discipline into the data-ingestion layer from day one (every stored bar/headline/fundamental gets an explicit availability timestamp). Retrofitting this later is much more expensive than building it in from the start.
- **Sprint 2 (Jul 24–Aug 6):** trim to the Tier 0 feature set from Part 2 Q5 — three agents, simple (not multi-round) debate resolution, hard-constraint risk gate, orchestration with error isolation, watchlist UI. Defer full company-profile CRUD polish and configurable consensus thresholds. M1 ships stub/mock agents in the first days of this sprint so M2–M4 aren't blocked on the real agent framework landing.
- **Sprint 3 (Aug 7–20):** execution + short/long-term memory + reflection agent + dashboard reasoning trail + pipeline viz, **plus the backtesting/evaluation harness as an explicit, protected deliverable** — this is the piece most likely to get silently dropped under time pressure, and it's the piece your capstone's actual argument depends on.
- **Sprint 4 (Aug 21–Sep 5):** Telegram (start read-only, add approve/reject only if ahead), basic config panel, EOD summary, hardening, docs, demo prep. Attempt Tier 3 stretch items (RL ablation arm, MCP-native tools, episodic memory) only after everything above is solid, and only pick 1–2, not all of them.

## Risks

LLM API cost overrun (mitigate: cheap-tier model for high-volume tasks, mocked LLM calls in CI/dev testing, explicit per-run and per-day budget); LLM non-determinism breaking automated tests (mitigate: record/replay fixtures); look-ahead bias silently invalidating every backtest result (mitigate: the as-of timestamp discipline from Sprint 1, plus a specific unit test that fails if any signal used data timestamped after its own decision time); third-party API rate limits during active development (mitigate: cache aggressively, use Alpaca's paper-account data rather than hitting live feeds constantly); M1/agent-framework bottleneck (mitigate: stub agents shipped early); scope creep past Sprint 2 (mitigate: the Tier 0/1/2 prioritization is a commitment, not a suggestion — revisit it explicitly at each sprint boundary); Telegram approval race conditions (mitigate: a real pending-trade state machine with explicit expiry, built as its own small feature rather than squeezed into the bot integration task); academic-integrity/differentiation risk (mitigate: the related-work section from Part 2 Q6, written early, not as an afterthought in the final report).

## Testing strategy

Unit-test each agent against fixed inputs, checking schema validity and plausible output bounds, not exact LLM wording. Contract-test the Zod schemas with round-trip parsing. Integration-test the full pipeline with recorded/mocked LLM responses (so CI doesn't burn API budget or flake on model non-determinism). Write specific correctness tests for the backtesting harness using synthetic price series with a known, hand-computed expected outcome (e.g., a series where you know exactly when an SMA-crossover signal should fire) — this catches indicator/backtest bugs that are otherwise invisible until your results look suspiciously good or bad. Test pipeline resilience explicitly by simulating an individual agent timeout/failure and confirming the rest of the pipeline still completes (this is literally one of your own user stories — make sure it's actually tested, not just implemented). Test the encrypted-at-rest storage of Alpaca credentials.

## Evaluation methodology

This is the section to protect above all others.

**Baselines to compare against, on the same historical window:** buy-and-hold; a simple rule-based strategy (SMA crossover or RSI threshold); the single best-performing individual agent running alone (no debate, no risk gate); your full multi-agent system.

**Metrics to report, not just cumulative return:** Sharpe ratio, Sortino ratio, max drawdown, Calmar ratio, win rate, profit factor, and turnover/transaction-cost drag. Generate these with `pyfolio` or `quantstats` rather than hand-rolling formulas, both for correctness and because they're the metrics a reader will recognize.

**The ablation table — your actual contribution:** run the identical pipeline with debate switched on vs. off (majority vote only), memory switched on vs. off, and risk-gate thresholds varied, and report the metric deltas. This directly answers the question your Problem Statement implicitly raises — does structured debate and persistent memory actually help, or is it complexity for its own sake — and it's the kind of result that's genuinely interesting *even if the answer turns out to be "not much, in this window."*

**Point-in-time integrity check:** a specific, reportable test (not just a design claim) that no agent output or backtest result used data unavailable at its decision timestamp.

**A light qualitative component, if time allows:** have someone (a teammate, or ideally an outside reader) score a small sample of debate transcripts and risk-gate decisions on a simple rubric (does the reasoning follow from the stated inputs; is the dissent trail coherent) — this is cheap to add and gives you something to say about reasoning *quality*, not just downstream returns, which is a genuinely differentiating angle given how few similar projects evaluate this at all.

---

# Part 6 — Concrete Edits to Apply to Your Existing PRD

You don't need a new document — apply these directly to what you have:

1. Rename the project (naming collision with an existing arXiv paper).
2. Rewrite the user stories under "Portfolio & Watchlist," "Dashboard," and "Telegram Bot" to explicitly frame the primary user as a researcher/evaluator, with the trader-facing framing kept as a secondary, clearly-labeled demonstration layer.
3. Add a short **Related Work** subsection naming TradingAgents, FinMem, FinCon, FinRobot, and FinRL, and one paragraph stating what you're doing differently (evaluation rigor and point-in-time discipline, specifically).
4. Add an explicit **Evaluation** section with baselines, metrics, and the ablation-table methodology from Part 5 — currently entirely absent.
5. Re-prioritize Sprint 2's feature list per the Tier 0/1/2 breakdown in Part 2 Q5; it's currently overloaded.
6. Add a note under F14 (Orchestration Pipeline) and F3 (Data Ingestion) committing to explicit as-of/point-in-time timestamps on all stored data — the single highest-leverage technical addition.
7. Split the stack: add a Python "quant service" alongside the existing Node/TS backend, and update F4 and F17 to reference it.
8. Add an explicit cost/rate-limit budget line to the System Quality section.
9. Rewrite F23 (Telegram approve/reject) to name the pending-trade state machine and expiry policy explicitly, rather than leaving it implicit in "the bot asks for approval."
10. Add a testing note under System Quality committing to a record/replay or mocking strategy for LLM calls in CI.
11. In Sprint 1, add "backtesting harness skeleton" as an explicit deliverable, not something that first appears in Sprint 3.
12. Consider adding one sentence to the M1 role description flagging the orchestration/debate/memory workload concentration, and a mitigation (mock agents shipped first) — worth stating explicitly rather than discovering under deadline pressure.

Good luck — the underlying idea is genuinely solid; it mostly needs tighter scoping and an honest evaluation story, both of which are well within reach in the time you have.
