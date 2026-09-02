# 📖 The Committee (QuantAgent) — Complete Software Tour & Interactive User Manual

**Platform:** The Committee (QuantAgent) Multi-Agent Trading Reference System & Quantitative Evaluation Lab  
**Target Audience:** Researchers, Evaluators, Quant Traders, and System Operators  
**Architecture:** TypeScript (Node.js 22, Fastify, React 18, Vite, Tailwind CSS, TanStack Query, Recharts), Python 3.12 (FastAPI, Pandas), PostgreSQL 16 (`pgvector`), Drizzle ORM, Docker.

---

## 🧭 Document Overview & Quick Start

This document is a comprehensive interactive guide and UI tour of the entire QuantAgent software suite. Every button, input slider, dropdown selector, gauge, tab, modal, and CLI command is documented with its operational mechanism, network trigger, backend processing flow, and visual feedback.

### Launching the Full Stack Locally

Open three terminal windows from the repository root:

```bash
# 1. Database and Environment Pre-flight
pnpm db:migrate
pnpm db:seed

# 2. Launch Full-Stack Development Server (Fastify API on :3000 + React Web on :5173)
pnpm dev

# 3. Optional: Launch Python Quantitative Microservice (FastAPI on :8000)
cd apps/quant && uv run uvicorn app.main:app --port 8000
```

### Accessing the Web Interface
- **URL:** `http://localhost:5173/`
- **Default Demo Credentials:**
  - **Email:** `demo@example.com`
  - **Password:** `demo123456`

---

# PART 1: Global Application Shell & Navigation

The application uses an Impeccable Operate responsive shell designed for high-density financial monitoring.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ 🏛️ THE COMMITTEE    [Portfolio] [Observatory] [Lineage] [Signals] [Config]    │
│                     ● Live Stream Connected   [ ☀️ / 🌙 ]   [demo@example.com]│
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1. Header Navigation Links
- **`Portfolio` Link (`/`):** Navigates to the real-time paper trading overview dashboard showing live equity, positions, and recent agent outputs.
- **`Observatory` Link (`/observatory`):** Navigates to the scientific strategy ablation laboratory, multi-series equity comparisons, and backtest tearsheets.
- **`Decision Lineage` Link (`/lineage`):** Navigates to the full-page decision provenance DAG explorer for historical auditability.
- **`Signals Radar` Link (`/signals`):** Navigates to the real-time technical indicator gauge dashboard and Autonomous Trading Daemon HUD.
- **`Agent Config` Link (`/config`):** Navigates to the specialist weighting, consensus policy, and risk limit tuning center.

### 2. Global Status & Utility Controls
- **Live Stream Status Pill:**
  - **Visual:** Green pulsing dot with `Live SSE/WS Connected` (or yellow `Polling` badge).
  - **What it does:** Displays the health of the background WebSocket connection to the API event stream. Reconnects automatically with exponential backoff if disconnected.
- **Theme Toggle Button (`☀️` / `🌙`):**
  - **Visual:** Sun / Moon icon button on the top right.
  - **What it does:** Toggles between High-Contrast Dark Mode (`bg-ink`, `text-surface`) and Light Mode (`bg-surface`, `text-ink`).
  - **Under the hood:** Modifies CSS class `dark` on the root `<html>` element and persists the preference to browser `localStorage`.
- **User Profile & Logout Button:**
  - **Visual:** Displays `demo@example.com` with a logout exit icon.
  - **What it does:** Dispatches `POST /auth/logout`, clears session cookies, and redirects the user to `/login`.

---

# PART 2: Screen-by-Screen Interactive Guide

---

## Screen 1: Portfolio View (`/` or `/portfolio`)

