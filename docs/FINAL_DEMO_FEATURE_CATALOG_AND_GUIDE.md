# 🏛️ The Committee (QuantAgent) — Final Project Feature Catalog & Demo Guide

**Course / Evaluation:** Capstone Project Final Demo  
**Project Name:** The Committee (QuantAgent) — Multi-Agent Paper-Trading Reference System & Quantitative Evaluation Lab  
**Tech Stack:** TypeScript (Node.js 22, Fastify, React 18, Vite, Tailwind CSS, TanStack Query, Recharts), Python 3.12 (FastAPI, Pandas, Pytest), PostgreSQL 16 (`pgvector`), Drizzle ORM, Turborepo, Docker.  
**Team Roster:** 4 Members (M1, M2, M3, M4)

---

## 📋 Team Member Feature Mapping Summary

| Member | Role | Module 1 (Lab 5) | Module 2 (Lab 6) | Module 3 (Lab 7) — Feature 3 | Module 3 (Lab 7) — Feature 4 | Module 3 / Final — Feature 5 | External API Integration |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **M1** (`@sharzilnfz`) | Lead / Multi-Agent Architecture | Base Agent Framework & Zod Contract Schemas | Technical & Sentiment Specialists with Multi-LLM Fallback | Consensus Short-Circuit & Debate Synthesis vs Ablation | Polymarket Macro Specialist & Decision Lineage DAG | Multi-Round Adversarial Debate ($R=2$) & MCP Server | Anthropic Claude, Google Gemini, OpenRouter, OpenAI, Model Context Protocol (MCP) |
| **M2** (`@afnan-mojumder`) | Quant / Data Lead | Point-in-Time Market Ingestion & Python Quant Service | TemporalGuard Anti-Leakage CI Enforcement | Pure TypeScript Mathematical Indicator Engine & Simulator | Immutable Experiment Manifest Engine & Replay CLI | Multi-Asset Portfolio Allocator & Market Calendar Guard | Alpaca Market Data v2 API, SEC EDGAR XBRL API, Benzinga News Feed |
| **M3** (`@capitalD10`) | Frontend / UI Lead | Real-Time Portfolio Dashboard & Financial KPI Suite | Experiment Observatory Tearsheet & Multi-Series Engine | Interactive Decision Lineage DAG Inspector HUD | Live Signals Radar & Real-Time Indicator Gauges | Empirical Variance Envelopes ($\pm 1\sigma$), Presets & Daemon HUD | Alpaca Account Stream Integration, Recharts SVG Charting Engine, WebSocket Stream |
| **M4** (`@ironhead2002`) | Platform / Risk Lead | Dual-Timestamp Database Schema & Migrations | Deterministic Risk Gate Engine (5 Hard Constraints) | Live Alpaca WebSocket Streamer & Trading Daemon | Interactive 2-Way Telegram Trade Approval Bot | BudgetGuard Spend Ceiling ($5.00) & Variance Sweep API | Telegram Bot API, Alpaca Paper Trading REST & WebSocket Stream API |

---

# SECTION 1: Member 1 (M1) — Lead & Multi-Agent Architecture
**GitHub:** `@sharzilnfz` | **Email:** `sharzilrs@gmail.com` | **Domain:** Agent Framework, Debate Synthesis, LLM Fallback Chaining, Lineage DAG, MCP Server

---

### Feature 1 (Module 1 / Lab 5): Base Agent Framework, Fault-Tolerant Runner & Shared Zod I/O Contracts
- **Module Mapping:** Module 1 / Lab 5 (Foundation Architecture)
- **User-Facing Overview:** Guarantees that any malfunctioning, timing-out, or malformed AI agent never crashes the platform or causes erratic trading. Users see standardized signal outputs, uniform confidence meters, and structured rationale across all specialists.
- **System Architecture:** Implements abstract class `BaseAgent` and the `AgentRunner` execution pipeline. Models are treated as untrusted text generators: outputs are validated against strict Zod schemas with a 2-try retry loop before gracefully falling back to `NO_OPINION` (`bias: neutral, confidence: 0.0`).
- **Key Source Code Files:**
  - [`packages/contracts/src/agents.ts`](../packages/contracts/src/agents.ts) — `AgentInput`, `AgentOutput`, `AgentRunEnvelope` Zod schemas.
  - [`apps/api/src/agents/base.ts`](../apps/api/src/agents/base.ts) — Abstract `BaseAgent` class & `NO_OPINION()` fallback.
  - [`apps/api/src/agents/runner.ts`](../apps/api/src/agents/runner.ts) — `AgentRunner.runAll()` with timeout isolation.
- **External API:** Decoupled LLM abstraction layer with `ScriptedLlmClient` test doubles for deterministic zero-cost testing.
- **How to Live Demo:** Trigger `GET http://localhost:3000/agents/latest?symbol=AAPL` and demonstrate how invalid model responses fall back safely without HTTP 500 errors.

---

### Feature 2 (Module 2 / Lab 6): Point-in-Time Technical & Sentiment Specialists with Multi-Provider LLM Fallback Chaining
- **Module Mapping:** Module 2 / Lab 6 (Specialist Agents & Resilient LLM Inference)
- **User-Facing Overview:** Translates mathematical indicators and breaking financial headlines into natural language investment theses. If primary AI providers experience outages or rate limits, the system automatically fails over to backup models without downtime.
- **System Architecture:** Implements `TechnicalAgent` and `SentimentAgent`. Enforces the **"Facts vs. Narration" Law**: deterministic indicator calculations strictly overwrite LLM hallucinations on key collisions. Implements `FallbackLlmClient` trying Anthropic Claude $\to$ Google Gemini $\to$ OpenRouter $\to$ OpenAI standard endpoints sequentially.
- **Mathematical Confidence Blend:**
  $$\text{Confidence}_{\text{blended}} = \begin{cases} 0.5 \cdot \text{Strength}_{\text{rules}} + 0.5 \cdot \text{Conf}_{\text{model}} & \text{if } \text{Dir}_{\text{rules}} = \text{Dir}_{\text{model}} \\ 0.25 \cdot (\text{Strength}_{\text{rules}} + \text{Conf}_{\text{model}}) & \text{if } \text{Dir}_{\text{rules}} \neq \text{Dir}_{\text{model}} \end{cases}$$
