# The Committee — UI Verification Report: Live Signals & Indicator Radar (/signals) and Agent Configuration (/config)

**Verification Date:** 2026-09-01  
**Target Environment:** Local Dev (`http://localhost:5173`)  
**Backend API:** Fastify + Drizzle ORM (`http://localhost:3000`)  
**Status:** **PASSED ALL 14 TEST GATES**

---

## 1. Executive Summary

A comprehensive automated and end-to-end browser verification of **The Committee**'s frontend interface was conducted across the Live Signals Radar (`/signals`), Autonomous Trading Daemon HUD, Agent Committee Configuration Center (`/config`), and Theme Toggle Shell.

All technical indicator calculations (Wilder RSI, MACD line/signal/hist, Bollinger Bands population $\sigma$, and SMA 20/50 Golden Crosses), specialist agent stance matrices (Technical, Sentiment, Fundamental, Polymarket), deterministic Risk Gate evaluations, on-demand deliberation triggers, and daemon background execution loops verified cleanly without regressions.

---

## 2. Test Execution & Verification Matrix

| Component / Feature | Tested Route / Action | Observed Result | Status |
| :--- | :--- | :--- | :---: |
| **AAPL Technical Radar** | `/signals` (AAPL selected) | RSI 56.7, MACD 5.087/5.550 (bearish cross), BB Upper $259.68 / Lower $239.94, SMA20 $249.81 > SMA50 $237.60 | **PASS** |
| **NVDA Technical Radar** | `/signals` (NVDA selected) | Close $134.29, RSI 45.2, MACD -0.763, SMA20 $137.15, SMA50 $139.89, Consensus: BULLISH (78%) | **PASS** |
| **SPY Technical Radar** | `/signals` (SPY selected) | Close $586.08, RSI 40.2, MACD -0.983, SMA20 $599.54, SMA50 $592.82, Consensus: BULLISH (86%) | **PASS** |
| **Specialist Stances Matrix** | `/signals` Specialist Cards | 4/4 Specialists render direction, confidence %, and point-in-time evidence summaries | **PASS** |
| **Consensus Gauge** | `/signals` L3 Coordinator | Final Bias calculated (e.g. Bullish 68% for AAPL), Fast-Pass resolution mode badge | **PASS** |
| **Evaluate On-Demand Trigger** | `POST /signals/evaluate` | Instant deterministic deliberation response with full lineage prompt/completion facts & risk gate | **PASS** |
| **Daemon Start/Stop** | `POST /daemon/start`, `POST /daemon/stop` | State flips from `idle` to `running` with green pulsing dot; toggles to `⏸ Pause Daemon` | **PASS** |
| **Daemon Cycle Run** | `POST /daemon/cycle` | Cycles count increments; renders multi-symbol deliberation breakdown with trade orders | **PASS** |
| **Daemon Dry-Run Toggle** | `PUT /daemon/config` | Toggles between `🛡️ Dry-Run Simulation` (amber) and `🚀 Live Paper Execution` (green) | **PASS** |
| **Agent Config Overview** | `/config` | Loads 4 specialist cards, risk guardrails, consensus policy, and alert channels | **PASS** |
| **Specialist Weights Sliders** | `/config` range inputs | Interactive real-time multiplier sliders (0.1x – 2.0x) and temperature sampling sliders | **PASS** |
| **Risk Guardrail Inputs** | `/config` risk inputs | Max Position (5-50%), Concentration (20-100%), Stop Loss (0.5-30%), Approval threshold | **PASS** |
| **Config Save & Toast** | `PUT /agents/config` | Returns HTTP 200; triggers green `✓ Saved successfully` toast with checkmark | **PASS** |
| **Config Reset to Defaults** | `POST /agents/config/reset` | Resets all multipliers (Tech 1.0x, Poly 0.8x, MaxPos 20%, SL 5%) and triggers success notification | **PASS** |
| **Theme Toggle** | Header Theme Button | Synchronizes `dark` class on `<html>`, sets `data-theme="dark"`, persists in `localStorage` | **PASS** |

---

## 3. Detailed Component Verifications

### 3.1 Live Signals & Indicator Radar (`/signals`)

1. **Deterministic Indicator Readings (L1):**
   - **Wilder RSI (14):**
     - AAPL: `56.7` (Neutral zone)
     - NVDA: `45.2` (Neutral zone)
     - SPY: `40.2` (Neutral zone)
   - **MACD (12, 26, 9):**
     - AAPL: MACD `5.087`, Signal (EMA9) `5.550`, Histogram `-0.463` (Bearish Cross)
     - NVDA: MACD Line `-0.763`
     - SPY: MACD Line `-0.983`
   - **Bollinger Bands (20, 2$\sigma$, Population $\sigma$):**
     - AAPL: Upper Band `$259.68`, Lower Band `$239.94`, Bandwidth Spread `8.2%`
   - **Trend Alignment (SMA 20 vs SMA 50):**
     - AAPL: Fast SMA `$249.81`, Slow SMA `$237.60` (Golden Crossover status, Bullish)
     - NVDA: Fast SMA `$137.15`, Slow SMA `$139.89`
     - SPY: Fast SMA `$599.54`, Slow SMA `$592.82`