The landing dashboard providing an institutional overview of current portfolio equity, open holdings, and specialist agent reads.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Portfolio — Paper positions and the committee's latest read                   │
├──────────────────┬──────────────────┬──────────────────┬──────────────────────┤
│ TOTAL VALUE      │ DAY P&L          │ BUYING POWER     │ ACTIVE POSITIONS     │
│ $104,250.00      │ +$1,420.50 (+1.3%)│ $24,500.00       │ 3 Assets             │
├──────────────────┴──────────────────┴──────────────────┴──────────────────────┤
│ 📈 Portfolio Value Over Time               │ 🤖 Latest Specialist Activity    │
│    [Area Chart with SVG gradient]          │    Symbol: AAPL | Stance: Bullish│
│    [1M] [3M] [6M] [1Y] [ALL] [View Table]  │    Confidence: 82% [████████░░]  │
├────────────────────────────────────────────┴──────────────────────────────────┤
│ 📊 Open Stock Positions                                                        │
│    Ticker  | Side | Shares | Avg Price | Current | Unrealized P&L | Weight    │
│    AAPL    | LONG |    100 |   $180.50 | $185.20 | +$470.00 (+2.6%) | [████░░] │
│    NVDA    | LONG |     50 |   $120.00 | $128.40 | +$420.00 (+7.0%) | [███░░░] │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1. Top KPI Telemetry Tiles
- **Total Portfolio Value Card:** Displays total net liquidation value ($\text{Cash} + \sum \text{Market Value of Holdings}$). Shows overall portfolio delta pill.
- **Day P&L Card:** Displays today's dollar gain/loss and percentage change with color coding (Emerald Green for positive, Crimson Red for negative).
- **Buying Power / Cash Card:** Displays liquid cash reserve available for new allocations without triggering margin or risk gate violations.
- **Active Positions Card:** Displays total count of unique equity tickers currently held in the portfolio.

### 2. Portfolio Value Over Time (Area Chart)
- **Time Range Selectors (`1M`, `3M`, `6M`, `1Y`, `ALL`):**
  - Filters the historical equity curve data array to the selected time window.
- **"View as Table" Toggle Button:**
  - Accessible toggle switching between Recharts SVG visualization and an accessible tabular data grid.
- **Interactive Crosshair & Tooltip:**
  - Hovering across the chart renders exact date timestamps, portfolio dollar equity, and percentage drawdowns at that bar.

### 3. Open Positions Table
- **Columns Rendered:**
  - **Asset:** Stock ticker badge (`AAPL`, `NVDA`, `SPY`) with company icon.
  - **Side:** Directional pill (`LONG` in emerald, `SHORT` in purple).
  - **Shares:** Integer quantity of shares held.
  - **Avg Entry Price:** Volume-weighted average entry execution price.
  - **Current Market Price:** Latest market price from Alpaca feed.
  - **Unrealized P&L ($ / %):** Paper profit or loss if liquidated at current market price.
  - **Portfolio Weight Bar:** Horizontal visual progress bar representing the asset's percentage of total portfolio equity.

### 4. Specialist Agent Activity Card
- **Latest Deliberation Run ID & Timestamp:** Displays the unique UUID and UTC timestamp of the most recent committee meeting.
- **Directional Bias Badge:** Shows `BULLISH` (Green), `BEARISH` (Red), or `NEUTRAL` (Slate Gray).
- **Conviction Progress Meter:** Numerical confidence score ($0.00$ to $1.00$) rendered as an animated progress bar.
- **Specialist Reasoning Excerpt:** Rationale generated by the coordinator synthesizing Technical, Sentiment, and Fundamental inputs.

---

## Screen 2: Experiment Observatory (`/observatory`)

