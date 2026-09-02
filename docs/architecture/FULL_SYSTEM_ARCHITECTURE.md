# System Architecture Specification: QuantAgent (The Committee)

## 1. Executive Summary and System Purpose

QuantAgent, known in source code as The Committee, is a multi-agent paper trading and decision intelligence platform. The software combines quantitative signal processing, specialized large language model (LLM) financial analysis, structured multi-round debate protocols, deterministic risk management, and automated trade execution.

The primary engineering goal of the system is to solve the unreliability, hallucinations, and look-ahead bias common to naive LLM financial applications. It achieves this through five structural constraints:

1. **Strict Layered Separation.** Pure mathematical calculations operate in deterministic code (Python and TypeScript) without LLM intervention. LLMs are restricted to narrative synthesis, qualitative document interpretation, and adversarial debate.
2. **Point-in-Time Temporal Discipline.** All historical data feeds, indicator calculations, news headlines, and SEC filings enforce an explicit constraint: $\text{as\_of} \le T_{\text{decision}}$. Any data point with an availability timestamp greater than the decision timestamp is rejected by automated runtime guards (`TemporalGuard`).
3. **Deterministic Replay at Zero Cost.** The entire system supports fully deterministic offline evaluation runs using frozen multi-asset fixtures. These runs execute at $0.00 token cost without external API keys or network dependencies.
4. **Facts Over Narration.** Quantitative facts computed in TypeScript are injected into final agent outputs after model completions. LLMs cannot fabricate, overwrite, or distort underlying mathematical indicators.
5. **Deterministic Risk Gates.** Trade execution is guarded by deterministic risk rules and mathematical position sizing formulas. The LLM debate coordinator can recommend trades, but it cannot override capital allocations, cash buffers, or drawdown circuit breakers.

---

## 2. High-Level Architecture and System Topology

The architecture organizes into five distinct layers plus a shared contracts and persistence tier.

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │               Layer 5: Presentation & Interface             │
                    │   React 18 Web Observatory  │  Telegram 2-Way Bot  │  SSE   │
                    └──────────────────────────────┬──────────────────────────────┘
                                                   │ HTTP / WebSocket / SSE
                    ┌──────────────────────────────▼──────────────────────────────┐
                    │               Layer 4: Platform & Execution API             │
                    │   Fastify Composition Root  │  Trading Daemon  │  Alpaca    │
                    │   Deterministic Risk Gate   │  Position Sizer  │  EOD Cron  │
                    └──────────────────────────────┬──────────────────────────────┘
                                                   │ Internal Function Calls
                    ┌──────────────────────────────▼──────────────────────────────┐
                    │               Layer 3: Multi-Agent Coordinator              │
                    │   Parallel Specialist Fan-Out│  Consensus Short-Circuit     │
                    │   Multi-Round Debate Engine │  Lineage Provenance & Memory │
                    └──────┬───────────────┬───────────────┬───────────────┬──────┘
                           │               │               │               │
            ┌──────────────▼───┐   ┌───────▼────────┐   ┌──▼──────────┐   ┌▼──────────────┐
            │ Technical Agent  │   │ Sentiment Agent│   │ Fund. Agent │   │ Polymkt Agent │
            │ (L1 Indicators)  │   │ (Benzinga News)│   │ (SEC EDGAR) │   │ (Gamma Odds)  │
            └──────────────┬───┘   └───────┬────────┘   └──┬──────────┘   └┬──────────────┘
                           │               │               │               │
                    ┌──────┴───────────────┴───────────────┴───────────────┴──────┐
                    │            Layer 1: Quantitative Analytics Engine           │
                    │   Python FastAPI Service    │  TypeScript Indicator Engine  │
                    │   Wilder RSI, MACD, BB, SMA │  Deterministic Backtesting    │
                    └──────────────────────────────┬──────────────────────────────┘
                                                   │ PIT Filtered Queries
                    ┌──────────────────────────────▼──────────────────────────────┐
                    │            Layer 0: Market Data & Fixtures Layer            │
                    │   TemporalGuard (Anti-Leak) │  7 Frozen Asset Datasets      │
                    │   Market Calendar Checks    │  PostgreSQL / Drizzle DB      │
                    └─────────────────────────────────────────────────────────────┘
