"""Backtesting harness skeleton (spec 05).

    from app.backtest import run_backtest, SmaCrossover
    result = run_backtest(SmaCrossover(), bars, cash=100_000.0)

Sprint 3's evaluation suite extends this module; the `run_backtest` signature is
the seam and should stay stable.
"""

from .base import BacktestResult, Strategy, Trade
from .runner import DEFAULT_CASH, run_backtest
from .strategies import BuyAndHold, SmaCrossover, crossover_indices

__all__ = [
    "BacktestResult",
    "BuyAndHold",
    "DEFAULT_CASH",
    "SmaCrossover",
    "Strategy",
    "Trade",
    "crossover_indices",
    "run_backtest",
]