- **Key Source Code Files:**
  - [`apps/api/src/agents/technical/agent.ts`](../apps/api/src/agents/technical/agent.ts) — `TechnicalAgent` implementation.
  - [`apps/api/src/agents/technical/llm-client.ts`](../apps/api/src/agents/technical/llm-client.ts) — Multi-provider fallback chaining (`AnthropicLlmClient`, `GeminiLlmClient`, `OpenAiCompatibleLlmClient`).
  - [`apps/api/src/agents/sentiment/agent.ts`](../apps/api/src/agents/sentiment/agent.ts) — `SentimentAgent` headline parsing.
- **External API:** Anthropic Claude API, Google Gemini API, OpenRouter API, Benzinga News Feed.
- **How to Live Demo:** Open `http://localhost:5173/signals` to inspect live specialist agent stances and demonstrate multi-provider failover.

---

### Feature 3 (Module 3 / Lab 7): Deterministic Consensus Short-Circuit & Conditional Debate Synthesis vs. Neutral Ablation
- **Module Mapping:** Module 3 / Lab 7 (Multi-Agent Consensus & Scientific Ablations)
- **User-Facing Overview:** When specialists agree, trades execute instantly with zero added AI cost. When specialists clash (e.g. Technical is bullish on momentum but Sentiment is bearish on negative earnings), an AI judge adjudicates the conflict, explaining which specialist has priority and capturing the dissenting view.
- **System Architecture:** `AgentCoordinator` evaluates directional consensus across specialists. If unanimous or unopposed, fast-paths (`mode: "consensus_short_circuit"`, 0 extra tokens). If direct conflict exists:
  - **Debate ON:** Invokes `DebateSynthesizer` with structured synthesis prompt.
  - **Debate OFF (Ablation Control):** Deterministically defaults to `bias: neutral, confidence: 0.0` (Cash preservation).
- **Key Source Code Files:**
  - [`apps/api/src/agents/coordinator/consensus.ts`](../apps/api/src/agents/coordinator/consensus.ts) — `evaluateConsensus()`.
  - [`apps/api/src/agents/coordinator/debate.ts`](../apps/api/src/agents/coordinator/debate.ts) — `DebateSynthesizer.synthesize()`.
  - [`packages/contracts/src/debate.ts`](../packages/contracts/src/debate.ts) — `DebateSynthesis` contract schema.
- **External API:** Anthropic Claude / Google Gemini API for debate adjudication.
- **How to Live Demo:** Open `http://localhost:5173/observatory`, select the **Debate vs. Ablation** preset, and demonstrate how debate synthesis generates superior risk-adjusted alpha over the neutral ablation.

---

### Feature 4 (Module 3 / Lab 7): Macro Prediction Market Specialist (Polymarket) & Immutable Decision Lineage DAG Engine
- **Module Mapping:** Module 3 / Lab 7 (Prediction Markets & Complete Provenance Auditing)
- **User-Facing Overview:** Users can audit any past trade by clicking a decision node to inspect the exact historical OHLCV chart, indicator numbers, news headlines, prediction market odds, rendered AI prompts, raw completions, and debate transcripts that created the order.
- **System Architecture:** `PolymarketAgent` queries historical Polymarket Gamma API probability curves (FOMC rates, CPI inflation, recession probabilities) strictly bounded by `as_of <= T_decision`. `DecisionLineageRecorder` captures the full immutable DAG snapshot for every decision cycle.
- **Key Source Code Files:**
  - [`apps/api/src/agents/polymarket/agent.ts`](../apps/api/src/agents/polymarket/agent.ts) — `PolymarketAgent`.
  - [`apps/api/src/agents/coordinator/lineage.ts`](../apps/api/src/agents/coordinator/lineage.ts) — `DecisionLineageRecorder`.
  - [`packages/contracts/src/lineage.ts`](../packages/contracts/src/lineage.ts) — `DecisionLineageRecord` schema.
- **External API:** Polymarket Gamma API & CLOB crowdsourced probability curves.
- **How to Live Demo:** Open `http://localhost:5173/lineage` and step through decisions with keyboard arrow keys (`←`/`→`) to audit prompt inputs and model completions.

---

### Feature 5 (Module 3 / Lab 7 / Final): Multi-Round Adversarial Debate Protocol ($R=2$) & Model Context Protocol (MCP) Server
- **Module Mapping:** Module 3 / Lab 7 / Final Architecture (Advanced Consensus & MCP Tool Integration)
- **User-Facing Overview:** Specialists enter a structured 2-round cross-examination where the Technical analyst critiques lagging sentiment, and the Sentiment analyst rebuts lagging technicals before final adjudication. External AI agents (Claude Desktop, Cursor, Antigravity) can connect directly via MCP to run backtests, inspect indicators, and query trading decisions.
- **System Architecture:** Implements `synthesizeMultiRound()` in `DebateSynthesizer`, generating structured `DebateCritique` objects during Round 1 before final Round 2 adjudication. Provisions a Model Context Protocol (MCP) server exposing 8 tools via Stdio and HTTP SSE (`POST /mcp`).
- **Key Source Code Files:**
  - [`apps/api/src/agents/coordinator/debate.ts`](../apps/api/src/agents/coordinator/debate.ts) — `synthesizeMultiRound()`, `generateCritiques()`.
  - [`apps/api/src/mcp/server.ts`](../apps/api/src/mcp/server.ts) & [`tools.ts`](../apps/api/src/mcp/tools.ts) — Fastify MCP Server & tool endpoints.
  - [`packages/contracts/src/debate.ts`](../packages/contracts/src/debate.ts) — `DebateCritique`, `MultiRoundDebateResult`.
- **External API:** Model Context Protocol (MCP) JSON-RPC 2.0 transport over Stdio CLI (`pnpm mcp:server`) and Fastify HTTP.
- **How to Live Demo:** Run `pnpm mcp:server` or send a JSON-RPC 2.0 POST request to `http://localhost:3000/mcp` calling `quant_evaluate_multiagent`.

