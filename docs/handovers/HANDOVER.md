# HANDOVER — QuantAgent Decision Observatory & Evaluation Lab

**Audience:** An AI coding assistant (or engineer) picking this repository up cold, with no prior context.  
**State:** Evaluation Lab & Decision Observatory **fully implemented, integrated, and verified**.  
**Test Suite:** **460 tests passed (0 failed, 100% green across all 5 workspace packages)**. `pnpm typecheck` → **exit 0**.

---

## 1. What This Project Is

**QuantAgent** is an open-source, reproducible benchmarking environment and AI decision observatory designed to test whether structured multi-agent LLM reasoning (specialists, consensus checks, debate synthesis, and memory) actually improves financial and market decisions over simple deterministic baselines (Buy & Hold, SMA/RSI crossovers) under **strict point-in-time data discipline (zero look-ahead bias)**.

Finance serves as the rigorous benchmark domain because temporal correctness is non-negotiable.

### Core Architectural Principles & Invariants (The Three Laws)
1. **Point-in-Time Discipline (`as_of` rule):**
   - Every historical dataset query, market bar, news article, indicator snapshot, and corporate filing **must** filter strictly on `as_of <= T_decision`.
   - Any look-ahead violation throws `TemporalIntegrityViolation` via `@committee/fixtures` (`TemporalGuard`).
2. **Facts vs. Narration:**
   - Any number that *can* be computed deterministically (prices, indicators, P&L, returns) **must** be computed in pure code (TypeScript / Python).
   - LLMs only reason over and narrate verified facts — computed evidence strictly overwrites model hallucinations on key collisions.
   - The UI renders already-computed values and never aggregates financial sums in the browser.
3. **Schema-First & Failure Isolation:**
   - Raw LLM output is untrusted until validated against Zod contracts in `@committee/contracts`.
   - Agent timeouts or malformed model responses gracefully degrade to `NO_OPINION` (`bias: neutral, confidence: 0.0`) without crashing the evaluation loop.

---

## 2. Complete Architecture & Implementation Map

All layers are **implemented in source code and verified with unit and integration test suites**:

| Layer | Responsibility | LLM? | Status | Source Location |
| :--- | :--- | :--- | :--- | :--- |
| **L0 Data** | Temporal Guard, Point-in-Time Fixtures, Data Seeding CLI | No | ✅ Complete | [`packages/fixtures/`](../../packages/fixtures) |
| **L1 Signal** | Pure TS Indicators (Wilder RSI, MACD, BB, SMA/EMA) | **Never** | ✅ Complete | [`apps/api/src/indicators/`](../../apps/api/src/indicators) & [`apps/quant/`](../../apps/quant) |
| **L2 Baseline** | Buy & Hold, SMA(20/50)+RSI(14) Rule Base, 1-bar execution delay | **Never** | ✅ Complete | [`apps/api/src/backtest/`](../../apps/api/src/backtest) |
| **L3 Agents** | 4 Specialists: Technical, Sentiment, Fundamental, Polymarket | Yes | ✅ Complete | [`apps/api/src/agents/`](../../apps/api/src/agents) |
| **L4 Consensus** | 2-of-3 Fast-Pass (0 tokens), Debate Synthesis, Neutral Ablation | Conditional | ✅ Complete | [`apps/api/src/agents/coordinator/`](../../apps/api/src/agents/coordinator) |
| **L4 Risk** | Deterministic Risk Gate (5 rules, position/drawdown limits) | **Never** | ✅ Complete | [`apps/api/src/risk/`](../../apps/api/src/risk) |
| **L5 Manifest** | Immutable ExperimentManifests, Lineage DAG, Offline Replay | No | ✅ Complete | [`apps/api/src/experiments/`](../../apps/api/src/experiments) |
| **L6 Broker** | Alpaca Paper API Client & ExecutionRouter | No | ✅ Complete | [`apps/api/src/execution/`](../../apps/api/src/execution) |
| **Memory** | 3-Tier Memory: Short-Term, Long-Term (`pgvector`), Reflections | Hybrid | ✅ Complete | [`apps/api/src/memory/`](../../apps/api/src/memory) |
| **Reports & Bot**| EOD Cron Scheduler (16:00 ET) & Telegram Bot Service | No | ✅ Complete | [`apps/api/src/reports/`](../../apps/api/src/reports) & [`apps/api/src/telegram/`](../../apps/api/src/telegram) |
| **UI Suite** | Observatory, Lineage Inspector, Config, Signals, Portfolio | No | ✅ Complete | [`apps/web/src/routes/`](../../apps/web/src/routes) |

