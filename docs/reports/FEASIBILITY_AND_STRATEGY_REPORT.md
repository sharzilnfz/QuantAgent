# QuantAgent Studio (The AI Decision Observatory)
## Comprehensive Strategy, Feasibility, Gap Analysis & Project Report

---

## 1. Executive Summary & Journey Context

### Background & Initial State
One month into building **QuantAgent** for a university course (with Sprint 1 completed), a fundamental question arose:  
*Is this project a generic "AI trading bot" brute-forced from AI suggestions, or is it a genuinely strong portfolio piece?*

### Key Market Discoveries
1. **The Base Pattern is Ubiquitous:** Standard multi-agent trading bot templates (e.g., *TradingAgents* with 80k+ GitHub stars, *ai-hedge-fund* with 59k+ stars) are widespread on GitHub. Merely building a bot where 3 LLMs chat about stock charts is no longer novel.
2. **QuantAgent's Hidden Differentiators:** Unlike 99% of open-source clones, QuantAgent's Sprint 1 architecture enforces:
   - **Point-in-Time (`as_of`) Discipline:** Eliminates look-ahead bias in backtests.
   - **Facts vs. Narration:** Deterministic Python math computes technicals; LLMs never invent numbers.
   - **Hard Risk Gate:** Non-LLM deterministic rules prevent AI hallucinations from placing bad trades.
   - **Ablation & Evaluation Harness:** Empirically tests whether LLM complexity actually beats simple math rules or Buy-and-Hold.
3. **PMXT Dataset Discovery:** Found an open-source dataset and Python library (`pmxt`) providing free historical orderbook and trade data for Polymarket, solving the data cost hurdle for prediction market signals.

### The Product Strategy Shift
Rather than discarding Sprint 1 to build a commodity Polymarket clone or CRUD stock dashboard from scratch, the project pivots its narrative and user experience to **QuantAgent Studio (The AI Decision Observatory)**—an interactive, web-based sandbox and control room for visually testing and comparing AI agents against math rules and crowd prediction markets.

---

## 2. Sprint 1 Completed Work Audit (Specs 01 – 08, Architecture & Docs)

Sprint 1 successfully established the foundational architecture ("Walking Skeleton") for QuantAgent. Below is the complete record of what was specified, designed, and built during Sprint 1 across `specs/`, `packages/`, `apps/`, and `docs/`:

### 📋 Summary Table of Sprint 1 Specs

| Spec | Module / Component | Tech Stack | Layer | Status | Key Artifact Produced |
|---|---|---|---|---|---|
| **Spec 01** | Database Schema & Core Models | Postgres 16, pgvector, Drizzle ORM | L0 Data | Complete | `packages/db` schema, seeds & migrations |
| **Spec 02** | Shared Contracts Package | TypeScript, Zod, zod-to-json-schema | Cross-Cutting | Complete | `packages/contracts` (v1.0.0 npm package) |
| **Spec 03** | Auth & Credential Vault | Fastify, Argon2, AES-256-GCM | Platform | Complete | `/auth/*` & `/credentials` REST endpoints |
| **Spec 04** | Market Data Ingestion | TypeScript, Alpaca Market Data API | L0 Data | Complete | `ingest:prices` CLI & `/ingest` endpoints |
| **Spec 05** | Technical Indicator Engine | Python 3.12, FastAPI, pandas, numpy | L1 Signal | Complete | `apps/quant` microservice & backtest scaffold |
| **Spec 06** | Agent Framework & Stubs | TypeScript, Fastify | L2 Agent | Complete | `BaseAgent`, `runAgents()`, & 3 Stub agents |
| **Spec 07** | Technical Analyst Agent | Anthropic Claude API (Haiku), OpenRouter | L2 Specialist | Complete | `TechnicalAgent` & `classify.ts` pre-classifier |
| **Spec 08** | Dashboard Shell & UI | React 18, Vite, Tailwind CSS, Recharts | UI | Complete | `apps/web` SPA & Agent Activity Card |

---

### 🔍 Detailed Spec-by-Spec Breakdown