---

# SECTION 2: Member 2 (M2) — Quant & Data Lead
**GitHub:** `@afnan-mojumder` | **Email:** `afnan.mojumder@gmail.com` | **Domain:** Indicators, Backtest Simulator, Anti-Leakage TemporalGuard, Replay CLI, Portfolio Allocator

---

### Feature 1 (Module 1 / Lab 5): Point-in-Time Market Data Ingestion & Python Quantitative Microservice
- **Module Mapping:** Module 1 / Lab 5 (Data Layer Foundation)
- **User-Facing Overview:** Ingests live and historical stock market bars from broker feeds and computes institutional-grade technical indicators and backtests without manual spreadsheet calculation.
- **System Architecture:** Built the Alpaca Market Data v2 API ingestion client with filesystem caching (`FsCache`) and PostgreSQL idempotent upserts. Built the `apps/quant` FastAPI microservice executing vectorized indicator calculations using `pandas` and `pandas-ta` alongside the event-driven `BacktestHarness`.
- **Key Source Code Files:**
  - [`apps/api/src/ingest/alpaca-client.ts`](../apps/api/src/ingest/alpaca-client.ts) — `AlpacaMarketDataClient`.
  - [`apps/api/src/ingest/as-of.ts`](../apps/api/src/ingest/as-of.ts) — `filterBarsPointInTime()`.
  - [`apps/quant/app/main.py`](../apps/quant/app/main.py) & [`indicators/engine.py`](../apps/quant/app/indicators/engine.py) — FastAPI Python quant service.
- **External API:** Alpaca Market Data v2 API (`/v2/stocks/bars`).
- **How to Live Demo:** Post historical OHLCV bars to `http://localhost:8000/indicators` or run `pnpm ingest:prices --symbol AAPL --asOf 2024-12-31`.

---

### Feature 2 (Module 2 / Lab 6): Point-in-Time TemporalGuard & Zero-Credential Anti-Leakage CI Gate
- **Module Mapping:** Module 2 / Lab 6 (Data Integrity & Anti-Leakage Gate)
- **User-Facing Overview:** Guarantees that backtests and AI decisions are 100% scientifically honest. The system makes it impossible for future data to leak into past decisions, ensuring backtest equity curves reflect real-world execution.
- **System Architecture:** `TemporalGuard` enforces point-in-time isolation across bars, news, filings, and prediction markets. If any query observes a record timestamped $> T_{\text{decision}}$, it instantly throws a `TemporalIntegrityViolation` error. Includes frozen offline datasets for zero-credential operation.
- **Key Source Code Files:**
  - [`packages/fixtures/src/temporal-guard.ts`](../packages/fixtures/src/temporal-guard.ts) — `TemporalGuard.filter()`, `assertNoLeakage()`, `TemporalIntegrityViolation`.
  - [`packages/fixtures/src/loader.ts`](../packages/fixtures/src/loader.ts) — `loadFixture()`, `loadPriceBars()`, `loadNews()`.
  - [`packages/fixtures/tests/anti-leakage.test.ts`](../packages/fixtures/tests/anti-leakage.test.ts) — Anti-leakage test suite.
- **External API:** Pre-bundled, zero-credential historical datasets (AAPL, NVDA, SPY, MSFT, GOOGL, TLT, QQQ) with frozen Alpaca bars, Benzinga news, and SEC Edgar filings.
- **How to Live Demo:** Run `pnpm --filter @committee/fixtures test` to prove that any future record access throws an explicit `TemporalIntegrityViolation`.

---

### Feature 3 (Module 3 / Lab 7): Pure TypeScript Mathematical Indicator Engine & Deterministic Baseline Simulator
- **Module Mapping:** Module 3 / Lab 7 (Deterministic Baselines & High-Performance Indicators)
- **User-Facing Overview:** Runs ultra-fast historical simulations of classic trading strategies (Buy & Hold, 20/50-day SMA + 14-day RSI crossovers) alongside AI strategies, computing financial metrics (Sharpe, Sortino, Max Drawdown).
- **System Architecture:** Hand-rolled zero-dependency pure TypeScript indicator engine implementing Wilder's Smoothing RMA, Exponential Moving Average (EMA), Population Standard Deviation Bollinger Bands, and MACD. `BacktestSimulator` accurately models 1-bar execution delay ($T \to T+1$ open), 5 bps (0.05%) transaction costs, and cash slippage.
- **Formulas Implemented:**
  - **Sharpe Ratio:** $\text{Sharpe} = \frac{\bar{R}_p - R_f}{\sigma_p} \cdot \sqrt{252}$
  - **Sortino Ratio:** $\text{Sortino} = \frac{\bar{R}_p - R_f}{\sigma_{\text{downside}}} \cdot \sqrt{252}$
  - **Wilder RSI Formula:** $\text{RSI} = 100 - \frac{100}{1 + \frac{\text{RMA}(\text{Gain}, 14)}{\text{RMA}(\text{Loss}, 14)}}$
- **Key Source Code Files:**
  - [`apps/api/src/indicators/core.ts`](../apps/api/src/indicators/core.ts) — `sma()`, `ema()`, `wilderRma()`, `rsi()`, `macd()`, `bollinger()`.
  - [`apps/api/src/backtest/simulator.ts`](../apps/api/src/backtest/simulator.ts) — `BacktestSimulator`.
  - [`apps/api/src/backtest/metrics.ts`](../apps/api/src/backtest/metrics.ts) — `calculateTearsheetMetrics()`.
- **External API:** Zero external API or network dependencies; 100% deterministic Node.js/TypeScript computation.
- **How to Live Demo:** Run `pnpm --filter @committee/api test tests/indicators.core.test.ts` to show bit-for-bit mathematical accuracy against standard benchmarks.

---