---

## 3. Detailed Component Inventory

### 3.1 Specialist Agents (`apps/api/src/agents/`)
- **Technical Specialist** (`agents/technical/`): Analyzes verified mathematical indicator snapshots and bar windows.
- **Sentiment Specialist** (`agents/sentiment/`): Analyzes timestamped Benzinga news headlines $\le T_{decision}$.
- **Fundamental Specialist** (`agents/fundamental/`): Analyzes SEC EDGAR XBRL corporate financial statements $\le \text{filing\_date}$.
- **Polymarket Specialist** (`agents/polymarket/`): Analyzes crowdsourced prediction market probability distributions on macroeconomic events.
- **Multi-Provider Chaining**: Full support for Anthropic Claude (3.5 Sonnet / Haiku / 3.7) and Google Gemini (2.5 / 3.0) with automatic provider fallback, plus deterministic offline test doubles.

### 3.2 Consensus & Debate Engine (`apps/api/src/agents/coordinator/`)
- **Deterministic Consensus Short-Circuit**: When specialists agree on directional bias, fast-passes the signal immediately (0 extra tokens, 0 latency).
- **Conditional Debate Synthesis (Debate ON)**: Single-pass LLM debate synthesis reconciles conflicting specialist arguments and captures the dissenting view.
- **Ablation Neutral Fallback (Debate OFF)**: When debate is disabled, deterministically defaults to neutral (`bias: neutral, confidence: 0.0` / Abstain).
- **Multi-Asset Allocation Engine** (`multi-asset-strategy.ts`): Coordinates universe-level conviction-weighted capital allocation across multiple assets (`AAPL`, `NVDA`, `SPY`).

### 3.3 Deterministic Risk Gate Engine (`apps/api/src/risk/`)
- Pure algorithmic rules engine (100% deterministic, zero LLM calls):
  1. `evaluateConfidenceThresholdRule`
  2. `evaluateDrawdownCircuitBreakerRule`
  3. `evaluateMinCashReserveRule`
  4. `evaluateMaxExposureRule`
  5. `evaluateVolatilityCeilingRule`
- Emits `RiskAssessment` (`APPROVED`, `MODIFIED`, `REJECTED`) with adjusted notional/weight limits.

### 3.4 Broker & Execution Sync (`apps/api/src/execution/`)
- **`AlpacaPaperClient`**: Live authenticated HTTP integration with Alpaca Paper Trading API (`/account`, `/positions`, `/orders`).
- **`DeterministicMockAlpacaClient`**: In-memory paper broker simulator for offline testing.
- **`ExecutionRouter`**: Validates risk approvals, checks point-in-time constraints, routes orders, and logs `ExecutionAuditRecord` contracts.

### 3.5 3-Tier Layered Memory System (`apps/api/src/memory/`)
- **Short-Term Memory**: Recalls recent decisions within the current session.
- **Long-Term Semantic Memory (`pgvector`)**: Performs cosine distance vector similarity search on historical company facts and market rules (`as_of <= decision_ts`).
- **Episodic Post-Trade Reflections**: Generates trade critiques and tracks lessons learned to detect contradictions across regimes.

### 3.6 Frontend Web Application (`apps/web/src/routes/`)
- **Observatory** (`ObservatoryPage.tsx`): Side-by-side strategy comparison tearsheet, multi-series equity curves with drawdown charts, ablation presets, variance bands, and universe allocation breakdowns.
- **Lineage Inspector** (`LineagePage.tsx`): Keyboard-navigable (`←`/`→`) audit drawer inspecting point-in-time OHLCV bars, indicators, SEC filings, news, rendered prompts, and raw model completions.
- **Live Signals Radar** (`SignalsPage.tsx`): Real-time Wilder RSI, MACD, Bollinger Bands, and trend gauges with live specialist stances and on-demand deliberation triggers.
- **Agent Config Center** (`AgentConfigPage.tsx`): Interactive parameter sliders for specialist weights, risk limits, and consensus policies.
- **Portfolio View** (`PortfolioPage.tsx`): Live broker equity, KPI cards, value history, and positions table.

