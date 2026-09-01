# Evaluation Observatory (`/observatory`) UI Verification Report

**Test Execution Date:** 2026-09-01  
**Application URL:** http://localhost:5173/observatory  
**Environment:** Zero-Credential Deterministic Offline Replay (Git Commit: `65dc1e4`)  
**Artifacts Directory:** `artifacts/verify-committee/`

---

## 1. Executive Summary & Verification Matrix

The **Evaluation Observatory (`/observatory`)** was thoroughly tested across all functional vectors, dataset targets, interactive ablation presets, chart overlays, tearsheets, and allocation telemetry. All features verified with **100% PASS** rate and zero rendering errors.

| Test Category | Target / Scope | Status | Key Artifacts |
|---|---|---|---|
| **Dataset Targets** | AAPL, NVDA, SPY, BASKET (Universe) | ✅ PASS | `01_aapl_...png`, `08_nvda_...png`, `11_spy_...png`, `14_basket_...png` |
| **Chart Modes** | Comparative Equity Curves & Underwater Drawdown (%) | ✅ PASS | `01_aapl_...png`, `02_aapl_drawdown.png`, `15_basket_drawdown.png` |
| **Ablation Presets** | All Strategies, Macro Ablation, Debate vs Ablation, Baselines Only, Deterministic Sweep | ✅ PASS | `03_aapl_...png`, `04_aapl_...png`, `05_aapl_...png`, `06_aapl_...png` |
| **Strategy Overlay Toggles** | Interactive multi-series toggle buttons (5/5, 4/5, 3/5, 2/5) | ✅ PASS | `07_aapl_toggles_custom.png` |
| **Metrics Tearsheet** | Return (Δ), Sharpe (Δ), Sortino (Δ), MaxDD (Δ), Win Rate, Accuracy, Brier, Cost/Latency | ✅ PASS | Full side-by-side matrices extracted across 4 datasets |
| **Universe Basket Allocation** | Cross-Asset Capital Allocation & Breakdown (AAPL + NVDA + SPY + Cash Reserve) | ✅ PASS | `16_basket_allocation_breakdown.png` |
| **Provenance & Lineage** | Synchronized "Audit Lineage" drilldown buttons to `/lineage` | ✅ PASS | `18_lineage_inspector.png` |

---

## 2. Dataset Target Verification

### 2.1 AAPL Dataset Target (`Symbol: AAPL`)
- **Dataset SHA256:** `89d1248ace…`
- **Replay Duration:** `838.11ms` | **Token Cost:** `$0.00`
- **Active Strategies:** 5 evaluated variants

#### Performance Tearsheet:
| Strategy Variant | Total Return (Δ) | Annualized (Δ) | Sharpe (Δ) | Sortino (Δ) | Max Drawdown | Win Rate | Dir. Accuracy | Brier Score | Cost & Latency |
|---|---|---|---|---|---|---|---|---|---|
| **Buy & Hold (Benchmark)** | `97.25%` (bench) | `40.64%` (bench) | `1.71` (bench) | `2.67` (bench) | `-16.71%` (bench) | `0.00%` (1 trade) | — | — | `$0.00` / `0ms` |
| **SMA(20/50) + RSI(14)** | `42.29%` (`-54.96%`) | `19.37%` (`-21.27%`) | `1.27` (`-0.44`) | `1.99` (`-0.68`) | `-13.13%` (`+3.59% Δ`) | `80.00%` (41 trades) | — | — | `$0.00` / `0ms` |
| **Multi-Agent (Debate ON)** | `59.62%` (`-37.64%`) | `26.46%` (`-14.18%`) | `1.25` (`-0.46`) | `1.91` (`-0.76`) | `-16.71%` (`0.00% Δ`) | `50.00%` (9 trades) | `55.32%` (470 act / 31 neut) | `0.253` MSE | `$0.00` / `1ms (1% fb)` |
| **Multi-Agent (Debate OFF)** | `64.74%` (`-32.51%`) | `28.48%` (`-12.16%`) | `1.63` (`-0.08`) | `2.63` (`-0.04`) | `-9.94%` (`+6.77% Δ`) | `55.00%` (41 trades) | `55.66%` (318 act / 183 neut) | `0.249` MSE | `$0.00` / `1ms (1% fb)` |
| **Tech + Sent + Polymarket** | `23.54%` (`-73.71%`) | `11.20%` (`-29.44%`) | `0.65` (`-1.05`) | `0.97` (`-1.70`) | `-23.33%` (`-6.62% Δ`) | `55.56%` (55 trades) | `56.22%` (370 act / 131 neut) | `0.263` MSE | `$0.00` / `1ms (1% fb)` |

---

### 2.2 NVDA Dataset Target (`Symbol: NVDA`)
- **Dataset SHA256:** `0a9bfa4a26…`
- **Replay Duration:** `862.67ms` | **Token Cost:** `$0.00`