#### 📊 Spec 01: Database Schema & Core Models (`specs/sprint-1/01-m4-db-schema-core-models.md`)
- **Package**: `packages/db` (Drizzle ORM + Drizzle Kit migrations).
- **Database Engine**: PostgreSQL 16 containerized with `pgvector` and `pgcrypto` extensions enabled.
- **Fact Tables**: `price_bars` and `indicator_snapshots` with composite unique constraints `(symbol, timeframe, ts)` and indexed `as_of timestamptz NOT NULL` columns for point-in-time querying.
- **Audit & Execution Tables**: `agent_runs` (tracking `decision_ts`, execution status, runtime duration) and `agent_outputs` (storing `agent`, `direction`, `confidence`, `rationale`, and raw `evidence` JSONB).
- **Platform Tables**: `users`, `sessions` (cookie auth), `alpaca_credentials` (storing AES-256-GCM encrypted keys), and `watchlist_items`.

#### 📐 Spec 02: Shared Contracts Package (`specs/sprint-1/02-m1-shared-contracts.md`)
- **Package**: `packages/contracts` (Single source of truth npm workspace package).
- **System Enums**: `Direction` (`bullish | bearish | neutral`), `AgentName` (`technical | sentiment | fundamental`), `Timeframe` (`1Day | 1Hour`).
- **Domain Schemas**: `PriceBar`, `IndicatorSnapshot`, `AgentInput` (bounded by `decisionTs`), `AgentOutput` (`confidence` strictly `[0, 1]`, `rationale` max 2000 chars, `evidence` record), and `PortfolioState`.
- **JSON-Schema Export**: Exports `AgentOutputJsonSchema` derived via `zod-to-json-schema` to drive LLM structured tool-calling.

#### 🔐 Spec 03: User Auth & Session Management (`specs/sprint-1/03-m4-auth-session.md`)
- **App**: `apps/api/src/auth` & `apps/api/src/credentials`.
- **Auth REST API**: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- **Session Security**: Server-side HTTP-only cookies with `SameSite=lax` and Argon2 password hashing.
- **Encrypted Credential Vault**: `POST /credentials` stores AES-256-GCM encrypted Alpaca API keys with authentication tags; plaintext keys are never returned to clients or logged. Fastify `requireAuth` middleware gates all protected API routes.

#### 📈 Spec 04: Market Data Ingestion Service (`specs/sprint-1/04-m2-market-data-ingestion.md`)
- **App**: `apps/api/src/ingest`.
- **Ingestion Pipeline**: Market data ingestion fetching OHLCV bars from Alpaca Market API into `price_bars`.
- **Point-in-Time (`as_of`) Stamping**: 1Day bars stamped with market session close time; 1Hour bars stamped with hour close time. Future timestamps strictly prohibited.
- **Robustness**: Idempotent upserts on `(symbol, timeframe, ts)` and exponential backoff retries for HTTP 429 rate limit responses.

#### 🧮 Spec 05: Technical Indicator Engine & Quant Service (`specs/sprint-1/05-m2-technical-indicator-engine.md`)
- **App**: `apps/quant` (Python 3.12 + FastAPI + pandas/numpy).
- **Indicator Engine**: High-performance calculation of RSI(14), MACD(12,26,9), Bollinger Bands(20,2), SMA(20), and SMA(50) exposed via `POST /indicators/compute`.
- **Backtest Scaffold**: Initial `run_backtest(strategy, bars, cash)` interface executing strategy evaluations in Python while maintaining `as_of <= decision_ts` constraints.

#### 🤖 Spec 06: Agent Framework & Stub Agents (`specs/sprint-1/06-m1-agent-framework-stubs.md`)
- **App**: `apps/api/src/agents`.
- **Polymorphic Architecture**: `Agent` interface and `BaseAgent` abstract class.
- **Failure Isolation**: `BaseAgent.analyze()` enforces a 20s timeout via `Promise.race`. Any API timeout or error gracefully degrades to a neutral `NO_OPINION` output (`{ direction: "neutral", confidence: 0 }`).
- **Parallel Orchestration**: `runAgents()` executes multiple agents concurrently using `Promise.allSettled`.
- **Stubs**: `StubTechnicalAgent`, `StubSentimentAgent`, and `StubFundamentalAgent` for deterministic unblocked frontend development.

#### 🔬 Spec 07: Technical Analyst Agent (`specs/sprint-1/07-m1-technical-analyst-agent.md`)
- **App**: `apps/api/src/agents/technical`.
- **Pre-Classifier (`classify.ts`)**: Pure TypeScript rule classifier that calculates a deterministic `MechanicalRead` from technical indicators prior to calling the LLM.
- **LLM Prompting**: Anthropic Claude Haiku integration via forced JSON tool choice (`AgentOutputJsonSchema`).
- **Facts-vs-Narration Rule**: Computed indicator facts strictly overwrite LLM-authored evidence fields (`evidence = { ...model, ...computed }`), preventing LLM numerical hallucinations.