```

---

## 3. Monorepo Structure and Package Boundaries

The project is structured as a Turborepo monorepo with three applications and three shared packages:

```
QuantAgent/
├── apps/
│   ├── api/          # Fastify API backend, agent orchestrator, SSE, Telegram bot
│   ├── quant/        # Python FastAPI service, NumPy/Pandas indicator engine
│   └── web/          # React 18 / Vite Single Page Application, Web Observatory
├── packages/
│   ├── contracts/    # Shared Zod schemas, TypeScript interfaces, DTOs
│   ├── db/           # Drizzle ORM schemas, PostgreSQL client, migrations
│   └── fixtures/     # 7 historical datasets, TemporalGuard, market calendar
└── specs/            # Engineering specifications and sprint records
```

### 3.1 Package Responsibilities and Inter-Module Dependencies

| Workspace Package | Language | Key Technologies | Core Responsibilities |
| :--- | :--- | :--- | :--- |
| **`@committee/contracts`** | TypeScript | Zod, TypeScript 5 | Single source of truth for validated data schemas, request/response DTOs, domain enums, and JSON Schema definitions across web, API, and quant services. |
| **`@committee/db`** | TypeScript | Drizzle ORM, Postgres.js, pgvector | PostgreSQL database schemas (11 tables), lazy connection proxy, connection pool manager, migrations runner, and vector embedding column types. |
| **`@committee/fixtures`** | TypeScript | Zod, date-fns, Intl API | 7 frozen historical market datasets (AAPL, NVDA, MSFT, GOOGL, SPY, QQQ, TLT), `TemporalGuard` runtime enforcement, NYSE/NASDAQ market holiday calendar verification. |
| **`apps/api`** | TypeScript | Fastify 5, @anthropic-ai/sdk, bcryptjs | Server composition root, 15 domain plugins, multi-agent orchestration, LLM debate synthesis, deterministic risk gates, Telegram bot, and SSE market streaming. |
| **`apps/quant`** | Python | FastAPI, Uvicorn, NumPy, Pandas, Pydantic | L1 quantitative analysis microservice, TA-Lib compatible indicator math (Wilder RSI, MACD, Bollinger Bands, EMA, SMA), and monotonic `as_of` timestamp propagation. |
| **`apps/web`** | TypeScript | React 18, Vite 6, Tailwind CSS, Recharts | Web Observatory user interface, portfolio monitoring, strategy backtest tearsheets, decision lineage DAG inspector, signals radar, and daemon controls. |

---

## 4. Layer-by-Layer Architectural Decomposition

### 4.1 Layer 0: Market Data and Temporal Integrity

Layer 0 governs data ingestion, timestamp assignment, and point-in-time enforcement.

```
Incoming Market Bar / News / Filing / Prediction Event
                         │
                         ▼
        ┌──────────────────────────────────┐
        │  Official Session As-Of Stamp    │
        │  1Hour: ts + 1 hour              │
        │  1Day: 16:00 America/New_York    │
        │  (Converted to UTC: 20:00/21:00Z)│
        └────────────────┬─────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │       TemporalGuard Guardrail     │
        │  assert(record.asOf <= T_decision│
        └────────────────┬─────────────────┘
                         │
             ┌───────────┴───────────┐
             │                       │
      (asOf <= T_decision)      (asOf > T_decision)
             │                       │
             ▼                       ▼
     [Permitted to Query]     [TemporalIntegrityViolation]
                              (Halt Execution Immediately)
```

#### Point-in-Time Mechanics
Every record carries two distinct timestamps:
- `ts`: The event timestamp (for example, the trade execution time or the close of the trading bar).
- `as_of`: The earliest timestamp at which the data point became publicly accessible to market participants.

For corporate fundamentals (SEC EDGAR), `as_of` is set to the official acceptance timestamp (`filedAt`), never the historical fiscal period end date (`periodEndDate`). This prevents quarterly balance sheet metrics from leaking into backtest decisions prior to their public filing date.

For daily OHLCV bars, `as_of` is calculated by converting 16:00 America/New_York on the session date to UTC:
- During Eastern Daylight Time (EDT, UTC-4), `as_of` is `20:00:00.000Z`.
- During Eastern Standard Time (EST, UTC-5), `as_of` is `21:00:00.000Z`.

#### The `TemporalGuard` Class (`packages/fixtures/src/temporal-guard.ts`)
The `TemporalGuard` provides static filter and assertion methods. If any calculation reads data with `as_of > decisionTs`, `TemporalGuard.assertNoLeakage()` throws a `TemporalIntegrityViolation` carrying the exact violating record identifier, record timestamp, and decision boundary timestamp.

---

### 4.2 Layer 1: Quantitative Analytics and Technical Indicator Engine

Layer 1 provides deterministic numerical ground truth. It is implemented in two mirror engines:
- Python FastAPI Microservice: `apps/quant/app/indicators/core.py`
- TypeScript Engine: `apps/api/src/indicators/engine.ts`

Both engines implement identical mathematical conventions, verified by cross-language test suites.

```
Historical Bounded OHLCV Bars (as_of <= T_decision)
                         │
                         ▼
        ┌──────────────────────────────────┐
        │   Monotonic As-Of Propagation    │
        │   snapshot.asOf = max(bar.asOf)  │
        └────────────────┬─────────────────┘
                         │
         ┌───────────────┼───────────────┬───────────────┐
         ▼               ▼               ▼               ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │    SMA    │   │  EMA (TA) │   │ Wilder RSI│   │ MACD / BB │
   │  Rolling  │   │ SMA Seed  │   │  RMA 1/N  │   │  ddof = 0 │
   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
         └───────────────┼───────────────┴───────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │     IndicatorSnapshot (JSON)     │
        │ Null during warm-up, exact values│
        └──────────────────────────────────┘
```

#### Mathematical Formulas and Conventions

1. **Simple Moving Average (SMA):**
   $$\text{SMA}_n(t) = \frac{1}{n} \sum_{j=0}^{n-1} P_{t-j}$$
   Indices $0 \dots n-2$ emit null. The first valid value appears at index $n-1$.

2. **Exponential Moving Average (EMA) (TA-Lib Standard):**
   $$\alpha = \frac{2}{n + 1}$$
   $$\text{EMA}_0 = \frac{1}{n}\sum_{j=0}^{n-1} P_j \quad (\text{Seeded with initial } n\text{-bar SMA})$$
   $$\text{EMA}_t = \alpha P_t + (1 - \alpha)\text{EMA}_{t-1}$$
   Skips leading null values when computed over intermediate series (such as the MACD line), seeding from the first valid value.

3. **Wilder's Relative Strength Index (RSI 14):**
   Uses Wilder's Running Moving Average (RMA) with smoothing factor $\alpha = \frac{1}{n}$:
   $$\text{Gain}_t = \max(P_t - P_{t-1}, 0), \quad \text{Loss}_t = \max(P_{t-1} - P_t, 0)$$
   Initial seed at index $n$:
   $$\overline{\text{Gain}}_n = \frac{1}{n}\sum_{i=1}^n \text{Gain}_i, \quad \overline{\text{Loss}}_n = \frac{1}{n}\sum_{i=1}^n \text{Loss}_i$$
   Recursive update for $t > n$:
   $$\overline{\text{Gain}}_t = \frac{\overline{\text{Gain}}_{t-1}\cdot(n - 1) + \text{Gain}_t}{n}, \quad \overline{\text{Loss}}_t = \frac{\overline{\text{Loss}}_{t-1}\cdot(n - 1) + \text{Loss}_t}{n}$$
   Degenerate window handling:
   $$\text{RSI} = \begin{cases}
   100 - \frac{100}{1 + (\overline{\text{Gain}} / \overline{\text{Loss}})} & \text{if } \overline{\text{Loss}} > 0 \text{ and } \overline{\text{Gain}} > 0 \\
   100.0 & \text{if } \overline{\text{Loss}} = 0 \text{ and } \overline{\text{Gain}} > 0 \\
   0.0 & \text{if } \overline{\text{Gain}} = 0 \text{ and } \overline{\text{Loss}} > 0 \\
   50.0 & \text{if } \overline{\text{Loss}} = 0 \text{ and } \overline{\text{Gain}} = 0 \text{ (Flat price series)}
   \end{cases}$$

4. **Moving Average Convergence Divergence (MACD 12, 26, 9):**
   $$\text{MACD Line} = \text{EMA}_{12}(P) - \text{EMA}_{26}(P)$$
   $$\text{Signal Line} = \text{EMA}_9(\text{MACD Line})$$
   $$\text{Histogram} = \text{MACD Line} - \text{Signal Line}$$

5. **Bollinger Bands (20, 2.0):**
   $$\text{Mid}_t = \text{SMA}_{20}(P)_t, \quad \sigma_t = \sqrt{\frac{1}{20}\sum_{j=0}^{19} (P_{t-j} - \text{Mid}_t)^2} \quad (\text{Population variance, } \text{ddof}=0)$$
   $$\text{Upper}_t = \text{Mid}_t + 2.0\sigma_t, \quad \text{Lower}_t = \text{Mid}_t - 2.0\sigma_t$$

---

### 4.3 Layer 2: Specialist Agent Domain Analysis

Layer 2 contains four domain-specialist agents extending `BaseAgent` (`apps/api/src/agents/base.ts`). Each specialist processes a specific data modality.

```
                               ┌──────────────────────────────┐
                               │       AgentInput at T        │
                               └──────────────┬───────────────┘
                                              │
               ┌──────────────────────────────┼──────────────────────────────┐
               │                              │                              │
               ▼                              ▼                              ▼
      ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
      │ Technical Agent │            │ Sentiment Agent │            │Fundamental Agent│
      │ RSI, MACD, SMAs │            │ Benzinga News   │            │ SEC EDGAR XBRL  │
      └────────┬────────┘            └────────┬────────┘            └────────┬────────┘
               │                              │                              │
               └──────────────────────────────┼──────────────────────────────┘
                                              │
                                              ▼
                               ┌──────────────────────────────┐
                               │  Polymarket Macro Specialist │
                               │  Gamma Prediction Odds       │
                               └──────────────┬───────────────┘
                                              │
                                              ▼
                               ┌──────────────────────────────┐
                               │  Validated AgentOutput       │
                               │  (Direction, Conf, Evidence) │
                               └──────────────────────────────┘
```

#### 1. Technical Specialist (`apps/api/src/agents/technical/`)
- **Inputs:** Price bars and computed `IndicatorSnapshot`.
- **Mechanical Classifier:** Computes rule-based score in $[-1, 1]$ based on RSI overbought/oversold boundaries, MACD histogram crossovers, Bollinger Band pierce, and SMA20/SMA50 moving average alignment.
- **Confidence Blending:** Combines rule confidence and LLM confidence. If mechanical rule and LLM agree on direction, confidence is the mean; if they disagree, confidence is halved.
- **Evidence Lock:** Re-injects calculated numeric facts into `evidence` to ensure indicators cannot be altered by LLM text generation.

#### 2. Sentiment Specialist (`apps/api/src/agents/sentiment/`)
- **Inputs:** Point-in-time Benzinga news headlines where `publishedAt <= decisionTs`.
- **Mechanical Classifier:** Scans headlines against financial sentiment lexicon (35 bullish terms, 40 bearish terms).
- **Polarity Formula:**
  $$\text{NetScore} = \frac{\text{BullishCount} - \text{BearishCount}}{\text{TotalHeadlines}}$$
  Direction is bullish if $\text{NetScore} > 0.10$, bearish if $\text{NetScore} < -0.10$, and neutral otherwise.
- **Narration:** In live LLM mode, explains market psychology; in offline replay, emits structured headline counts at $0.00 cost.

#### 3. Fundamental Specialist (`apps/api/src/agents/fundamental/`)
- **Inputs:** Historical SEC EDGAR 10-K and 10-Q XBRL financial reports where `filedAt <= decisionTs`.
- **Mechanical Classifier:** Evaluates three financial pillars:
  1. *Profitability (40%):* Operating margin, net profit margin, and free cash flow generation.
  2. *Growth (30%):* Year-over-year revenue growth rate.
  3. *Solvency (30%):* Debt-to-Equity ratio and cash reserves vs total debt.
- **Direction:** Bullish if $\text{BullPoints} - \text{BearPoints} \ge 2$; bearish if $\le -2$; neutral otherwise.

#### 4. Polymarket Macro Specialist (`apps/api/src/agents/polymarket/`)
- **Inputs:** Crowdsourced prediction market probability curves from Polymarket Gamma API.
- **Mechanical Classifier:** Classifies macroeconomic environment into four regimes:
  - `stagflation_risk`: Recession probability $\ge 35\%$.
  - `dovish_easing`: Rate cut probability $\ge 65\%$ and CPI inflation exceed probability $\le 35\%$.
  - `hawkish_tightening`: Inflation probability $\ge 50\%$ or rate cut probability $< 35\%$.
  - `neutral_macro`: Probabilities within baseline bounds.

---

### 4.4 Layer 3: Multi-Agent Coordinator and Debate Protocol

Layer 3 reconciles differing specialist opinions into a single actionable consensus.

```
                       ┌──────────────────────────────┐
                       │  4 Specialist Agent Outputs  │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │      evaluateConsensus()     │
                       └──────────────┬───────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
           (Agreement)                               (Disagreement)
                 │                                         │
                 ▼                                         ▼
   ┌───────────────────────────┐             ┌───────────────────────────┐
   │ consensus_short_circuit   │             │   Is Debate Configured?   │
   │ Unanimous or uncontested  │             └─────────────┬─────────────┘
   │ 0 extra tokens, $0.00 cost│                           │
   └─────────────┬─────────────┘              ┌────────────┴────────────┐
                 │                            │                         │
                 │                       (Disabled)                 (Enabled)
                 │                            │                         │
                 │                            ▼                         ▼
                 │             ┌────────────────────────┐ ┌────────────────────────┐
                 │             │ablation_neutral_fallbck│ │  Round 1: Critiques    │
                 │             │Direction: neutral      │ │  Round 2: Adjudication │
                 │             │Confidence: 0.0         │ │  (Deterministic Rules) │
                 │             └──────────────┬─────────┘ └────────────┬───────────┘
                 │                            │                        │
                 └────────────────────────────┼────────────────────────┘
                                              │
                                              ▼
                               ┌──────────────────────────────┐
                               │   ConsensusResult Emitted    │
                               │   Direction, Conf, Driver    │
                               └──────────────┬───────────────┘
                                              │
                                              ▼
                               ┌──────────────────────────────┐
                               │ DecisionLineageRecord Stored │
                               │ (Prompts, Outputs, Telemetry)│
                               └──────────────────────────────┘
```

#### Consensus Short-Circuit Rules (`apps/api/src/agents/coordinator/consensus.ts`)
1. **Unanimous:** All specialists emit the same direction. Consensus is reached immediately. Confidence is the average specialist confidence.
2. **Uncontested Majority:** Two or more specialists agree with zero opposing votes (for example, two bullish, two neutral). Consensus is reached without debate.
3. **Directional Conflict:** At least one specialist is bullish and at least one is bearish. The short-circuit fails and triggers the debate protocol.

#### Multi-Round Debate Protocol (`apps/api/src/agents/coordinator/debate.ts`)
- **Round 1 (Cross-Examination):** Each clashing specialist generates a `DebateCritique` attacking the opposing methodology and adjusting conviction:
  - Technical challenges Sentiment on headline lag.
  - Sentiment challenges Technical on indicator delay.
  - Fundamental asserts intrinsic valuation boundaries over momentum.
  - Polymarket asserts macro liquidity regimes over single-stock signals.
- **Round 2 (Synthesis and Tiebreaker Hierarchy):**
  1. *Fundamental Priority:* If Fundamental analyst holds active conviction ($\ge 0.20$), agreement between Fundamental and Technical overrides Sentiment. Agreement between Fundamental and Sentiment overrides Technical.
  2. *Macro Priority:* If Macro specialist holds active conviction ($\ge 0.20$), agreement with Technical or Sentiment overrides the dissenting specialist.
  3. *Conviction Delta:* If only Technical and Sentiment clash:
     - If $|\text{conf}_{\text{tech}} - \text{conf}_{\text{sent}}| \ge 0.25$, the higher conviction specialist wins (confidence reduced by 25%).
     - If $|\text{conf}_{\text{tech}} - \text{conf}_{\text{sent}}| < 0.25$, the committee declares a neutral impasse to preserve capital.

#### Lineage Provenance and 3-Tier Memory (`apps/api/src/memory/`)
Every decision generates an immutable `DecisionLineageRecord` capturing raw input bars, indicator values, news items, exact system and user prompts, raw LLM completions, consensus metadata, and execution fills.

The memory subsystem maintains three tiers:
1. **Short-Term Memory:** Rolling working context of recent decisions and active positions.
2. **Long-Term Memory:** Semantic database with 1536-dimensional `vector` embeddings for similarity search over corporate rules and market patterns.
3. **Episodic Reflections:** Generated after trades close. Evaluates outcome returns, detects specialist contradictions (such as high bullish sentiment preceding an earnings drop), and records lessons learned.

---

### 4.5 Layer 4: Deterministic Risk Gate and Capital Allocation

Layer 4 acts as a non-bypassable risk firewall between agent decisions and trade execution.

```
                           ┌──────────────────────────────┐
                           │   Consensus Decision at T    │
                           │   (Direction, Confidence)    │
                           └──────────────┬───────────────┘
                                          │
                                          ▼
                           ┌──────────────────────────────┐
                           │     RiskGateEngine.assess()  │
                           │   Evaluates 5 Hard Rules     │
                           └──────────────┬───────────────┘
                                          │
                   ┌──────────────────────┼──────────────────────┐
                   │                      │                      │
                   ▼                      ▼                      ▼
             [REJECTED]              [MODIFIED]             [APPROVED]
        (Drawdown breached,     (Exposure clamped to    (All constraints
         Cash < 10%, etc.)       maximum safe ceiling)   satisfied)
                   │                      │                      │
                   ▼                      ▼                      ▼
             [Zero Shares]    ┌────────────────────────┐   [Target Sizing]
                              │ Position Allocator     │
                              │ Kelly / Vol Parity     │
                              └───────────┬────────────┘
                                          │
                                          ▼
                              ┌────────────────────────┐
                              │  Discrete Order Sizing │
                              │  Target Shares & Fees  │
                              └────────────────────────┘
```

#### Deterministic Risk Rules (`apps/api/src/risk/rules/index.ts`)

1. **Confidence Threshold Rule:** Rejects any trade where decision confidence is below `minConfidenceThreshold` (default 0.50).
2. **Drawdown Circuit Breaker Rule:** Halts all new buying if portfolio drawdown from peak equity exceeds `maxDrawdownCircuitBreaker` (default 15.0%).
3. **Minimum Cash Reserve Rule:** Blocks buying if cash balance is below `minCashReservePct` (default 10.0% of portfolio equity).
4. **Maximum Single-Position Exposure Rule:** Limits allocation so that no single asset exceeds `maxPositionWeight` (default 20.0% of NAV).
5. **Asset Volatility Ceiling Rule:** Clamps or rejects assets with annualized historical volatility exceeding `maxAssetVolatility` (default 60.0%).

#### Capital Allocation Algorithms (`apps/api/src/portfolio/allocator.ts`)

1. **Fractional Kelly Criterion:**
   $$f^* = \text{fraction} \times \frac{p(b + 1) - 1}{b}$$
   Where $p$ is agent confidence, $b$ is the estimated payoff ratio, and $\text{fraction}$ is the Kelly fraction (default 0.50).
2. **Volatility Parity:**
   $$w = \min\left(w_{\max}, \frac{\sigma_{\text{target}}}{\sigma_{\text{realized}}} \times \text{confidence}\right)$$
   Normalizes position size inversely to 20-bar historical volatility.
3. **Fixed Percentage:**
   $$w = w_{\text{fixed}} \times (0.50 + 0.50 \times \text{confidence})$$

---

### 4.6 Layer 5: Execution, Streaming, and Telegram Integration

Layer 5 manages live order routing, market streaming, automated scheduling, and human-in-the-loop approvals.

```
                               ┌──────────────────────────────┐
                               │     Approved Sized Order     │
                               └──────────────┬───────────────┘
                                              │
                                              ▼
                               ┌──────────────────────────────┐
                               │  Threshold Approval Check    │
                               │  Notional > Approval Limit?  │
                               └──────────────┬───────────────┘
                                              │
                         ┌────────────────────┴────────────────────┐
                         │                                         │
                    (No / Below)                              (Yes / Above)
                         │                                         │
                         ▼                                         ▼
           ┌───────────────────────────┐             ┌───────────────────────────┐
           │ ExecutionRouter.execute() │             │ Telegram 2-Way Approval   │
           │ (Alpaca Paper / Mock API) │             │ Inline [Approve] [Reject] │
           └─────────────┬─────────────┘             └─────────────┬─────────────┘
                         │                                         │
                         ▼                               ┌─────────┴─────────┐
           ┌───────────────────────────┐                 │                   │
           │ Real-Time SSE Stream      │             (Approved)          (Rejected)
           │ GET /streaming/market-data│                 │                   │
           └───────────────────────────┘                 ▼                   ▼
                                                   [Route to Broker]   [Cancel Order]
```

#### Telegram Two-Way Trade Approvals (`apps/api/src/telegram/`)
When a proposed trade notional exceeds the configured threshold (`requireApprovalAboveUsd`), the system dispatches an interactive Telegram alert with inline buttons:
- `[✅ Approve Trade]` $\rightarrow$ Callback data `trade:approve:<UUID>`
- `[❌ Reject Trade]` $\rightarrow$ Callback data `trade:reject:<UUID>`

The approval proposal maintains a 5-minute TTL. If unanswered, the request expires automatically. Tapping Approve sends the order to the `ExecutionRouter` and updates the approval record.

#### Real-Time Market Streaming (`apps/api/src/streaming/`)
- Endpoint: `GET /streaming/market-data?symbols=AAPL,NVDA,SPY`
- Protocol: Server-Sent Events (SSE) emitting `heartbeat`, `quote`, and `bar` event types.
- Background heartbeat: Dispatches `: ping\n\n` comments every 15 seconds to maintain keep-alive across proxies.
- Sliding Window Compute: Recalculates Wilder RSI, MACD, Bollinger Bands, and SMAs in memory on every incoming bar.

#### Background Schedulers
1. **Autonomous Trading Daemon (`apps/api/src/daemon/`):** Runs configurable recurring decision cycles (for example, every 60 seconds), evaluating watchlist tickers, computing risk gates, and managing orders.
2. **Market-Close EOD Cron Worker (`apps/api/src/reports/cron.ts`):** Fires at 16:00 America/New_York Monday through Friday. Generates daily performance reports, calculates P&L versus SPY benchmark, records snapshots in PostgreSQL, and dispatches Telegram digests.

---

## 5. Frontend Web Observatory Architecture

The Web Observatory (`apps/web/`) is a Single Page Application built with React 18, Vite 6, React Router DOM v7, and Tailwind CSS.

```
                              ┌──────────────────────────────┐
                              │    Root: main.tsx / App.tsx  │
                              │  ThemeProvider, QueryClient  │
                              └──────────────┬───────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │  RequireAuth Route Guard     │
                              │  (GET /auth/me Rehydration)  │
                              └──────────────┬───────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │   AppLayout (Shell & Nav)    │
                              └──────────────┬───────────────┘
                                             │
         ┌───────────────────┬───────────────┼───────────────────┬───────────────────┐
         │                   │               │                   │                   │
         ▼                   ▼               ▼                   ▼                   ▼
  ┌──────────────┐   ┌──────────────┐ ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │PortfolioPage │   │ Observatory  │ │ LineagePage  │   │ SignalsPage  │   │  ConfigPage  │
  │KPIs, Chart,  │   │ Tearsheets,  │ │ Bar Stepper, │   │ Radar, Gauges│   │ Weights, Risk│
  │Positions     │   │ Multi-Series │ │ 4 Audit Tabs │   │ Daemon Card  │   │ Sliders, Pol.│
  └──────────────┘   └──────────────┘ └──────────────┘   └──────────────┘   └──────────────┘
```

### 5.1 Strict Network Boundary Parsing (`apps/web/src/lib/api.ts`)
To prevent data drift between backend and frontend, every HTTP JSON response is validated at runtime against its corresponding `@committee/contracts` Zod schema using `parseContract()`. Invalid responses throw structured `ApiError` instances rather than producing runtime `undefined` errors inside UI components.

### 5.2 Key Observatory Views

1. **Portfolio Page (`/`):**
   - KPI metric tiles for Cash, Equity, and Unrealized P&L.
   - Single-series `AreaChart` with gradient fill, hairline crosshair snapping, and a WCAG twin table disclosure.
   - Verbatim specialist output card displaying unmodified model rationale, confidence meter, and computed evidence key-value disclosures.
2. **Experiment Observatory (`/observatory`):**
   - Target dataset selector (`AAPL`, `NVDA`, `SPY`, `BASKET`).
   - Multi-series equity curve and underwater drawdown profile charts with shaded $\pm 1\sigma$ variance bands.
   - Strategy performance tearsheet comparing Total Return, CAGR, Sharpe, Sortino, Max Drawdown, Win Rate, Directional Accuracy, and Brier Score against Buy & Hold.
   - Multi-asset universe capital allocation breakdown.
3. **Decision Lineage Inspector (`/lineage`):**
   - Bar-by-bar stepper with keyboard arrow navigation.
   - Four detailed audit tabs:
     - *Tab 1: Stances & Debate Transcript:* Specialist directional cards, confidence ratings, and coordinator reconciliation summaries.
     - *Tab 2: Point-in-Time Inputs:* Anti-leakage verification tables for historical bars, SEC EDGAR XBRL filings, and Benzinga news.
     - *Tab 3: Prompts & LLM Completions:* Rendered system/user prompts with clipboard copy, alongside validated raw JSON completion payloads.
     - *Tab 4: Execution Fill:* Simulated trade action, shares, fill price, notional value, and fees.
4. **Signals Radar (`/signals`):**
   - Visual indicator gauges for Wilder RSI (14), MACD (12, 26, 9), Bollinger Bands (20, 2), and SMA trend alignment.
   - Specialist live stance cards and Benzinga news feed.
   - Daemon control card for starting, pausing, and triggering on-demand autonomous trading cycles.
5. **Agent Configuration (`/config`):**
   - Specialist voting weight multipliers (0.1x to 2.0x) and sampling temperature sliders.
   - Risk guardrail sliders for maximum position allocation, portfolio concentration, and stop-loss limits.
   - Consensus protocol mode selectors.

---

## 6. Complete Database Schema Catalog

The persistence layer (`@committee/db`) declares 11 PostgreSQL tables using Drizzle ORM:

```
                              ┌──────────────────────────────┐
                              │            users             │
                              │  id (PK), email, pwd_hash    │
                              └──────────────┬───────────────┘
                                             │ 1:N
         ┌───────────────────┬───────────────┼───────────────────┬───────────────────┐
         │                   │               │                   │                   │
         ▼                   ▼               ▼                   ▼                   ▼
  ┌──────────────┐   ┌──────────────┐ ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │   sessions   │   │ alpaca_creds │ │watchlist_item│   │portfolio_snap│   │  agent_runs  │
  │ id (PK), user│   │ (Encrypted)  │ │ user_id, sym │   │ user, equity │   │ id (PK), sym │
  └──────────────┘   └──────────────┘ └──────────────┘   └──────────────┘   └───────┬──────┘
                                                                                    │ 1:N
                                                                                    ▼
                                                                             ┌──────────────┐
                                                                             │agent_outputs │
                                                                             │ run_id, stance│
                                                                             └──────────────┘

  ┌──────────────────────────────────────────────────────────────────────────────────────────┐
  │ Unattached Market & Memory Stores:                                                       │
  │ price_bars │ indicator_snapshots │ memory_short_term │ memory_long_term │ reflections    │
  └──────────────────────────────────────────────────────────────────────────────────────────┘
```

| Table Name | File Location | Key Columns | Indexes and Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`users`** | `schema/users.ts` | `id` (uuid PK), `email` (text unique), `password_hash` (text), `created_at` (timestamptz) | Unique index on `email` | User identity and authentication store. |
| **`sessions`** | `schema/users.ts` | `id` (uuid PK), `user_id` (uuid FK $\rightarrow$ `users.id` cascade), `expires_at` (timestamptz) | Index on `user_id` | Opaque session tokens with rolling expiration. |
| **`alpaca_credentials`**| `schema/users.ts` | `id` (uuid PK), `user_id` (uuid FK unique), `key_ciphertext`, `secret_ciphertext`, `iv`, `auth_tag` | Unique index on `user_id` | AES-256-GCM encrypted broker API keys. Zero plaintext columns. |
| **`watchlist_items`** | `schema/users.ts` | `id` (uuid PK), `user_id` (uuid FK), `symbol` (text), `created_at` (timestamptz) | Unique(`user_id`, `symbol`) | User-selected market tracking list. |
| **`price_bars`** | `schema/market.ts` | `id` (uuid PK), `symbol` (text), `timeframe` (enum), `ts` (timestamptz), `open`, `high`, `low`, `close`, `volume`, `as_of` | Unique(`symbol`, `timeframe`, `ts`), Index on `as_of` | Bounded historical OHLCV market bars. |
| **`indicator_snapshots`**| `schema/market.ts` | `id` (uuid PK), `symbol` (text), `timeframe` (enum), `ts` (timestamptz), `indicators` (jsonb), `as_of` | Unique(`symbol`, `timeframe`, `ts`), Index on `as_of` | Precomputed Wilder RSI, MACD, and Bollinger values. |
| **`portfolio_snapshots`**| `schema/portfolio.ts` | `id` (uuid PK), `user_id` (uuid FK), `cash`, `equity`, `positions` (jsonb), `as_of` | Index on (`user_id`, `as_of`) | Historical equity curve and mark-to-market positions. |
| **`agent_runs`** | `schema/agents.ts` | `id` (uuid PK), `symbol` (text), `timeframe` (enum), `decision_ts` (timestamptz), `status` | Index on `decision_ts` | Multi-agent committee deliberation executions. |
| **`agent_outputs`** | `schema/agents.ts` | `id` (uuid PK), `run_id` (uuid FK $\rightarrow$ `agent_runs.id`), `agent` (enum), `direction`, `confidence`, `rationale` | Index on `run_id` | Individual specialist agent stances and evidence records. |
| **`memory_short_term`** | `schema/memory.ts` | `id` (uuid PK), `symbol` (text), `decision_ts`, `direction`, `confidence`, `payload` (jsonb), `as_of` | Indexes on `symbol`, `as_of` | Working context and recent decision memory cache. |
| **`memory_long_term`** | `schema/memory.ts` | `id` (uuid PK), `category` (text), `symbol` (text nullable), `content` (text), `embedding` (`vector(1536)`), `as_of` | Indexes on `symbol`, `category` | Persistent semantic memory store with vector search. |
| **`episodic_reflections`**| `schema/memory.ts`| `id` (uuid PK), `symbol` (text), `trade_id` (text nullable), `decision_ts`, `outcome_return_pct`, `critique`, `lesson_learned` | Indexes on `symbol`, `as_of` | Post-trade reflection and contradiction analysis. |

---

## 7. Core End-to-End System Workflows

### 7.1 Autonomous Trading Daemon Decision Cycle

```
[Timer Tick / Manual Run] ──► TradingDaemonService.executeCycle()
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │ 1. Ingest / Load Point-in-Time Data   │
                     │    Bars, News, Filings, Prediction Odds│
                     └───────────────────┬───────────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │ 2. Calculate Indicators (Layer 1)     │
                     │    RSI, MACD, Bollinger Bands, SMAs   │
                     └───────────────────┬───────────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │ 3. Execute MultiAgentCoordinator (L3) │
                     │    Specialists Fan-Out ──► Consensus  │
                     └───────────────────┬───────────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │ 4. Evaluate Deterministic Risk Gate   │
                     │    5 Hard Rules (Drawdown, Cash, etc.)│
                     └───────────────────┬───────────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        │                                 │
                   (Approved)                        (Rejected)
                        │                                 │
                        ▼                                 ▼
         ┌─────────────────────────────┐    ┌───────────────────────────┐
         │ 5. Sizing & Execution Router│    │ Execution Aborted         │
         │    Fractional Kelly Sizing  │    │ Record Reason to Lineage  │
         │    Alpaca Paper Order Fill  │    └───────────────────────────┘
         └──────────────┬──────────────┘
                        │
                        ▼
         ┌─────────────────────────────┐
         │ 6. Outbound Telemetry Push  │
         │    Update DB Snapshots      │
         │    Emit SSE Event to Web UI │
         │    Push Telegram Trade Alert│
         └─────────────────────────────┘
```

### 7.2 Interactive Two-Way Telegram Trade Approval Flow

```
[Risk Gate Approved Order]
             │
             ▼
[Target Notional > requireApprovalAboveUsd Threshold]
             │
             ▼
[PendingTradeApprovalStore.createApproval()] ──► Status: "pending", TTL: 300s
             │
             ▼
[TelegramBotService.requestTradeApproval()]
             │
             ▼
[Dispatches Telegram Alert with Inline Keyboard]
  "🚨 Trade Approval Required: BUY 150 AAPL ($33,450.00)"
  [✅ Approve Trade]  [❌ Reject Trade]
             │
             ├─────────────────────────────────────────┐
             │                                         │
             ▼ (User clicks [Approve])                 ▼ (User clicks [Reject] or 300s TTL)
[POST /telegram/webhook (callback_query)]   [POST /telegram/webhook / Expiry Check]
             │                                         │
             ▼                                         ▼
[TelegramBotService.resolveApproval()]      [Approval Status Set to "rejected" / "expired"]
  - Status: "approved"                        - No Broker Order Dispatched
  - Route to ExecutionRouter.execute()        - Confirmation Dispatched to Telegram Chat
  - Update Approval Record with Execution ID
  - Answer Callback Query & Edit Telegram Msg
```

---

## 8. Summary of Engineering Invariants

1. **Temporal Isolation:** No calculation or agent ever receives data with $\text{as\_of} > T_{\text{decision}}$.
2. **Determinism:** The entire evaluation suite runs at zero cost without API keys using frozen fixtures.
3. **No Mathematical Hallucinations:** Indicators are computed by numerical algorithms, not LLMs.
4. **Autonomous Risk Enforcement:** The Risk Gate operates on deterministic rules and cannot be bypassed by agent prompts.
5. **Full Provenance Auditing:** Every decision records the input state, prompt templates, model completions, consensus resolution, and execution fills in immutable lineage records.