The scientific evaluation laboratory for empirical backtesting, multi-series benchmarking, strategy ablations, and variance envelopes.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Experiment Observatory — Benchmark multi-agent strategies against baselines   │
├───────────────────────────────────────────────────────────────────────────────┤
│ Ticker: [ AAPL ▾ ]  Presets: [ All Strategies ] [ Debate vs Ablation ] [ N=3 ]│
│ Strategies: [✓] Buy & Hold  [✓] SMA/RSI  [✓] Committee  [✓] No-Debate         │
│ Telemetry:  [✓] Variance Sweep (N=3)    Budget: $0.00 / $5.00 [Deterministic] │
├───────────────────────────────────────────────────────────────────────────────┤
│ 📈 Synchronized Multi-Series Equity Curves                                    │
│    --- Buy & Hold (Benchmark)                                                 │
│    ─── SMA 20/50 + RSI 14 Baseline                                            │
│    ─── Multi-Agent Committee (Debate ON)   [±1σ Shaded Variance Corridor]     │
│    ─── Multi-Agent Committee (Debate OFF / Neutral Ablation)                  │
├───────────────────────────────────────────────────────────────────────────────┤
│ 📉 Underwater Drawdown Profile (0% to -20%)                                   │
├───────────────────────────────────────────────────────────────────────────────┤
│ 📊 Strategy Tearsheet Matrix                                                  │
│ Strategy     | Return | Sharpe | Sortino | Max DD | Win Rate | Cost | Δ Sharpe│
│ Buy & Hold   | +18.2% |   1.12 |    1.45 | -12.4% |    52.1% | $0.00|       - │
│ SMA/RSI Base | +12.4% |   0.88 |    1.10 |  -8.2% |    54.5% | $0.00|   -0.24 │
│ Committee ON | +24.8% |   1.68 |    2.15 |  -7.1% |    61.2% | $0.00|   +0.56 │
│ Committee OFF|  +8.1% |   0.65 |    0.82 |  -4.2% |    48.0% | $0.00|   -0.47 │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1. Observatory Controls Toolbar
- **Symbol Selector Dropdown (`AAPL`, `NVDA`, `SPY`, `Universe Basket`):**
  - **What it does:** Selects the target backtest asset or switches to the expanded Multi-Asset Universe Basket.
  - **Network Call:** Queries `GET /experiments/suite?symbol=AAPL` or `GET /experiments/multi-asset-suite`.
- **Strategy Preset Quick-Buttons:**
  - **`All Strategies` Button:** Activates all 5 evaluated strategy overlays simultaneously.
  - **`Debate vs. Ablation` Button:** Isolates the Multi-Agent Committee (Debate ON) vs. No-Debate Ablation (Debate OFF) vs. Buy & Hold benchmark to clearly demonstrate the alpha contribution of debate synthesis.
  - **`Deterministic Sweep (N=3)` Button:** Triggers empirical variance sweeps across 3 stochastic seeds.
- **Individual Strategy Checkboxes:**
  - Toggles visibility for specific strategy lines on the equity and drawdown charts.
- **"Variance Sweep (N=3)" Checkbox:**
  - **What it does:** Toggles shaded $\pm 1\sigma$ standard deviation confidence envelopes around the multi-agent equity curve.
  - **Network Call:** Calls `POST /experiments/variance-sweep` with `{ runsCount: 3, budgetLimit: 5.0 }`.
- **Budget Telemetry Badge:**
  - Displays real-time cumulative LLM spend and budget ceiling status (e.g. `Deterministic Replay at $0.00 spend` or `Live Sweep at $0.14 spend / $5.00 limit`).

### 2. Multi-Series Synchronized Equity & Drawdown Chart
- **Curves Displayed:**
  - **Dashed White/Slate Line:** Buy & Hold Passive Benchmark.
  - **Solid Blue Line:** SMA (20/50) + RSI (14) Crossover Baseline.
  - **Solid Emerald Line:** Multi-Agent Committee with Active Debate ($R=1$ or $R=2$).
  - **Solid Amber Line:** Multi-Agent Committee with Debate Disabled (Neutral cash preservation on conflict).
  - **Solid Violet Line:** Polymarket Macro Odds Specialist Variant.
  - **Shaded Translucent Band:** $\pm 1\sigma$ empirical standard deviation corridor.
- **Interactive Decision Node Click:**
  - Clicking any date point on the equity curve opens the **Decision Lineage Inspector Drawer** for that exact historical bar.

### 3. Cross-Asset Allocation Breakdown (Visible in `Universe Basket` Mode)
- Renders an interactive stacked area visualizer displaying how the Portfolio Allocator dynamically adjusted capital weights between `AAPL`, `NVDA`, `SPY`, and `Cash` over time using rolling log-return volatility and Fractional Kelly sizing.

### 4. Comprehensive Strategy Tearsheet Matrix
- Renders institutional performance metrics across all strategies with color-coded comparison badges ($\Delta$ relative to benchmark):
  - **Total Return & Annualized Return:** Overall compounding percentage.
  - **Sharpe Ratio:** Risk-adjusted return over risk-free rate ($\text{Sharpe} = \frac{\bar{R}_p - R_f}{\sigma_p} \sqrt{252}$).
  - **Sortino Ratio:** Downside-penalized risk metric ($\text{Sortino} = \frac{\bar{R}_p - R_f}{\sigma_{\text{downside}}} \sqrt{252}$).
  - **Max Drawdown (MDD):** Largest peak-to-trough equity drop.
  - **Win Rate & Directional Accuracy:** Percentage of profitable trade executions.
  - **Brier Calibration Score:** Mean squared probability calibration error (lower is better).
  - **Inference Cost ($):** Cumulative dollar token spend.
  - **Average Latency (ms):** Mean decision execution speed per bar.