#### 💻 Spec 08: Dashboard Shell & UI (`specs/sprint-1/08-m3-dashboard-shell-portfolio.md`)
- **App**: `apps/web` (React 18 + Vite + Tailwind CSS + Recharts + `shadcn/ui`).
- **Auth Guard**: `requireAuth` HOC pattern enforcing authentication on protected UI routes.
- **Portfolio Layout**: Real-time equity/cash KPI tiles, position holdings table, portfolio value-over-time chart (Recharts), and an "Agent Activity" card displaying colored direction badges (`BULLISH`, `BEARISH`, `NEUTRAL`), confidence meters, and rationale drawers.

---

### 📐 UML Class Diagram Architecture (`specs/sprint-1/00-class-diagram-explanation.md`)

```
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                          SYSTEM OBJECT TOPOLOGY                             │
   └─────────────────────────────────────────────────────────────────────────────┘

       User 1 ──◆ Session & WatchlistItem           PortfolioState ──> AgentRun
       AgentRun 1 ──◆ AgentOutput                   TechnicalAgent ──▲ BaseAgent
       BaseAgent ──▲ Agent (Interface)              BacktestHarness ──> PriceBar
```

The system architecture cleanly defines structural relationships:
- **`User` 1 ── ◆ `Session` / `WatchlistItem`** (Composition)
- **`AgentRun` 1 ── ◆ `AgentOutput`** (Composition)
- **`BaseAgent` ▲ - - - `Agent`** (Interface Realization)
- **`TechnicalAgent` ▲ ─── `BaseAgent`** (Class Inheritance)
- **`PortfolioState` - - -> `AgentRun`** (Context Dependency)
- **`BacktestHarness` - - -> `PriceBar` & `IndicatorEngine`** (Strategy Dependency)

---

## 3. Product Vision & Narrative Shift

### The Narrative Comparison

| Dimension | Old Framing ("AI Trading Bot") | New Framing ("AI Decision Observatory") |
| :--- | :--- | :--- |
| **Product Concept** | Automated bot placing paper trades. | Visual sandbox and benchmarking control room. |
| **Primary Goal** | Claiming AI can beat Wall Street (Unrealistic). | Demonstrating an empirical testing environment (Realistic & High Craft). |
| **User Experience** | Static dashboard / console output. | Interactive timeline "Time-Scrubber", side-by-side equity curves, debate inspector. |
| **Recruiter Hook** | *"I built a 3-agent trading bot."* | *"I built an interactive observatory that empirically tests AI reasoning against math baselines and prediction markets under strict point-in-time constraints."* |

---

## 4. Team Division of Labor (4 Teammates)

To make execution realistic and prevent burnout for a 4-person university team:

```
                                  ┌────────────────────────────────┐
                                  │   QUANTAGENT STUDIO MONOREPO   │
                                  └───────────────┬────────────────┘
                                                  │
         ┌───────────────────┬────────────────────┴───────────────────┬───────────────────┐
         │                   │                                       │                   │
         ▼                   ▼                                       ▼                   ▼
┌─────────────────┐ ┌─────────────────┐                     ┌─────────────────┐ ┌─────────────────┐
│ DEV 1: THE VAULT│ │DEV 2: QUANT MATH│                     │DEV 3: AI BRAINS │ │DEV 4: DASHBOARD │
│  (Data Pipeline)│ │ (Python Engine) │                     │ (Agents & Risk) │ │  (React Studio) │
├─────────────────┤ ├─────────────────┤                     ├─────────────────┤ ├─────────────────┤
│ • Alpaca bars   │ │ • RSI, MACD, SMA│                     │ • 3 Claude LLMs │ │ • Time-scrubber │
│ • PMXT Polymarket│ │ • Strategy runner│                    │ • Risk Gate     │ │ • Equity charts │
│ • as_of timestamps│• Backtest math  │                     │ • Zod schemas   │ │ • Debate viewer │
└─────────────────┘ └─────────────────┘                     └─────────────────┘ └─────────────────┘
```

