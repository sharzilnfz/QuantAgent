"""Shared synthetic fixtures.

Every series here is deterministic and analytically tractable on purpose: the
indicator tests must be able to state the expected number from first principles,
not from "whatever the code printed last time".
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest

from app.db import empty_bars_frame

# Bars are daily; as_of = session close (16:00 EST = 21:00Z), matching the rule
# spec 04's TypeScript ingester stamps onto price_bars.
SESSION_CLOSE_OFFSET = timedelta(hours=21)
FIRST_TS = datetime(2024, 1, 2, 0, 0, tzinfo=timezone.utc)


def make_bars(
    closes: list[float],
    symbol: str = "SYNTH",
    timeframe: str = "1Day",
    as_of_offsets: list[timedelta] | None = None,
) -> pd.DataFrame:
    """Build a price_bars-shaped frame from a list of closes."""
    if not closes:
        return empty_bars_frame()

    rows = []
    for i, close in enumerate(closes):
        ts = FIRST_TS + timedelta(days=i)
        offset = as_of_offsets[i] if as_of_offsets is not None else SESSION_CLOSE_OFFSET
        rows.append(
            {
                "symbol": symbol,
                "timeframe": timeframe,
                "ts": ts,
                "open": close,
                "high": close,
                "low": close,
                "close": close,
                "volume": 1_000_000.0,
                "as_of": ts + offset,
            }
        )
    frame = pd.DataFrame(rows)
    frame["ts"] = pd.to_datetime(frame["ts"], utc=True)
    frame["as_of"] = pd.to_datetime(frame["as_of"], utc=True)
    return frame


# ---------------------------------------------------------------------------
# The crossover series.
#
#   bars   0..99   p[i] = 200 - i        (declining by 1/bar, p[99] = 101)
#   bars 100..199  p[i] = i + 2          (rising  by 1/bar, p[100] = 102)
#
# SMA20 crosses strictly above SMA50 at bar 122. Verified analytically:
#   SMA20[122] = mean(p[103..122]) = mean(105..124)                   = 114.50
#   SMA50[122] = (sum p[73..99] + sum p[100..122]) / 50
#              = (3078 + 2599) / 50                                   = 113.54
#   SMA20[121] = 113.50  <  SMA50[121] = 113.62   -> no cross yet
# ---------------------------------------------------------------------------
CROSSOVER_BAR = 122


def crossover_closes() -> list[float]:
    return [200.0 - i for i in range(100)] + [float(i + 2) for i in range(100, 200)]


@pytest.fixture
def crossover_bars() -> pd.DataFrame:
    return make_bars(crossover_closes())


@pytest.fixture
def ramp_bars() -> pd.DataFrame:
    """p[i] = i. Makes every SMA/Bollinger value a closed-form expression."""
    return make_bars([float(i) for i in range(80)])


@pytest.fixture
def flat_bars() -> pd.DataFrame:
    return make_bars([100.0] * 80)


@pytest.fixture
def rising_bars() -> pd.DataFrame:
    return make_bars([100.0 + i for i in range(60)])


@pytest.fixture
def falling_bars() -> pd.DataFrame:
    return make_bars([200.0 - i for i in range(60)])