### Feature 4 (Module 3 / Lab 7): Immutable Experiment Manifest Engine & Zero-Credential Offline Replay CLI
- **Module Mapping:** Module 3 / Lab 7 (Reproducibility & Offline Replay)
- **User-Facing Overview:** Developers can clone the repository and run a single command (`pnpm demo:replay`) to execute the full evaluation lab locally in < 3.5 seconds at $0.00 cost without requiring any API keys.
- **System Architecture:** Generates immutable `ExperimentManifest` JSON objects containing cryptographic hashes (`SHA-256`) of dataset fixtures, prompt templates, model configurations, full equity curves, trades, and baseline comparative deltas.
- **Key Source Code Files:**
  - [`apps/api/src/cli/replay.ts`](../apps/api/src/cli/replay.ts) — Replay CLI executable.
  - [`apps/api/src/experiments/suite.ts`](../apps/api/src/experiments/suite.ts) — `runBenchmarkSuite()`.
  - [`apps/api/src/experiments/hash.ts`](../apps/api/src/experiments/hash.ts) — `computeDatasetHash()`.
- **External API:** Zero-credential offline execution using frozen local datasets.
- **How to Live Demo:** Execute `pnpm demo:replay` in the terminal to demonstrate sub-5-second execution with full console tearsheet output.

---

### Feature 5 (Module 3 / Lab 7 / Final): Multi-Asset Portfolio Allocation Engine & Market Calendar Guard
- **Module Mapping:** Module 3 / Lab 7 / Final Platform (Multi-Asset Risk & Allocation)
- **User-Facing Overview:** Dynamically balances capital across multiple stock holdings (AAPL, NVDA, SPY, MSFT, GOOGL, TLT, QQQ) based on risk and volatility, ensuring cash buffers are preserved. Automatically halts trading on weekends, NYSE market holidays, and adjusts for 13:00 ET early market closes.
- **System Architecture:** `PositionAllocatorEngine` calculates 20-day rolling annualized log-return volatility and optimal Fractional Kelly position weights ($f^*$). `allocatePortfolio()` scales multi-asset exposure to preserve liquidity buffers ($1 - \text{cashBuffer}$). `MarketCalendarGuard` asserts NYSE trading schedules and throws on weekend/holiday executions.
- **Mathematical Allocation Formulas:**
  - **Rolling Realized Volatility:** $\sigma_{\text{annualized}} = \sqrt{\frac{1}{N-1}\sum_{i=1}^N \left(\ln\frac{P_i}{P_{i-1}} - \mu\right)^2} \cdot \sqrt{252}$
  - **Fractional Kelly Criterion:** $f^* = \left(\frac{p(b+1) - 1}{b}\right) \cdot \kappa \quad (\kappa = 0.25)$
- **Key Source Code Files:**
  - [`apps/api/src/portfolio/allocator.ts`](../apps/api/src/portfolio/allocator.ts) — `PositionAllocatorEngine`.
  - [`packages/fixtures/src/market-calendar.ts`](../packages/fixtures/src/market-calendar.ts) — `MarketCalendarGuard`, `US_EQUITY_HOLIDAYS`.
  - [`packages/contracts/src/allocation.ts`](../packages/contracts/src/allocation.ts) — `PositionAllocation` schema.
- **External API:** NYSE / NASDAQ Official Holiday Engine (2023–2026).
- **How to Live Demo:** Open `http://localhost:5173/observatory`, select **Universe Basket (AAPL+NVDA+SPY)**, and view the live allocation weights.

---

# SECTION 3: Member 3 (M3) — Frontend & UI Lead
**GitHub:** `@capitalD10` | **Email:** `unjurndaniel05@gmail.com` | **Domain:** Observatory UI, Decision Lineage Inspector, Signals Radar UI, Agent Config Center, Theme Engine

---

### Feature 1 (Module 1 / Lab 5): Real-Time Paper Portfolio Dashboard & KPI Telemetry Suite
- **Module Mapping:** Module 1 / Lab 5 (Dashboard Shell & Portfolio Telemetry)
- **User-Facing Overview:** An institutional-grade financial overview dashboard (`/`). At a glance, users monitor four top-level financial KPI metric tiles (Total Portfolio Value, Day P&L with color-coded trend pills, Liquid Cash / Buying Power, and Active Positions Count), an interactive equity value history area chart with crosshairs and tooltips, a comprehensive tabular breakdown of open stock positions, and a Specialist Agent Activity Card showing the latest committee deliberation.
- **System Architecture:** Built with React 18, Vite, and Tailwind CSS. Adheres strictly to the **"Composition, Not Computation" Law**: the frontend never performs financial math in the browser; it renders validated server-computed values from Fastify endpoints. Employs independent React Query states with dedicated Skeleton loaders (`KpiRowSkeleton`) and empty state handlers.
- **Key Source Code Files:**
  - [`apps/web/src/routes/PortfolioPage.tsx`](../apps/web/src/routes/PortfolioPage.tsx) — Main dashboard route.
  - [`apps/web/src/components/portfolio/KpiRow.tsx`](../apps/web/src/components/portfolio/KpiRow.tsx) — Responsive KPI row.
  - [`apps/web/src/components/portfolio/PortfolioValueChart.tsx`](../apps/web/src/components/portfolio/PortfolioValueChart.tsx) — Recharts area chart.
  - [`apps/web/src/components/portfolio/PositionsTable.tsx`](../apps/web/src/components/portfolio/PositionsTable.tsx) — Position holdings table.
- **External API:** Downstream consumer of Alpaca paper account endpoints proxied securely through the API backend.
- **How to Live Demo:** Open `http://localhost:5173/` and demonstrate live KPI metrics, area chart crosshairs, and positions table.

---

