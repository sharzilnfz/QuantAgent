"""Minimal, working backtest runner (pandas/numpy only — no vectorbt).

Spec 05 asks for a skeleton that ACTUALLY RUNS a toy strategy. This is that: a
long/flat, fully-invested, frictionless simulator in ~60 lines. It is not a
research-grade engine and does not pretend to be — Sprint 3's evaluation suite
fills in costs, slippage, sizing and multi-asset support behind this same
`run_backtest` signature.

THE ONE THING IT GETS RIGHT ON PURPOSE — no look-ahead:
    signal computed on bar i  ->  position held over bar i+1's return
The signal series is shifted by one bar before it is applied. Without that shift
a crossover strategy "buys" using the very bar whose close created the signal,
which inflates every result and is the classic backtest bug this project is
built to avoid.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .base import BacktestResult, Strategy, Trade

DEFAULT_CASH = 100_000.0


def run_backtest(
    strategy: Strategy,
    bars: pd.DataFrame,
    cash: float = DEFAULT_CASH,
) -> BacktestResult:
    """Run `strategy` over `bars` starting from `cash`.

    `bars` needs at minimum a `close` column; `ts` is used for trade timestamps
    when present. Bars are assumed already sorted ascending by time.
    """
    if "close" not in bars.columns:
        raise ValueError("run_backtest: bars must have a 'close' column")
    if cash <= 0:
        raise ValueError("run_backtest: cash must be positive")

    name = getattr(strategy, "name", strategy.__class__.__name__)

    if bars.empty:
        return BacktestResult(
            strategy=name,
            initial_cash=cash,
            final_equity=cash,
            total_return=0.0,
            max_drawdown=0.0,
            n_trades=0,
            n_bars=0,
        )

    frame = bars.reset_index(drop=True)
    close = frame["close"].astype("float64")

    raw_signal = strategy.generate_signals(frame).astype("float64").fillna(0.0)
    raw_signal = pd.Series(np.clip(raw_signal.to_numpy(), -1.0, 1.0), index=frame.index)

    # THE SHIFT: act on bar i's signal from bar i+1 onward.
    position = raw_signal.shift(1).fillna(0.0)

    returns = close.pct_change().fillna(0.0)
    strategy_returns = position * returns
    equity = (1.0 + strategy_returns).cumprod() * cash

    running_peak = equity.cummax()
    drawdown = equity / running_peak - 1.0
    max_drawdown = float(drawdown.min()) if len(drawdown) else 0.0

    trades: list[Trade] = []
    previous = 0.0
    for i in range(len(position)):
        current = float(position.iloc[i])
        if current != previous:
            trades.append(
                Trade(
                    ts=frame["ts"].iloc[i] if "ts" in frame.columns else i,
                    price=float(close.iloc[i]),
                    from_position=previous,
                    to_position=current,
                )
            )
            previous = current

    final_equity = float(equity.iloc[-1])
    return BacktestResult(
        strategy=name,
        initial_cash=cash,
        final_equity=final_equity,
        total_return=final_equity / cash - 1.0,
        max_drawdown=max_drawdown,
        n_trades=len(trades),
        n_bars=len(frame),
        trades=trades,
        equity_curve=equity,
        positions=position,
    )