2. **Specialist Agent Stances (L2):**
   - **Technical Analyst:** Neutral bias (3% conviction) from mechanical rule matching `macd_bear_cross + sma20_above_sma50 + close_above_sma20`.
   - **Sentiment Specialist:** Bullish bias (18% conviction) based on 11 point-in-time Benzinga headlines (4 bullish, 2 bearish, 5 neutral).
   - **Fundamental Specialist:** Bullish bias (87% conviction) based on SEC EDGAR 10-K filing (Revenue $94.93B, +6.1% YoY, Operating Margin 31.2%, Free Cash Flow $24.40B).
   - **Polymarket Macro Specialist:** Bullish bias (98% conviction) from Polymarket prediction curves (Dovish easing regime, 99% rate cut probability, 18% CPI > 3%, 8% recession risk).

3. **Multi-Agent Coordinator Consensus (L3):**
   - Consensus Final Bias: `BULLISH (68% Confidence)`
   - Resolution Mode: `⚡ Consensus Fast-Pass` ($0.0000 USD cost, natural majority reached).

4. **Autonomous Trading Daemon Control Card (L4/L6):**
   - State transition: `IDLE` $\rightarrow$ `RUNNING` on Start Daemon.
   - Cycle execution test: Triggered `⚡ Run Cycle Now` (completed in 1427ms across 3 symbols).
   - Automated Deliberation Summary Cards:
     - **AAPL:** `DRY RUN RECORDED` | Consensus: `BULLISH (68%)` | Risk: `MODIFIED` | Order: `BUY 19 shares @ $250.42`
     - **NVDA:** `DRY RUN RECORDED` | Consensus: `BULLISH (78%)` | Risk: `MODIFIED` | Order: `BUY 37 shares @ $134.29`
     - **SPY:** `DRY RUN RECORDED` | Consensus: `BULLISH (86%)` | Risk: `MODIFIED` | Order: `BUY 8 shares @ $586.08`

---

### 3.2 Agent Committee Configuration (`/config`)

1. **Specialist Agents Roster:**
   - **Technical Specialist:** Multiplier slider (0.1x to 2.0x, adjusted to 1.5x), sampling temperature (0.10).
   - **Sentiment Specialist:** Multiplier slider (1.0x), sampling temperature (0.20).
   - **Fundamental Specialist:** Multiplier slider (1.0x), sampling temperature (0.10).
   - **Polymarket Specialist:** Multiplier slider (adjusted to 1.4x), sampling temperature (0.10).
   - Active switch toggles for each agent with instant state updating.

2. **Deterministic Risk Gate Guardrails:**
   - Max Single-Position Allocation: Slider adjusted from `20%` to `35%`.
   - Max Total Portfolio Concentration: Slider at `80%`.
   - Stop-Loss (%): Numeric input adjusted from `5.0%` to `8.5%`.
   - Take-Profit (%): Numeric input at `15%`.
   - Human Approval Threshold: Numeric input adjusted from `$10,000` to `$25,000`.

3. **Consensus Debate Policy & Alert Notifications:**
   - Protocol selector: `majority_fast_pass`, `single_pass_synthesis`, `multi_round_critique`.
   - Agreement Threshold: Slider adjusted to `0.80` (80% supermajority).
   - Telegram & Slack Alert checkboxes for real-time signals and daily recap.

4. **Persistence & Reset:**
   - **Save Changes:** Sent `PUT /agents/config` payload, returned HTTP 200, displayed `✓ Saved successfully` badge.
   - **Reset Defaults:** Sent `POST /agents/config/reset`, restored all default values (Tech 1.0x, Polymarket 0.8x, MaxPos 20%, SL 5%), and refreshed the UI state.

---

### 3.3 Theme Toggle & App Shell

- **Dark Mode Activation:** Clicking header theme toggle toggled `<html>` class list to include `dark`, set `data-theme="dark"`, and saved `"dark"` in `localStorage['committee.theme']`.
- **Styling Fidelity:** All background cards switched to hairline slate surfaces (`#18181b`/`#09090b`), text colors adapted to high-contrast ink tokens, and gauge tracks adjusted accordingly.

---

## 4. Artifacts & Evidence Files

All screenshots and snapshot YAMLs have been written to `artifacts/verify-committee/`:

- [signals-aapl-light.png](./signals-aapl-light.png) — AAPL Signal Radar & indicator telemetry in Light Mode
- [signals-aapl-light.snapshot.yml](./signals-aapl-light.snapshot.yml) — AAPL DOM snapshot YAML
- [signals-nvda.png](./signals-nvda.png) — NVDA Signal Radar & gauges
- [signals-nvda.snapshot.yml](./signals-nvda.snapshot.yml) — NVDA DOM snapshot YAML
- [signals-spy.png](./signals-spy.png) — SPY Signal Radar & gauges
- [signals-spy.snapshot.yml](./signals-spy.snapshot.yml) — SPY DOM snapshot YAML
- [signals-evaluate-deliberation.png](./signals-evaluate-deliberation.png) — Evaluate On-Demand deliberation trigger response
- [signals-daemon-active.png](./signals-daemon-active.png) — Autonomous Trading Daemon HUD with completed cycle summary
- [signals-dark-theme.png](./signals-dark-theme.png) — Signals Radar rendered in Dark Mode
- [config-overview.png](./config-overview.png) — Agent Committee Configuration overview
- [config-overview.snapshot.yml](./config-overview.snapshot.yml) — Config page DOM snapshot YAML
- [config-adjusted.png](./config-adjusted.png) — Config page with adjusted weights & risk sliders
- [config-saved.png](./config-saved.png) — Config page showing `✓ Saved successfully` toast
- [config-reset.png](./config-reset.png) — Config page after Reset Defaults execution