### Feature 2 (Module 2 / Lab 6): Experiment Observatory Comparison Tearsheet & Multi-Series Equity Engine
- **Module Mapping:** Module 2 / Lab 6 (Observatory UI & Multi-Series Benchmarks)
- **User-Facing Overview:** A scientific strategy benchmarking observatory (`/observatory`). Researchers benchmark structured multi-agent LLM systems against deterministic baselines (Buy & Hold, SMA 20/50 + RSI 14 Crossover). Renders a comprehensive financial tearsheet table calculating total returns, annualized returns, Sharpe ratio, Sortino ratio, max drawdown, win rate, directional accuracy, Brier calibration score, token cost, and latency deltas ($\Delta$) relative to Buy & Hold.
- **System Architecture:** Built with Recharts `ComposedChart` supporting synchronized crosshairs, categorical series styling (dashed line for Buy & Hold benchmark, solid series tokens for agent workflows), and an accessible "View as Table" twin. Handles full matrix rendering for multi-asset portfolios and single-asset experiments with sub-second recalculation.
- **Key Source Code Files:**
  - [`apps/web/src/routes/ObservatoryPage.tsx`](../apps/web/src/routes/ObservatoryPage.tsx) — Observatory page route.
  - [`apps/web/src/components/observatory/ExperimentTearsheet.tsx`](../apps/web/src/components/observatory/ExperimentTearsheet.tsx) — Financial tearsheet matrix with delta badges.
  - [`apps/web/src/components/observatory/MultiSeriesEquityChart.tsx`](../apps/web/src/components/observatory/MultiSeriesEquityChart.tsx) — Synchronized Recharts multi-line chart.
  - [`apps/web/src/components/observatory/ObservatoryControls.tsx`](../apps/web/src/components/observatory/ObservatoryControls.tsx) — Ticker and strategy toggle controls.
- **External API:** Integrates with Fastify Experiment Orchestrator (`GET /experiments/suite?symbol=AAPL`) backed by Alpaca market fixtures and SEC EDGAR filings.
- **How to Live Demo:** Open `http://localhost:5173/observatory`, switch ticker between `AAPL`, `NVDA`, `SPY`, and toggle strategies on/off.

---

### Feature 3 (Module 3 / Lab 7): Interactive Decision Lineage DAG Inspector & Telemetry HUD
- **Module Mapping:** Module 3 / Lab 7 (Decision Lineage DAG Inspector)
- **User-Facing Overview:** A forensic provenance workspace (`/lineage`) providing point-in-time explainability for every historical decision point. Users click any bar or use keyboard arrow keys (`←`/`→`) to step through time across 4 deep inspection tabs:
  1. **Inputs Tab:** Exact OHLCV bar wicks, Wilder RSI / MACD / Bollinger indicators, SEC EDGAR 10-Q/10-K financial ratios, and Benzinga news headlines known at that bar.
  2. **Debate Tab:** Specialist agent votes (`bullish`/`bearish`/`neutral`), consensus check status, full debate dialogue transcripts, and dissenting minority arguments.
  3. **Prompts & Completions Tab:** Exact rendered system/user prompts sent to Anthropic/Gemini and raw schema-validated LLM completions with copy-to-clipboard buttons and Zod validation status badges.
  4. **Execution Tab:** Deterministic Risk Gate rules evaluation (passed/failed), capital allocation sizing, and order routing audit records.
- **System Architecture:** Strictly adheres to Provenance & Anti-Fabrication Laws. Uses bar index alignment between `equityCurve` and `lineageRecords` for rock-solid temporal synchronization.
- **Key Source Code Files:**
  - [`apps/web/src/routes/LineagePage.tsx`](../apps/web/src/routes/LineagePage.tsx) — Dedicated 765-line lineage explorer route.
  - [`apps/web/src/components/lineage/DecisionInspector.tsx`](../apps/web/src/components/lineage/DecisionInspector.tsx) — 4-tab provenance workspace.
- **External API:** LLM completion & market data provenance backed by Anthropic Claude, Google Gemini, Alpaca historical bars, and SEC EDGAR filings.
- **How to Live Demo:** Open `http://localhost:5173/lineage`, press `ArrowLeft` / `ArrowRight` to step through time, switch between all 4 tabs, and click `Copy Prompt`.

---

### Feature 4 (Module 3 / Lab 7): Live Market Signals Radar & Indicator Gauge Dashboard
- **Module Mapping:** Module 3 / Lab 7 (Live Market Signals & Indicator Radar)
- **User-Facing Overview:** A real-time market scanner and multi-gauge indicator dashboard (`/signals`). For any watchlist asset (`AAPL`, `NVDA`, `SPY`), it renders SVG radial gauges for Wilder RSI, MACD histogram momentum, and Bollinger Bands %B and volatility bandwidth, alongside SMA 20/50 trend status. Below the gauges, it displays the live Specialist Agent Stance Radar (Technical, Sentiment, Fundamental, Polymarket) with directional bias badges, confidence meters, consensus resolution, and an "Evaluate Committee Stance" trigger button that runs on-demand multi-agent deliberation.
- **System Architecture:** Employs dual-mode updates: REST polling via `useSignalsRadar` and live streaming via `useMarketStream` WebSocket connection. When users trigger "Evaluate Committee Stance", it dispatches `POST /signals/evaluate`, runs the multi-agent consensus pipeline with failure isolation, and updates the radar gauges and specialist cards with sub-second latency.
- **Key Source Code Files:**
  - [`apps/web/src/routes/SignalsPage.tsx`](../apps/web/src/routes/SignalsPage.tsx) — Complete 590-line signal dashboard route.
  - [`apps/web/src/lib/useMarketStream.ts`](../apps/web/src/lib/useMarketStream.ts) — Real-time WebSocket hook.
  - [`packages/contracts/src/signals-radar.ts`](../packages/contracts/src/signals-radar.ts) — Radar Zod schemas.
- **External API:** Live Alpaca WebSocket stream (`wss://stream.data.alpaca.markets/v2/iex`) and Benzinga News / Polymarket Gamma API endpoints.
- **How to Live Demo:** Open `http://localhost:5173/signals`, select `NVDA`, inspect animated SVG gauges, and click `⚡ Evaluate Now`.

---