---

## Screen 3: Decision Lineage DAG Inspector (`/lineage`)

A point-in-time forensic auditing workspace allowing operators to step through every decision, prompt, raw LLM completion, debate transcript, and risk evaluation.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Decision Lineage Inspector — Point-in-Time Provenance & Audit Workspace       │
├───────────────────────────────────────────────────────────────────────────────┤
│ Symbol: [ AAPL ▾ ]  Strategy: [ Multi-Agent Debate ON ▾ ]                     │
│ Timeline: [ |◀ First ] [ ◀ Prev ] [ Day 142 of 252 (2024-07-15) ] [ Next ▶ ] │
├───────────────────────────────────────────────────────────────────────────────┤
│ [ Tab 1: Inputs & Data ] [ Tab 2: Debate ] [ Tab 3: Prompts ] [ Tab 4: Exec ] │
├───────────────────────────────────────────────────────────────────────────────┤
│ 📋 TAB 2 CONTENT (Multi-Agent Debate & Adjudication):                         │
│                                                                               │
│ DECISION MODE: Debate Synthesis (Specialist Conflict Resolved)                │
│ FINAL VERDICT: BULLISH (Confidence: 0.84)                                     │
│                                                                               │
│ ┌───────────────────────────┬───────────────────────────┐                     │
│ │ Technical Specialist      │ Sentiment Specialist      │                     │
│ │ Stance: BULLISH (0.88)    │ Stance: BEARISH (0.65)    │                     │
│ │ RSI: 42.1, MACD Golden    │ Negative regulatory news  │                     │
│ └───────────────────────────┴───────────────────────────┘                     │
│                                                                               │
│ 💬 DELIBERATION TRANSCRIPT:                                                   │
│ • Round 1: Technical argues breakout momentum above 50 SMA.                   │
│ • Critique: Sentiment counters with antitrust lawsuit headline risk.          │
│ • Adjudication: Coordinator rules Technical price action takes priority.      │
│ • Dissenting View: Captured regulatory headwind noted for stop-loss.          │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1. Timeline Scrubber & Keyboard Navigation Controls
- **`|◀ First` Button:** Jumps to Day 1 of the historical backtest window.
- **`◀ Prev` Button (or Keyboard `ArrowLeft`):** Steps backward exactly one trading bar.
- **`Next ▶` Button (or Keyboard `ArrowRight`):** Steps forward exactly one trading bar.
- **`Latest ▶|` Button:** Jumps to the most recent decision point.
- **Timeline Slider Bar:** Scrub directly to any bar index in the series.

### 2. Inspector Tabs Breakdown

#### 🔹 Tab 1: `Inputs & Data Snapshot`
- **OHLCV Candle Bar:** Displays exact Open, High, Low, Close, and Volume for the bar.
- **Technical Indicators Card:** Displays Wilder RSI (14), MACD line, Signal line, MACD Histogram, Bollinger Upper/Middle/Lower bands, 20 SMA, and 50 SMA.
- **Market News & Headlines Card:** Point-in-time Benzinga headlines published on or before $T_{\text{decision}}$.
- **SEC EDGAR XBRL Filings Card:** Point-in-time Form 10-Q / 10-K ratios (Revenue, Net Income, Operating Margins, Debt-to-Equity).
- **Polymarket Macro Odds Card:** Crowdsourced prediction market probability curves (FOMC rates, CPI inflation odds).

#### 🔹 Tab 2: `Multi-Agent Debate`
- **Consensus Evaluation Mode Pill:** Shows whether the decision was resolved via `consensus_short_circuit` (unanimous agreement, 0 added LLM tokens) or `debate_synthesis` (conflict adjudicated by LLM coordinator).
- **Specialist Stance Cards Grid:** Side-by-side stance tiles for Technical, Sentiment, Fundamental, and Macro specialists.
- **Deliberation Dialogue Transcript:** Complete multi-turn debate record showing specialist opening statements, cross-examination critiques, and coordinator synthesis.
- **Dissenting Minority View:** Structured capture of counter-arguments and risks raised by dissenting specialists.