#### Performance Tearsheet:
| Strategy Variant | Total Return (Δ) | Annualized (Δ) | Sharpe (Δ) | Sortino (Δ) | Max Drawdown | Win Rate | Dir. Accuracy | Brier Score | Cost & Latency |
|---|---|---|---|---|---|---|---|---|---|
| **Buy & Hold (Benchmark)** | `821.42%` (bench) | `204.89%` (bench) | `2.46` (bench) | `4.38` (bench) | `-27.05%` (bench) | `0.00%` (1 trade) | — | — | `$0.00` / `0ms` |
| **SMA(20/50) + RSI(14)** | `164.54%` (`-656.88%`) | `62.96%` (`-141.93%`) | `1.42` (`-1.05`) | `2.51` (`-1.87`) | `-31.80%` (`-4.75% Δ`) | `81.82%` (44 trades) | — | — | `$0.00` / `0ms` |
| **Multi-Agent (Debate ON)** | `539.16%` (`-282.26%`) | `153.75%` (`-51.14%`) | `2.15` (`-0.32`) | `3.78` (`-0.60`) | `-27.05%` (`0.00% Δ`) | `0.00%` (1 trade) | `55.30%` (481 act / 20 neut) | `0.282` MSE | `$0.00` / `1ms (1% fb)` |
| **Multi-Agent (Debate OFF)** | `177.58%` (`-643.84%`) | `66.95%` (`-137.95%`) | `1.52` (`-0.94`) | `2.72` (`-1.67`) | `-25.05%` (`+1.99% Δ`) | `48.48%` (67 trades) | `54.25%` (306 act / 195 neut) | `0.267` MSE | `$0.00` / `1ms (1% fb)` |
| **Tech + Sent + Polymarket** | `169.61%` (`-651.81%`) | `64.52%` (`-140.37%`) | `1.42` (`-1.04`) | `2.26` (`-2.12`) | `-27.05%` (`0.00% Δ`) | `65.22%` (47 trades) | `54.85%` (361 act / 140 neut) | `0.282` MSE | `$0.00` / `1ms (1% fb)` |

---

### 2.3 SPY Dataset Target (`Symbol: SPY`)
- **Dataset SHA256:** `5ee2c83727…`
- **Replay Duration:** `794.15ms` | **Token Cost:** `$0.00`

#### Performance Tearsheet:
| Strategy Variant | Total Return (Δ) | Annualized (Δ) | Sharpe (Δ) | Sortino (Δ) | Max Drawdown | Win Rate | Dir. Accuracy | Brier Score | Cost & Latency |
|---|---|---|---|---|---|---|---|---|---|
| **Buy & Hold (Benchmark)** | `52.88%` (bench) | `23.75%` (bench) | `1.72` (bench) | `2.56` (bench) | `-10.29%` (bench) | `0.00%` (1 trade) | — | — | `$0.00` / `0ms` |
| **SMA(20/50) + RSI(14)** | `23.40%` (`-29.48%`) | `11.13%` (`-12.62%`) | `1.20` (`-0.53`) | `1.76` (`-0.80`) | `-7.41%` (`+2.88% Δ`) | `68.42%` (39 trades) | — | — | `$0.00` / `0ms` |
| **Multi-Agent (Debate ON)** | `42.00%` (`-10.88%`) | `19.25%` (`-4.50%`) | `1.49` (`-0.24`) | `2.18` (`-0.38`) | `-9.78%` (`+0.51% Δ`) | `100.00%` (3 trades) | `57.29%` (480 act / 21 neut) | `0.275` MSE | `$0.00` / `1ms (1% fb)` |
| **Multi-Agent (Debate OFF)** | `22.11%` (`-30.76%`) | `10.55%` (`-13.20%`) | `1.15` (`-0.57`) | `1.66` (`-0.90`) | `-5.27%` (`+5.02% Δ`) | `55.26%` (76 trades) | `58.13%` (320 act / 181 neut) | `0.255` MSE | `$0.00` / `1ms (1% fb)` |
| **Tech + Sent + Polymarket** | `37.76%` (`-15.11%`) | `17.45%` (`-6.30%`) | `1.57` (`-0.15`) | `2.31` (`-0.25`) | `-8.41%` (`+1.89% Δ`) | `50.00%` (53 trades) | `58.07%` (353 act / 148 neut) | `0.284` MSE | `$0.00` / `1ms (1% fb)` |

---

### 2.4 Universe Basket Target (`🌐 Universe (AAPL+NVDA+SPY)`)
- **Suite Type:** `Multi-Asset Universe Lab`
- **Benchmark:** `1/N Equal-Weight Basket (Benchmark)`
- **Portfolio Equity:** `$245,172.01`
- **Cash Exposure:** `94.7% Invested` / `5.3% Cash Buffer` (`$12,923.74`)