### Feature 5 (Module 3 / Lab 7 / Final): Empirical Variance Sweep Confidence Envelopes ($\pm 1\sigma$), Macro Ablation Controls & Daemon HUD
- **Module Mapping:** Module 3 / Lab 7 / Final (Variance Envelopes & Autonomous Daemon UI)
- **User-Facing Overview:**
  1. **Empirical Variance Sweep Envelopes:** Renders $\pm 1\sigma$ standard deviation shaded confidence bands around the multi-agent equity curve across $N=3$ stochastic runs, revealing model variance and strategy stability.
  2. **Honest Budget & Sweep Telemetry:** Live badge displaying either "Deterministic N=3 Sweep (offline replay) at $0.00 spend" or "Live Stochastic Sweep ($X.XX spend)" with budget ceiling alerts (< $5.00).
  3. **Macro Ablation Controls:** Toolbar controls to toggle Polymarket Macro Odds specialist on/off to isolate the empirical value of prediction market signals.
  4. **Autonomous Trading Daemon Control Card:** Embedded HUD on `/signals` displaying background daemon status (State: `RUNNING` / `IDLE`), uptime, cycle counter, last/next cycle timestamp, "Start/Pause Daemon" button, "Run Cycle Now" button, and Dry-Run mode toggle.
- **System Architecture:** Integrates with `BudgetGuard` and `TradingDaemonService` over Fastify REST. `MultiSeriesEquityChart` computes stacked transparent base areas and upper-minus-lower delta fills to render mathematical $\pm 1\sigma$ envelopes. `DaemonControlCard` polls `/daemon/status` and dispatches start/stop/config mutations with optimistic UI feedback.
- **Key Source Code Files:**
  - [`apps/web/src/components/observatory/MultiSeriesEquityChart.tsx`](../apps/web/src/components/observatory/MultiSeriesEquityChart.tsx) — Recharts `<Area>` confidence envelopes.
  - [`apps/web/src/components/daemon/DaemonControlCard.tsx`](../apps/web/src/components/daemon/DaemonControlCard.tsx) — Daemon control card component.
  - [`apps/web/src/components/observatory/ObservatoryControls.tsx`](../apps/web/src/components/observatory/ObservatoryControls.tsx) — Presets and budget telemetry pills.
- **External API:** Fastify endpoints: `GET /experiments/variance-sweep`, `GET /daemon/status`, `POST /daemon/run-cycle`.
- **How to Live Demo:** Open `http://localhost:5173/observatory`, click the **Deterministic Sweep ($N=3$)** preset to observe shaded $\pm 1\sigma$ confidence bands, then switch to `/signals` and click **Run Cycle Now** on the Daemon card.

---

# SECTION 4: Member 4 (M4) — Platform & Risk Lead
**GitHub:** `@ironhead2002` | **Email:** `nnr.rudra123@gmail.com` | **Domain:** Database Architecture, Risk Rules Engine, WebSocket Streamer, Autonomous Daemon, Telegram Bot

---

### Feature 1 (Module 1 / Lab 5): Point-in-Time Database Schema, Relational Migrations & Temporal Data Engine
- **Module Mapping:** Module 1 / Lab 5 (Database Architecture & Temporal Integrity)
- **User-Facing Overview:** Ensures absolute point-in-time data integrity and reproducible evaluation across the entire trading platform. Guarantees that historical backtests, live agent deliberations, and portfolio audits never suffer from look-ahead bias or corrupted market states.
- **System Architecture:** Architected using PostgreSQL 16 (`pgvector`) and Drizzle ORM. Every market fact table (`price_bars`, `indicator_snapshots`, `news_articles`, `sec_filings`, `prediction_market_odds`) is designed with a strict two-timestamp model: `ts` (the market time the datum represents) and `as_of` (the exact point-in-time boundary when the datum became knowable to an observer). Features automated TypeScript migrations (`migrate.ts`), idempotent seed generator (`seed.ts`) with deterministic password hashing, composite indexes (`on(symbol, timeframe, ts)` and `on(asOf)`) for high-performance temporal range queries.
- **Key Source Code Files:**
  - [`packages/db/src/schema/market.ts`](../packages/db/src/schema/market.ts) — Drizzle schema for `price_bars` and `indicator_snapshots`.
  - [`packages/db/src/schema/agents.ts`](../packages/db/src/schema/agents.ts) — Schema for `agent_runs`, `decisions`, `debate_transcripts`, `orders`.
  - [`packages/db/src/migrate.ts`](../packages/db/src/migrate.ts) & [`seed.ts`](../packages/db/src/seed.ts) — Migration and seed runner.
- **External API:** PostgreSQL 16 + `pgvector` container with vector embedding support.
- **How to Live Demo:** Run `pnpm db:migrate && pnpm db:seed` and show the idempotent seed creation of `demo@committee.local` with watchlist items.

---

### Feature 2 (Module 2 / Lab 6): Deterministic Risk Gate Engine & Hard-Constraint Compliance Validator
- **Module Mapping:** Module 2 / Lab 6 (Deterministic Risk Gate Engine & Hard Constraints)
- **User-Facing Overview:** A non-negotiable safety barrier protecting trading capital against reckless agent recommendations or extreme market regimes. Evaluates proposed trades against 5 institutional risk constraints, automatically blocking or sizing down trades regardless of how confident the LLM committee is. Users receive clear, explainable audit records detailing exactly which risk rules passed, modified, or rejected the order.
- **System Architecture:** 100% deterministic TypeScript algorithmic rules engine (zero LLM calls). Evaluates:
  1. `evaluateConfidenceThresholdRule`: Rejects trades with committee confidence below 0.60.
  2. `evaluateDrawdownCircuitBreakerRule`: Halts all buying if current portfolio drawdown exceeds 15%.
  3. `evaluateMinCashReserveRule`: Blocks buys that would reduce cash balance below 20% total equity.
  4. `evaluateMaxExposureRule`: Caps individual position gross exposure at 25% of portfolio equity.
  5. `evaluateVolatilityCeilingRule`: Reduces notional order size if 20-day annualized realized volatility exceeds 35%.
- **Key Source Code Files:**
  - [`apps/api/src/risk/engine.ts`](../apps/api/src/risk/engine.ts) — `RiskGateEngine`.
  - [`apps/api/src/risk/rules/drawdown-circuit-breaker.ts`](../apps/api/src/risk/rules/drawdown-circuit-breaker.ts) — Drawdown circuit breaker rule.
  - [`apps/api/src/risk/rules/min-cash-reserve.ts`](../apps/api/src/risk/rules/min-cash-reserve.ts) — 20% cash reserve rule.
  - [`apps/api/src/risk/rules/max-exposure.ts`](../apps/api/src/risk/rules/max-exposure.ts) — 25% max exposure rule.
  - [`packages/contracts/src/risk.ts`](../packages/contracts/src/risk.ts) — `RiskAssessment` schema.