#### 🔹 Tab 3: `Prompts & Completions`
- **Specialist Selector Tabs:** Switch between `technical`, `sentiment`, `fundamental`, `polymarket`, and `coordinator`.
- **Rendered System & User Prompts:** Displays the exact text prompt injected into the LLM.
- **Raw LLM Completion Viewer:** Displays the raw model JSON completion.
- **Zod Schema Validation Status Pill:** Displays `✓ Validated against Zod Contract` proving runtime safety.
- **`Copy Prompt` & `Copy Completion` Buttons:** One-click clipboard copy utilities with visual toast feedback.

#### 🔹 Tab 4: `Execution & Risk Management`
- **Deterministic Risk Rules Matrix:** Displays pass/fail status across all 5 risk gates:
  1. *Confidence Threshold ($\ge 0.60$)* `[PASS]`
  2. *Drawdown Circuit Breaker ($\le 15\%$)* `[PASS]`
  3. *Minimum Cash Reserve ($\ge 20\%$)* `[PASS]`
  4. *Maximum Single-Asset Exposure ($\le 25\%$)* `[PASS]`
  5. *Realized Volatility Ceiling ($\le 35\%$)* `[PASS]`
- **Position Allocation Sizing:** Displays calculated target shares, notional dollar value, and portfolio weight.
- **Order Routing Status:** Displays simulated dry-run execution or Alpaca paper broker order ID.

---

## Screen 4: Live Market Signals & Indicator Radar (`/signals`)

The real-time market scanner, technical gauge dashboard, on-demand deliberation trigger, and Autonomous Trading Daemon control hub.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Live Market Signals & Indicator Radar                                         │
│ Symbol: [ AAPL ] [ NVDA ] [ SPY ]        [ ⚡ Evaluate Committee Stance Now ] │
├───────────────────────────────────────────────────────────────────────────────┤
│ 📊 AAPL Market Price: $185.20 (+1.4%) | Vol: 52.4M | Trend: Bullish Alignment │
├───────────────────────────────┬───────────────────────────────┬───────────────┤
│ 🧭 Wilder RSI (14)            │ 📊 MACD Histogram             │ 🎯 Bollinger  │
│       [ 58.4 Neutral ]        │       [ +0.85 Bullish ]       │  %B: 0.62     │
│   (Animated SVG Dial)         │   (Animated SVG Dial)         │  BW: 4.8%     │
├───────────────────────────────┴───────────────────────────────┴───────────────┤
│ 🤖 Specialist Stance Radar Grid                                               │
│ Technical: Bullish (0.85) | Sentiment: Bullish (0.72) | Fundamental: Hold    │
│ Committee Resolution: 2-of-3 Consensus Reached (Short-Circuit Fast-Pass)     │
├───────────────────────────────────────────────────────────────────────────────┤
│ ⚙️ Autonomous Trading Daemon Control HUD                                      │
│ Status: ● RUNNING | Uptime: 4h 12m | Cycles: 128 | Next Cycle in: 14s        │
│ [ Pause Daemon ]  [ Run Cycle Now ]  [✓] Dry-Run Safety Mode  Interval: 30s   │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1. Watchlist Selector & Real-Time Telemetry
- **Symbol Quick-Tabs (`AAPL`, `NVDA`, `SPY`):**
  - Switches the active asset radar feed. Instantly recomputes indicator dials and updates specialist stance cards.
- **`⚡ Evaluate Committee Stance Now` Button:**
  - **What it does:** Triggers an immediate, on-demand multi-agent deliberation cycle for the selected symbol.
  - **Network Call:** Dispatches `POST /signals/evaluate` with `{ symbol: "AAPL", debateEnabled: true }`.
  - **Visual Feedback:** Button enters a loading state with spinner (`Evaluating...`), executes the full specialist and coordinator pipeline, updates the stance matrix, and flashes a `✓ Deliberation Complete` green badge.