1. **Dev 1 (Data Pipeline & Vault):** Ingests Alpaca price bars and PMXT Polymarket probability odds into Postgres; enforces `as_of` timestamp bounds (`apps/api/src/ingest`, `packages/db`).
2. **Dev 2 (Quant & Strategy Engine):** Maintains Python math indicators and executes backtest simulations for the 3 competing strategies (`apps/quant`).
3. **Dev 3 (AI Agents & Risk Safety):** Manages Anthropic Claude Haiku prompts, Zod validation, consensus voting, and the deterministic Hard Risk Gate (`apps/api/src/agents`).
4. **Dev 4 (Frontend UI Lead):** Builds the React Studio UI (`apps/web`), timeline scrubber, equity curve chart overlays, and agent debate inspector.

---

## 5. Critical Gap Analysis & Risk Evaluation

To analyze this proposal objectively with a "grain of salt", here are the potential technical gaps and risks:

| Identified Gap / Risk | Impact Level | Description | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **1. PMXT Ingestion & Mapping Overhead** | **Medium** | Polymarket market IDs do not map 1:1 to stock tickers. Parsing raw Parquet files could slow down ingestion. | Scope Polymarket integration to **2-3 major macro events** (e.g., Fed Interest Rates, Recession Odds, Tech Earnings) rather than trying to map every single stock ticker. |
| **2. Time-Scrubber UI Performance** | **Medium-High** | Rapidly dragging a slider through hundreds of historical timestamps can trigger API spam and UI lag. | Implement **client-side debouncing** on the slider and pre-fetch/cache historical snapshot slices for the selected date range. |
| **3. LLM API Cost & Latency in Backtests** | **High** | Calling Anthropic Claude Haiku for every single bar in a 365-day backtest would cost real money and take hours to run. | **Cache LLM outputs in DB (`agent_opinions`)**. Run LLM decisions only on significant bar triggers (e.g., daily closes or high-volatility events), not on every 1-minute bar. |
| **4. Scope Creep on Prediction Markets** | **Medium** | Attempting to build order matching or custom prediction market trading UI will derail the deadline. | Use Polymarket purely as an **external read-only probability signal feed** for the Sentiment Agent. Do not build prediction market order execution. |

---

## 6. Feasibility Matrix

| Component | Technical Complexity | Team Feasibility | Value to Demo |
| :--- | :--- | :--- | :--- |
| **Alpaca Stock Ingestion (`as_of`)** | Low | Already built in Spec 04 | Essential |
| **Python Indicator Math (`apps/quant`)** | Low-Medium | Already built in Spec 05 | Essential |
| **Technical Agent + Zod Validation** | Low-Medium | Already built in Spec 07 | Essential |
| **PMXT Macro Signal Ingestion** | Medium | High (using `pmxt` Python package) | High (Unique Hook) |
| **Ablation Runner (Math vs. AI vs. Hold)** | Medium | High (Python Pandas script) | High (Core Thesis) |
| **React Time-Scrubber UI** | Medium-High | High (Standard React State + Recharts) | Critical (Visual Demo) |

**Overall Feasibility Assessment:** **HIGH (8.5/10)**  
Because Sprint 1 built the hardest architectural foundations (monorepo, `as_of` database indexing, Fastify backend, Python indicator service, Zod contracts, and auth vault), the remaining work is primarily **integrating data feeds and building the visual Studio UI**.

---

## 7. Sprint-by-Sprint Roadmap

### Sprint 2: The Core Integration & Time-Scrubber
- [ ] **Data:** Install `pmxt` in `apps/quant` and ingest macro probability data into `packages/db`.
- [ ] **Agents:** Implement Sentiment Agent reading PMXT probabilities and Hard Risk Gate rules.
- [ ] **Quant:** Build 3-strategy runner (`Math Rules`, `AI Committee`, `Buy & Hold`).
- [ ] **Web:** Create basic timeline scrubber slider in React connecting to backend timestamp queries.

### Sprint 3: Visual Polish & Live Demo Setup
- [ ] **Web:** Recharts overlay displaying the 3 performance lines.
- [ ] **Web:** Agent Thought Inspector popups displaying Zod-validated rationale and risk verdicts.
- [ ] **Demo Prep:** Lock in a 5-minute presentation script highlighting a dramatic historical market event (e.g., Fed Rate Hike day).

---

## 8. Summary & Final Recommendation

QuantAgent Studio is **not a theoretical thesis or an unachievable production trading bot**. It is a **tactical, visually impressive, and technically disciplined software engineering project** tailored perfectly for a 4-person university capstone.

By retaining your Sprint 1 code and shifting the user-facing product to a **Visual AI Decision Observatory**, your team avoids starting over, mitigates risk, and creates a portfolio piece that stands out from generic AI trading clones.
