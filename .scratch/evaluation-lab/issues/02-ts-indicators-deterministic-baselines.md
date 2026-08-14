# 02 — Pure TypeScript Indicator Engine & Deterministic Baselines

**What to build:** Mathematical computation of technical indicators (SMA, EMA, Wilder RSI, Bollinger Bands, MACD) in TypeScript within `apps/api`, eliminating Python microservice drift. Deterministic simulation of Buy & Hold and SMA(20/50)+RSI(14) benchmark strategies under realistic backtest conditions (1-bar execution delay, 5 bps fees per trade, slippage), outputting financial performance metrics (Total Return, Annualized Return, Sharpe, Sortino, Max Drawdown, Turnover).

**Blocked by:** 01 — Temporal Guard, Anti-Leakage CI Gate & Frozen Data Fixtures

**Status:** done

- [x] Technical indicators (SMA, EMA with SMA seeding, Wilder RSI, Bollinger Bands with population standard deviation, MACD) are implemented in TypeScript with zero external numeric dependencies.
- [x] Unit test suite validates mathematical parity against reference financial datasets and Python indicator outputs.
- [x] Buy & Hold baseline engine produces equity curve, drawdown, and trade records across the bar window.
- [x] Deterministic SMA(20/50) + RSI(14) rule engine emits Buy, Sell, and Neutral signals based strictly on point-in-time indicator snapshots.
- [x] Execution simulator fills signals at the open price of bar $T+1$, deducts 5 bps (0.05%) transaction cost per turnover, and tracks portfolio cash/equity balance.
- [x] Financial metric engine computes Total Return, Annualized Return, Sharpe Ratio (annualized), Sortino Ratio (downside deviation), and Maximum Drawdown without floating point rounding errors.