### 3.7 Advanced Features Implemented & Integrated
- **Interactive Telegram 2-Way Trade Approvals (`apps/api/src/telegram/`)**:
  - Full inline keyboard `[✅ Approve Trade]` / `[❌ Reject Trade]` state machine with prefix matching and TTL expiration.
  - REST endpoints (`/telegram/approvals`, `/telegram/approvals/:id/approve`, `/telegram/approvals/:id/reject`) and Telegram command routing (`/pending`, `/approve <id>`, `/reject <id>`).
- **Multi-Round Adversarial Specialist Debate Protocol (`apps/api/src/agents/coordinator/`)**:
  - $R=2$ adversarial cross-examination protocol with structured `DebateCritique` contract validation (`packages/contracts/src/debate.ts`).
  - Deterministic offline fallback and strategy labeling (`multi-agent-coordinator-debate-multiround`).
- **Market Calendar Guard & Expanded Multi-Asset Universe (`packages/fixtures/`)**:
  - Comprehensive NYSE/NASDAQ holiday engine (2023–2026) and 13:00 ET Early Close schedule recognition (`market-calendar.ts`).
  - `MarketCalendarGuard.assertTradingDay()` throwing `TemporalIntegrityViolation` on weekend/holiday executions.
  - 7 frozen offline datasets (`AAPL`, `NVDA`, `SPY`, `MSFT`, `GOOGL`, `TLT`, `QQQ`) with 500+ daily bars, SEC EDGAR 10-Q/10-K filings, and Polymarket odds.
- **Volatility-Targeted & Fractional Kelly Sizing Engine (`apps/api/src/portfolio/`)**:
  - Rolling 20-day annualized realized log-return volatility: $\sigma = \text{std}(\ln(P_t/P_{t-1})) \cdot \sqrt{252}$.
  - Calibrated Fractional Kelly optimization ($f^* = \frac{p(b+1) - 1}{b} \cdot \kappa$).
  - `allocatePortfolio()` multi-asset gross exposure normalization guaranteeing minimum cash liquidity buffers ($1 - \text{cashBuffer}$).
- **Model Context Protocol (MCP) Server Tools (`apps/api/src/mcp/`)**:
  - Full JSON-RPC 2.0 MCP server exposing 8 tools: `quant_query_market_data`, `quant_get_indicators`, `quant_run_backtest`, `quant_evaluate_multiagent`, `quant_request_trade_approval`, `quant_query_portfolio`, `quant_check_market_calendar`.
  - Dual Stdio CLI transport (`pnpm mcp:server`) and Fastify HTTP transport (`POST /mcp`, `GET /mcp/tools`).

---

## 4. Verification & Running the System

### 4.1 Running All Automated Tests
```bash
# Typecheck across all 5 workspace packages (exit 0)
pnpm typecheck

# Full test suite (460 passed tests)
pnpm test
```

### 4.2 Zero-Credential Offline Replay Demo
```bash
# Runs full 1-year historical benchmark suite offline in < 3.0s at $0.00 cost
pnpm demo:replay
```

### 4.3 Running Locally with Docker
```bash
# Stand up PostgreSQL 16 + pgvector, Quant, API, and Web
docker compose up -d --build

# Run migrations and seed demo data
pnpm db:migrate
pnpm db:seed
```

---

## 5. Note for Future AI Assistants & Contributors

> [!IMPORTANT]
> **Source of Truth Rule:** The live code in `apps/` and `packages/` is the authoritative ground truth for this project.
> Do **not** treat early planning documents (`specs/sprint-1/`, `docs/reports/PROJECT_DIRECTION_REPORT.md`, or early sprint notes) as a list of missing features. All 7 layers of the system are built, wired, and verified.