### 2. Animated SVG Indicator Gauges
- **Wilder RSI (14-Day) Gauge:**
  - Renders a 180-degree semicircular dial with 3 color zones: Green ($<30$, Oversold), Slate/Yellow ($30-70$, Neutral), Red ($>70$, Overbought). An animated SVG needle points to the exact real-time value.
- **MACD Histogram Momentum Dial:**
  - Renders positive (bullish momentum) vs. negative (bearish momentum) bars and signal crossover status.
- **Bollinger Bands Dial:**
  - Renders $\%B$ relative position within the band ($0.0 = \text{Lower Band}$, $1.0 = \text{Upper Band}$) and volatility bandwidth.
- **Trend Status Card:**
  - Indicates SMA 20 vs. SMA 50 alignment and Golden Cross / Death Cross status.

### 3. Autonomous Trading Daemon Control Card (`DaemonControlCard`)
- **Status Indicator Pill:** Displays `● RUNNING` (Emerald Green), `● IDLE` (Amber), `● PAUSED` (Slate), or `● ERROR` (Red).
- **Telemetry Counters:** Displays continuous Daemon Uptime, Total Cycles Completed, Successful Cycles, and Failed Cycles.
- **`Pause Daemon` / `Start Daemon` Button:**
  - Toggles background autonomous cycle execution by dispatching `POST /daemon/stop` or `POST /daemon/start`.
- **`Run Cycle Now` Button:**
  - Forces the daemon to immediately execute a background evaluation and order routing cycle across all watchlist assets without waiting for the timer. Dispatches `POST /daemon/cycle`.
- **`Dry-Run Safety Mode` Toggle Switch:**
  - When enabled (default), generated orders are logged to internal paper stores without calling live broker APIs. When disabled, orders route directly to Alpaca Paper Trading REST endpoints.
- **Interval Slider (5s to 300s):**
  - Adjusts background polling frequency and dispatches `PUT /daemon/config`.

---

## Screen 5: Agent Configuration & Tuning Center (`/config`)

The administrative interface for tuning specialist weights, consensus policies, deterministic risk ceilings, and external credentials.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Agent Committee Configuration & Threshold Tuning Center                       │
│                                         [ Reset Defaults ]  [ Save Changes ]  │
├───────────────────────────────────────────────────────────────────────────────┤
│ 👥 Specialist Ensemble Weights & Models                                       │
│ • Technical Specialist:    [✓ Enabled]  Weight: 1.00 [──────●──────] Model: Claude │
│ • Sentiment Specialist:    [✓ Enabled]  Weight: 0.80 [────●────────] Model: Gemini │
│ • Fundamental Specialist:  [✓ Enabled]  Weight: 0.90 [─────●───────] Model: Claude │
│ • Macro (Polymarket):      [✓ Enabled]  Weight: 0.70 [───●─────────] Model: Gemini │
├───────────────────────────────────────────────────────────────────────────────┤
│ ⚖️ Consensus & Deliberation Policy                                            │
│ • Consensus Rule: [ Majority (2-of-3 or 3-of-4) ▾ ]                          │
│ • Debate Rounds:  [ 2 Rounds (Adversarial Cross-Examination) ▾ ]             │
│ • Fast-Pass Consensus Threshold: 0.80 [───────●────]                          │
├───────────────────────────────────────────────────────────────────────────────┤
│ 🛡️ Deterministic Risk Gate Ceilings                                           │
│ • Minimum Conviction Threshold:       0.60 [─────●──────]                    │
│ • Max Portfolio Drawdown Breaker:     15%  [────●───────]                    │
│ • Minimum Liquid Cash Reserve:        20%  [─────●──────]                    │
│ • Max Single-Asset Exposure Cap:      25%  [──────●─────]                    │
│ • Realized Volatility Ceiling:        35%  [────────●───]                    │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1. Header Action Buttons
- **`Save Changes` Button:**
  - **What it does:** Validates all form inputs against `CommitteeSystemConfigSchema` and saves the new configuration.
  - **Network Call:** Dispatches `PUT /config` with updated parameters.
  - **Visual Feedback:** Displays a green `✓ Saved successfully` confirmation banner for 3 seconds.