- **External API:** Internal algorithmic engine; isolates broker routing logic downstream.
- **How to Live Demo:** Run `pnpm --filter @committee/api test tests/risk.engine.test.ts` to demonstrate how circuit breakers halt trades during drawdown conditions.

---

### Feature 3 (Module 3 / Lab 7): Live Alpaca WebSocket Market Streamer & Autonomous Trading Daemon
- **Module Mapping:** Module 3 / Lab 7 (Live WebSocket Streaming & Background Autonomous Trading Daemon)
- **User-Facing Overview:** Provides continuous, autonomous operation of the trading platform. The Autonomous Trading Daemon runs in the background, listening to real-time market data ticks from Alpaca or timer intervals, triggering the multi-agent committee to evaluate assets, assessing risk, and executing paper orders without requiring manual user clicks. Users can monitor live connection status, start/pause the daemon, trigger manual cycles, and toggle dry-run safety mode.
- **System Architecture:**
  - `AlpacaWebSocketClient`: Connects to Alpaca's v2 streaming endpoint (`wss://stream.data.alpaca.markets/v2/iex`) using Node 22 native WebSockets, handles authentication, bar/quote/trade subscription multiplexing, exponential backoff reconnection, and event dispatching.
  - `TradingDaemonService`: Manages daemon state lifecycle (`idle`, `running`, `paused`, `error`), scheduled interval timers, concurrent execution mutex locks (preventing overlapping runs), per-cycle error isolation, and broadcast of status updates.
- **Key Source Code Files:**
  - [`apps/api/src/streaming/alpaca-stream.ts`](../apps/api/src/streaming/alpaca-stream.ts) — `AlpacaWebSocketClient`.
  - [`apps/api/src/daemon/service.ts`](../apps/api/src/daemon/service.ts) — `TradingDaemonService`.
  - [`apps/api/src/daemon/plugin.ts`](../apps/api/src/daemon/plugin.ts) — Fastify daemon endpoints.
  - [`apps/api/src/streaming/engine.ts`](../apps/api/src/streaming/engine.ts) — MarketStreamEngine.
- **External API:** Alpaca Streaming WebSocket (`wss://stream.data.alpaca.markets/v2/iex`) and Alpaca Paper Trading REST API (`POST /v2/orders`).
- **How to Live Demo:** Trigger `POST http://localhost:3000/daemon/run-cycle` and observe automated multi-asset order generation across AAPL, NVDA, and SPY.

---

### Feature 4 (Module 3 / Lab 7): Interactive 2-Way Telegram Trade Approval State Machine & Webhook Controller
- **Module Mapping:** Module 3 / Lab 7 (Interactive 2-Way Telegram Approval Bot & Webhook State Machine)
- **User-Facing Overview:** A mobile human-in-the-loop trade authorization system via Telegram. When the Committee decides on a high-conviction trade, the bot sends an alert containing the asset, side, allocated shares, estimated notional, and specialist rationale, accompanied by inline interactive buttons: `[✅ Approve Trade]` and `[❌ Reject Trade]`. The user can tap either button in Telegram or reply with `/approve <id>` / `/reject <id>`. The bot updates the message in-place with the resolution and immediately routes approved trades to Alpaca for execution.
- **System Architecture:** Complete finite state machine managing pending trade approvals (`pending` $\to$ `approved` | `rejected` | `expired`). Includes:
  - `PendingTradeApprovalStore`: Thread-safe approval store supporting UUID or 8-character prefix lookups, active TTL timer expiration (auto-cancels trades unapproved after 5 minutes), and double-click idempotency locks.
  - `TelegramBotService` & `TelegramCommandHandler`: Handles incoming webhook updates (`/start`, `/portfolio`, `/pending`, `/latest`, `/approve`, `/reject`), callback queries (`callback_query.data`), and routes approved executions to `ExecutionRouter`.
- **Key Source Code Files:**
  - [`apps/api/src/telegram/approval-store.ts`](../apps/api/src/telegram/approval-store.ts) — `PendingTradeApprovalStore`.
  - [`apps/api/src/telegram/service.ts`](../apps/api/src/telegram/service.ts) — `TelegramBotService`.
  - [`apps/api/src/telegram/commands.ts`](../apps/api/src/telegram/commands.ts) — `TelegramCommandHandler`.
  - [`apps/api/src/telegram/plugin.ts`](../apps/api/src/telegram/plugin.ts) — Fastify routes (`POST /telegram/webhook`, `POST /telegram/approvals/:id/approve`).
- **External API:** Telegram Bot API (`https://api.telegram.org/bot<TOKEN>/sendMessage`, `editMessageText`, `answerCallbackQuery`) and Alpaca Paper Trading REST API.
- **How to Live Demo:** Run `pnpm --filter @committee/api test tests/telegram.approval.test.ts` to demonstrate the full approval lifecycle, prefix resolution, and execution dispatch.

---

### Feature 5 (Module 3 / Lab 7 / Final): BudgetGuard Hard Spend Ceiling Enforcer ($5.00) & Empirical Variance Sweep Engine
- **Module Mapping:** Module 3 / Lab 7 / Final (BudgetGuard Spend Ceiling & Empirical Variance Sweep Harness)
- **User-Facing Overview:** A safety and empirical benchmarking system preventing runaway LLM costs while running scientific experiments. Enforces a strict $5.00 monetary spend cap per sweep / session. When running empirical variance sweeps across $N=3$ stochastic runs, it orchestrates parallel multi-agent backtests across temperature seeds, calculates pointwise mean and $\pm 1\sigma$ standard deviation equity corridors, and returns comprehensive statistical distributions (mean, stdDev, variance, min, max) across financial metrics.
- **System Architecture:**
  - `BudgetGuard`: Tracks cumulative prompt and completion tokens across Anthropic and Gemini rate cards. Features `assertBudget(estimatedCost)` before any LLM invocation and throws `BudgetExceededError` if the ceiling would be breached.
  - `runVarianceSweep`: Slices a focused validation window (20–30 bars), executes $N$ independent stochastic runs with budget verification, synchronizes pointwise equity arrays, computes sample variance ($s^2 = \frac{\sum (x_i - \bar{x})^2}{N - 1}$) and standard deviation ($s = \sqrt{s^2}$), and constructs `VarianceSweepResult`.
