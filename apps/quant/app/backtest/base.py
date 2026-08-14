"""Types for the backtest harness — the seam Sprint 3's evaluation suite fills.

Kept deliberately small. `run_backtest(strategy, bars, cash) -> BacktestResult`
is the signature spec 05 pins; everything else here exists to make that
signature meaningful rather than decorative.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

import pandas as pd


@runtime_checkable
class Strategy(Protocol):
    """A strategy maps bars -> desired position, and nothing else.

    `generate_signals` returns a Series aligned to `bars.index` holding the
    TARGET POSITION for each bar, in [-1, 1] (1 = fully long, 0 = flat).

    POINT-IN-TIME: the signal at bar `i` may only use information from bars
    `0..i`. The runner then executes it on bar `i+1` (see `run_backtest`), so a
    strategy can never trade on a bar it used to make the decision.
    """

    name: str

    def generate_signals(self, bars: pd.DataFrame) -> pd.Series: ...


@dataclass(frozen=True)
class Trade:
    """A change in target position, executed at `ts` and `price`."""

    ts: Any
    price: float
    from_position: float
    to_position: float


@dataclass
class BacktestResult:
    strategy: str
    initial_cash: float
    final_equity: float
    total_return: float
    max_drawdown: float
    n_trades: int
    n_bars: int
    trades: list[Trade] = field(default_factory=list)
    equity_curve: pd.Series = field(default_factory=lambda: pd.Series(dtype="float64"))
    positions: pd.Series = field(default_factory=lambda: pd.Series(dtype="float64"))

    def summary(self) -> dict[str, Any]:
        return {
            "strategy": self.strategy,
            "initialCash": self.initial_cash,
            "finalEquity": self.final_equity,
            "totalReturn": self.total_return,
            "maxDrawdown": self.max_drawdown,
            "nTrades": self.n_trades,
            "nBars": self.n_bars,
        }