- **`Reset Defaults` Button:**
  - **What it does:** Prompts a browser confirmation modal (`"Reset all agent thresholds and risk parameters to system defaults?"`), resets all sliders to baseline defaults, and dispatches `POST /config/reset`.

### 2. Specialist Ensemble Controls
- **Specialist Enable / Disable Toggles:** Enable or disable individual agents (Technical, Sentiment, Fundamental, Macro).
- **Conviction Weight Sliders ($0.00$ to $2.00$, step $0.05$):** Adjusts the relative influence of each specialist during consensus scoring.
- **Model Provider Dropdowns:** Assign specific LLM providers (`Anthropic Claude 3.5 Sonnet`, `Google Gemini 2.0 Flash`, `OpenRouter`, `OpenAI`).

### 3. Consensus & Deliberation Policy Controls
- **Consensus Rule Selector:** Options: `Unanimous`, `Majority (2-of-3)`, or `Fast-Pass or Debate`.
- **Debate Rounds Selector:** Options: `1 Round (Single-Pass Synthesis)` or `2 Rounds (Adversarial Cross-Examination)`.
- **Fast-Pass Threshold Slider:** Sets the minimum agreement margin required to skip LLM debate synthesis and save tokens.

### 4. Deterministic Risk Gate Sliders
- **Minimum Conviction Threshold ($0.50 - 0.90$, default $0.60$):** Trades with confidence below this threshold are rejected.
- **Max Portfolio Drawdown Circuit Breaker ($5\% - 30\%$, default $15\%$):** Halts all buying if current portfolio drawdown breaches this ceiling.
- **Minimum Cash Reserve Buffer ($5\% - 50\%$, default $20\%$):** Prevents trades that would leave cash below this threshold.
- **Max Single-Asset Exposure Cap ($5\% - 50\%$, default $25\%$):** Caps position sizing for any single ticker.
- **Realized Volatility Ceiling ($10\% - 60\%$, default $35\%$):** Automatically scales down trade sizes during volatile market regimes.

---

# PART 3: External Integrations & CLI Tools

---

## 1. Interactive 2-Way Telegram Trade Approval Bot

Provides mobile, human-in-the-loop trade verification via Telegram inline callback buttons and webhooks.

```
┌────────────────────────────────────────────────────────┐
│ 🤖 QuantAgent Committee Trade Alert                    │
│                                                        │
│ 🚨 High Conviction Recommendation Detected             │
│ Asset: AAPL | Action: BUY LONG                         │
│ Quantity: 50 Shares (~$9,260.00)                       │
│ Committee Confidence: 88%                              │
│ Rationale: Technical Golden Cross confirmed by        │
│ positive earnings sentiment.                           │
│                                                        │
│ [  ✅ Approve Trade  ]      [  ❌ Reject Trade  ]      │
└────────────────────────────────────────────────────────┘
```

### Supported Commands & Interactions
- **`[✅ Approve Trade]` Inline Button (or `/approve <id>`):**
  - Validates approval state, marks trade `APPROVED`, and immediately dispatches order to Alpaca Paper Broker. Updates Telegram message in-place to `✅ Trade Approved & Executed`.
- **`[❌ Reject Trade]` Inline Button (or `/reject <id>`):**
  - Marks trade `REJECTED`, cancels execution, and updates Telegram message to `❌ Trade Rejected by User`.
- **`/portfolio` Command:** Returns current cash balance, equity, and open positions directly in Telegram chat.
- **`/pending` Command:** Lists all pending trade proposals awaiting human approval.
- **5-Minute TTL Expiration:** Unapproved trades automatically expire after 5 minutes to prevent stale order fills.

---

## 2. Model Context Protocol (MCP) Server

Exposes standard JSON-RPC 2.0 tools for external AI agent integration (Claude Desktop, Cursor, Antigravity).

### Launching the MCP Server
```bash
# Launch Stdio MCP Server
pnpm mcp:server

# Or connect via Fastify HTTP SSE endpoint
POST http://localhost:3000/mcp
```