#### Performance Tearsheet:
| Strategy Variant | Total Return (Δ) | Annualized (Δ) | Sharpe (Δ) | Sortino (Δ) | Max Drawdown | Win Rate | Trades | Cost & Latency |
|---|---|---|---|---|---|---|---|
| **1/N Equal-Weight Basket** | `307.51%` (bench) | `102.43%` (bench) | `2.30` (bench) | `3.81` (bench) | `-21.74%` (bench) | `0.00%` | 3 trades | `$0.00` / `0ms` |
| **Multi-Asset SMA(20/50)+RSI(14)** | `81.37%` (`-226.13%`) | `34.83%` (`-67.60%`) | `1.47` (`-0.83`) | `2.38` (`-1.43`) | `-20.34%` (`+1.40% Δ`) | `59.13%` | 238 trades | `$0.00` / `0ms` |
| **Multi-Asset Committee (Debate ON)** | `145.17%` (`-162.34%`) | `56.86%` (`-45.57%`) | `2.11` (`-0.19`) | `3.50` (`-0.30`) | `-14.90%` (`+6.83% Δ`) | `70.71%` | 1,013 trades | `$0.00` / `1ms (1% fb)` |
| **Multi-Asset Committee (Debate OFF)** | `114.98%` (`-192.53%`) | `46.84%` (`-55.59%`) | `1.80` (`-0.50`) | `3.13` (`-0.68`) | `-18.37%` (`+3.37% Δ`) | `69.63%` | 764 trades | `$0.00` / `1ms (1% fb)` |
| **Multi-Asset Committee + Polymarket** | `67.77%` (`-239.74%`) | `29.66%` (`-72.77%`) | `1.29` (`-1.01`) | `1.99` (`-1.82`) | `-20.12%` (`+1.62% Δ`) | `65.48%` | 797 trades | `$0.00` / `1ms (1% fb)` |

#### Asset Allocation Breakdown Table:
| Asset Symbol | Holding Shares | Latest Price | Market Value | Portfolio Weight | Turnover (NAV) | Trades Count |
|---|---|---|---|---|---|---|
| **AAPL** | 257 shares | `$250.42` | `$64,357.94` | **26.3%** | 1,864.6% | 336 |
| **NVDA** | 469 shares | `$134.29` | `$62,982.01` | **25.7%** | 2,054.6% | 339 |
| **SPY** | 179 shares | `$586.08` | `$104,908.32` | **42.8%** | 2,098.9% | 338 |
| **USD (Cash Buffer)** | — | `$1.00` | `$12,923.74` | **5.3%** | — | — |

---

## 3. Presets & Interactive Overlay Verification

| Preset Action | Active Overlay Count | Expected Strategy Selection | Result |
|---|---|---|---|
| **All Strategies** | `5/5` | Benchmark + SMA/RSI + Debate ON + Debate OFF + Polymarket | ✅ PASS |
| **Macro Ablation** | `4/5` | Benchmark + Debate ON + Debate OFF + Polymarket (SMA/RSI disabled) | ✅ PASS |
| **Debate vs Ablation** | `3/5` | Benchmark + Debate ON + Debate OFF (Baselines & Polymarket disabled) | ✅ PASS |
| **Baselines Only** | `2/5` | Benchmark + SMA(20/50)+RSI(14) (LLM agents disabled) | ✅ PASS |
| **Deterministic Sweep** | `5/5` | Shaded ±1σ variance bands rendered, title updated, HUD spend badge active | ✅ PASS |
| **Custom Toggle** | Variable | Toggling chips individually updates chart series visibility and table row opacity | ✅ PASS |

---

## 4. Captured Verification Artifacts

All artifacts are persisted in `artifacts/verify-committee/`:

- `01_aapl_all_strategies_equity.png` / `.txt` - AAPL Default View
- `02_aapl_drawdown.png` / `.txt` - AAPL Underwater Drawdown View
- `03_aapl_preset_macro_ablation.png` / `.txt` - AAPL Macro Ablation Preset
- `04_aapl_preset_debate_vs_ablation.png` / `.txt` - AAPL Debate vs Ablation Preset
- `05_aapl_preset_baselines_only.png` / `.txt` - AAPL Baselines Only Preset
- `06_aapl_preset_deterministic_sweep.png` / `.txt` - AAPL Deterministic Sweep Preset
- `07_aapl_toggles_custom.png` / `.txt` - AAPL Manual Overlay Toggles
- `08_nvda_equity.png` / `.txt` - NVDA All Strategies Equity Curve
- `09_nvda_drawdown.png` / `.txt` - NVDA Underwater Drawdown View
- `10_nvda_preset_macro_ablation.png` / `.txt` - NVDA Macro Ablation Preset
- `11_spy_equity.png` / `.txt` - SPY All Strategies Equity Curve
- `12_spy_drawdown.png` / `.txt` - SPY Underwater Drawdown View
- `13_spy_preset_debate_vs_ablation.png` / `.txt` - SPY Debate vs Ablation Preset
- `14_basket_equity.png` / `.txt` - Universe Basket Multi-Asset Equity Curve
- `15_basket_drawdown.png` / `.txt` - Universe Basket Underwater Drawdown View
- `16_basket_allocation_breakdown.png` / `.txt` - Universe Basket Asset Allocation Breakdown
- `17_basket_preset_macro_ablation.png` / `.txt` - Universe Basket Macro Ablation Preset
- `18_lineage_inspector.png` / `.txt` - Audit Lineage Inspector Provenance View