- **Key Source Code Files:**
  - [`apps/api/src/experiments/budget.ts`](../apps/api/src/experiments/budget.ts) — `BudgetGuard`, `BudgetExceededError`.
  - [`apps/api/src/experiments/variance-sweep.ts`](../apps/api/src/experiments/variance-sweep.ts) — `runVarianceSweep`.
  - [`apps/api/src/experiments/plugin.ts`](../apps/api/src/experiments/plugin.ts) — Fastify experiment endpoints.
- **External API:** Anthropic Claude API / Google Gemini API token usage rate cards.
- **How to Live Demo:** Trigger `GET http://localhost:3000/experiments/variance-sweep?symbol=AAPL&windowSize=25&runs=3` to inspect statistical metric distributions and $\pm 1\sigma$ variance bounds.

---

# SECTION 5: Comprehensive Final Demo Walkthrough Script

### Step 1: Pre-Flight Health Check (All Members)
```bash
# Verify doctor health check across API, Web, Postgres, and Fixtures
bash .agents/skills/verify-committee/scripts/doctor.sh
```

### Step 2: M2 Showcase (Quant & Data Pipeline)
1. **Explain:** Point-in-time data discipline and why look-ahead bias invalidates financial research.
2. **Execute:** `pnpm demo:replay` — demonstrate the offline benchmark replay running in 3.2 seconds at $0.00 cost across AAPL, NVDA, and SPY.
3. **Show Code:** Open [`packages/fixtures/src/temporal-guard.ts`](../packages/fixtures/src/temporal-guard.ts) and [`apps/api/src/indicators/core.ts`](../apps/api/src/indicators/core.ts).

### Step 3: M1 Showcase (Multi-Agent Architecture & Debate)
1. **Explain:** Specialist agent decomposition (Technical, Sentiment, Fundamental, Polymarket) and the conditional debate protocol.
2. **Execute:** Open `http://localhost:5173/observatory` -> Select preset **Debate vs. Ablation**. Show how Debate ON out-performs Debate OFF by reconciling conflicting specialist stances.
3. **Show Code:** Open [`apps/api/src/agents/coordinator/debate.ts`](../apps/api/src/agents/coordinator/debate.ts) and [`apps/api/src/mcp/server.ts`](../apps/api/src/mcp/server.ts).

### Step 4: M3 Showcase (Frontend & Decision Lineage Inspector)
1. **Explain:** Impeccable Operate UI design, Recharts multi-series curves, and the 4-tab provenance workspace.
2. **Execute:** 
   - On `http://localhost:5173/observatory`, toggle **Universe Basket (AAPL+NVDA+SPY)** to display cross-asset allocation bars.
   - Click **Audit Lineage** (`/lineage`) -> use `ArrowLeft`/`ArrowRight` to step through time -> inspect Prompts and click **Copy Prompt**.
   - Navigate to `/signals` -> inspect animated SVG indicator gauges -> click **⚡ Evaluate Now**.
3. **Show Code:** Open [`apps/web/src/routes/LineagePage.tsx`](../apps/web/src/routes/LineagePage.tsx) and [`apps/web/src/routes/SignalsPage.tsx`](../apps/web/src/routes/SignalsPage.tsx).

### Step 5: M4 Showcase (Platform, Risk Gates & Telegram Bot)
1. **Explain:** Deterministic 5-rule risk engine, background trading daemon, and 2-way Telegram approval state machine.
2. **Execute:**
   - On `http://localhost:5173/signals`, scroll to **Autonomous Trading Daemon HUD** -> click **Run Cycle Now** to demonstrate automated multi-asset order generation.
   - Run `pnpm test apps/api/tests/telegram.approval.test.ts` to demonstrate interactive Telegram trade approval state transitions.
3. **Show Code:** Open [`apps/api/src/risk/engine.ts`](../apps/api/src/risk/engine.ts) and [`apps/api/src/telegram/approval-store.ts`](../apps/api/src/telegram/approval-store.ts).

---

# SECTION 6: Project Guideline Compliance Checklist

- [x] **Team Size:** Exactly 4 members (M1, M2, M3, M4).
- [x] **5 Features Per Member:** Each member has 5 documented, implemented, non-trivial features mapped across Module 1 (Lab 5), Module 2 (Lab 6), and Module 3 (Lab 7 / Final).
- [x] **Excluded Baseline Workflows:** Login, Signup, Logout, Role Management, and Profile Management are isolated as collaborative platform infrastructure.
- [x] **External API Integrations:**
  - **M1:** Anthropic Claude API, Google Gemini API, OpenRouter API, OpenAI API, Model Context Protocol (MCP).
  - **M2:** Alpaca Market Data v2 API, SEC EDGAR XBRL API, Benzinga News Feed.
  - **M3:** Alpaca Account & Broker State Integration, Recharts SVG Charting Engine, WebSocket Stream.
  - **M4:** Telegram Bot API (2-Way Interactive Approvals), Alpaca Paper Trading REST & WebSocket Stream API.
- [x] **Database Requirement:** PostgreSQL 16 with `pgvector` & Drizzle ORM with full dual-timestamp temporal integrity.
- [x] **UI/UX Requirement:** Responsive, mobile-friendly Tailwind CSS layout with dark/light mode token architecture.
- [x] **Version Control Rule:** Multi-author git commit history attributed per member according to `AGENTS.md`.
- [x] **Code Ownership & Live Modifications:** All files, contracts, tests, and endpoints are fully documented with runnable verification steps for live grading.