### Available MCP Tools
1. `quant_query_market_data`: Query point-in-time OHLCV historical bars.
2. `quant_get_indicators`: Compute Wilder RSI, MACD, and Bollinger Bands.
3. `quant_run_backtest`: Execute deterministic backtest simulations.
4. `quant_evaluate_multiagent`: Trigger multi-agent committee deliberation.
5. `quant_request_trade_approval`: Create pending human approval tickets.
6. `quant_get_portfolio_state`: Query live cash, equity, and positions.
7. `quant_get_decision_lineage`: Inspect provenance DAG records.
8. `quant_get_system_config`: Retrieve current risk thresholds and weights.

---

## 3. Offline Benchmark Replay CLI (`pnpm demo:replay`)

Executes the full quantitative evaluation laboratory locally in under 3.5 seconds at $0.00 token cost using frozen historical fixtures.

```bash
pnpm demo:replay
```

### What it does:
1. Loads frozen historical bars for `AAPL`, `NVDA`, and `SPY`.
2. Computes pure TypeScript Wilder RSI, MACD, and Bollinger Bands.
3. Simulates 5 strategy variants (Buy & Hold, SMA/RSI, Committee Debate ON, Committee Debate OFF, Macro).
4. Asserts Point-in-Time TemporalGuard integrity (0 look-ahead bias).
5. Prints a formatted ASCII comparison tearsheet to the terminal showing Sharpe, Sortino, Drawdown, and Alpha Deltas.

---

# PART 4: End-to-End Live Testing Walkthrough

Follow this 5-minute walkthrough to verify every feature of the software live:

```
Step 1: Open http://localhost:5173/ and log in with demo@example.com / demo123456.
        Verify: KPI Row displays Cash, Equity, Day P&L, and Holdings table.
           │
Step 2: Navigate to `/observatory`.
        Click: Preset button "Debate vs. Ablation".
        Verify: Multi-series chart isolates Debate ON vs Debate OFF curves.
        Click: "Variance Sweep (N=3)" checkbox.
        Verify: Shaded ±1σ confidence corridor renders around Committee curve.
           │
Step 3: Click any point on the equity chart to open the Decision Inspector Drawer.
        Press: ArrowLeft / ArrowRight to step through trading bars.
        Click: Tab 2 (Debate) to inspect specialist transcripts.
        Click: Tab 3 (Prompts) -> Click "Copy Prompt" button -> Verify toast.
        Click: Tab 4 (Execution) to verify 5 deterministic risk rules.
           │
Step 4: Navigate to `/signals`.
        Select: Symbol "NVDA".
        Verify: Animated SVG radial dials for RSI, MACD, and Bollinger Bands update.
        Click: "⚡ Evaluate Committee Stance Now" button.
        Verify: Real-time deliberation runs and updates specialist cards.
           │
Step 5: On `/signals`, scroll down to "Autonomous Trading Daemon HUD".
        Click: "Run Cycle Now" button.
        Verify: Daemon cycle count increments, last cycle timestamp updates.
           │
Step 6: Navigate to `/config`.
        Adjust: Minimum Conviction Slider to 0.70.
        Click: "Save Changes" button -> Verify green "Saved successfully" toast.
        Click: "Reset Defaults" button -> Confirm modal -> Verify values reset.
```

---

# PART 5: Troubleshooting & System Behaviors

| Behavior / Symptom | Underlying Cause | System Handling & Resolution |
| :--- | :--- | :--- |
| **Specialist Agent returns `NO_OPINION`** | LLM timeout, rate limit, or malformed JSON output | Fault-tolerant `AgentRunner` isolates the failure, logs the error, and gracefully degrades to neutral without crashing the server. |
| **Primary LLM provider is down** | Anthropic or OpenAI API outage | `FallbackLlmClient` automatically tries backup providers (Claude $\to$ Gemini $\to$ OpenRouter) seamlessly. |
| **Trade rejected with `DRAWDOWN_BREACH`** | Current portfolio drawdown exceeds the 15% risk threshold | Deterministic `RiskGateEngine` blocks buying to preserve capital until equity recovers. |
| **Trade rejected with `MIN_CASH_VIOLATION`** | Proposed order would reduce liquid cash below 20% equity | Risk engine automatically downsizes the order notional or rejects execution. |
| **401 Redirect to `/login`** | Session cookie expired or cleared | Auth guard cleanly bounces the user to `/login` with an informative message. |

---
*QuantAgent System Documentation Complete — All features, routes, controls, and workflows verified.*
