"""Toy strategies. The SMA crossover exists so the harness has something real to
run — spec 05: "an empty stub that can't execute is worse than a thin one that can."
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from ..indicators.core import sma


@dataclass
class SmaCrossover:
    """Long while SMA(fast) > SMA(slow), flat otherwise.

    Both SMAs at bar `i` use only closes from bars `0..i`, so the signal is
    causal. Bars where either SMA is still warming up produce position 0 (flat)
    — never a guess.
    """

    fast: int = 20
    slow: int = 50
    name: str = "sma_crossover"

    def generate_signals(self, bars: pd.DataFrame) -> pd.Series:
        close = bars["close"].astype("float64")
        fast_ma = sma(close, self.fast)
        slow_ma = sma(close, self.slow)
        signal = pd.Series(
            np.where(fast_ma.notna() & slow_ma.notna() & (fast_ma > slow_ma), 1.0, 0.0),
            index=bars.index,
            dtype="float64",
        )
        return signal


@dataclass
class BuyAndHold:
    """The baseline every strategy has to beat. Long from the first bar."""

    name: str = "buy_and_hold"

    def generate_signals(self, bars: pd.DataFrame) -> pd.Series:
        return pd.Series(1.0, index=bars.index, dtype="float64")


def crossover_indices(fast_ma: pd.Series, slow_ma: pd.Series) -> list[int]:
    """Positional indices where fast crosses strictly ABOVE slow.

    A crossover fires on the first bar where both MAs are defined, fast > slow,
    and on the previous defined bar fast <= slow.
    """
    out: list[int] = []
    previous: bool | None = None
    for i in range(len(fast_ma)):
        f = fast_ma.iloc[i]
        s = slow_ma.iloc[i]
        if pd.isna(f) or pd.isna(s):
            continue
        current = bool(f > s)
        if previous is not None and current and not previous:
            out.append(i)
        previous = current
    return out
