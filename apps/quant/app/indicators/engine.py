"""Turn a bars frame into `indicator_snapshots` rows, point-in-time-correctly.

THE `as_of` RULE ON THIS SIDE OF THE SEAM
-----------------------------------------
Spec 04 stamps every bar with the moment it became knowable. This module must
not lose that. A snapshot at bar `i`:

    snapshot.as_of = max(bar.as_of for bar in bars[0..i])

i.e. the `as_of` of the LATEST bar it consumed. The running maximum (rather than
simply `bars[i].as_of`) is the conservative choice: if bar `i-3` was revised and
carries a later `as_of` than bar `i`, the snapshot genuinely was not computable
until that later moment. Taking the max can only ever push `as_of` LATER, which
merely delays availability; taking anything else could push it EARLIER, which is
a look-ahead bug.

Because every rolling window is causal (it reads only bars[0..i]) no future bar
can leak into an earlier snapshot. When the caller supplies a decision boundary,
bars with `as_of > boundary` are removed BEFORE any maths runs, so they cannot
influence a single value.

WARM-UP: an indicator whose lookback is not yet satisfied emits `None` (JSON
`null`). Never a fabricated number, never a forward/backward fill.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Sequence

import pandas as pd

from .core import bollinger, macd, rsi, sma

# The jsonb keys spec 01 / spec 02 expect, in a fixed order.
INDICATOR_KEYS: tuple[str, ...] = (
    "rsi",
    "macd",
    "macdSignal",
    "bbUpper",
    "bbLower",
    "sma20",
    "sma50",
)

RSI_LENGTH = 14
MACD_FAST, MACD_SLOW, MACD_SIGNAL = 12, 26, 9
BB_LENGTH, BB_STD = 20, 2.0
SMA_FAST, SMA_SLOW = 20, 50


@dataclass(frozen=True)
class IndicatorSnapshot:
    """One row of `indicator_snapshots`, isomorphic with the Zod contract."""

    symbol: str
    timeframe: str
    ts: datetime
    as_of: datetime
    values: dict[str, float | None] = field(default_factory=dict)

    def to_contract(self) -> dict[str, Any]:
        """Flat JSON shape the contracts package validates (camelCase, ISO timestamps)."""
        out: dict[str, Any] = {
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "ts": _iso(self.ts),
            "asOf": _iso(self.as_of),
        }
        for key in INDICATOR_KEYS:
            out[key] = self.values.get(key)
        return out

    def to_row(self) -> dict[str, Any]:
        """Shape the DB writer wants: indicators nested in a jsonb payload."""
        return {
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "ts": self.ts,
            "asOf": self.as_of,
            "indicators": {key: self.values.get(key) for key in INDICATOR_KEYS},
        }


def _iso(value: Any) -> str:
    ts = pd.Timestamp(value)
    if ts.tzinfo is None:
        ts = ts.tz_localize("UTC")
    else:
        ts = ts.tz_convert("UTC")
    # ISO-8601 with a 'Z' suffix — what `z.string().datetime()` accepts.
    return ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z"


def _null_safe(value: Any) -> float | None:
    """NaN / inf -> None. This is what makes warm-up periods honest nulls."""
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def prepare_bars(bars: pd.DataFrame, as_of_max: datetime | None = None) -> pd.DataFrame:
    """Sort by ts, drop duplicate ts (last wins), and apply the PIT boundary.

    Filtering happens HERE, before any maths — a bar the caller was not allowed
    to see must never touch a rolling window.
    """
    if bars.empty:
        return bars.copy()

    frame = bars.copy()
    frame["ts"] = pd.to_datetime(frame["ts"], utc=True)
    frame["as_of"] = pd.to_datetime(frame["as_of"], utc=True)

    if as_of_max is not None:
        boundary = pd.Timestamp(as_of_max)
        if boundary.tzinfo is None:
            boundary = boundary.tz_localize("UTC")
        frame = frame[frame["as_of"] <= boundary]

    frame = (
        frame.sort_values("ts", kind="stable")
        .drop_duplicates(subset=["ts"], keep="last")
        .reset_index(drop=True)
    )
    return frame


def compute_indicator_snapshots(
    bars: pd.DataFrame,
    symbol: str | None = None,
    timeframe: str | None = None,
    as_of_max: datetime | None = None,
) -> list[IndicatorSnapshot]:
    """Compute one snapshot per bar. Pure: no DB, no clock, no randomness."""
    frame = prepare_bars(bars, as_of_max=as_of_max)
    if frame.empty:
        return []

    resolved_symbol = symbol or str(frame["symbol"].iloc[0])
    resolved_timeframe = timeframe or str(frame["timeframe"].iloc[0])

    close = frame["close"].astype("float64")

    rsi_series = rsi(close, RSI_LENGTH)
    macd_frame = macd(close, MACD_FAST, MACD_SLOW, MACD_SIGNAL)
    bb_frame = bollinger(close, BB_LENGTH, BB_STD)
    sma_fast = sma(close, SMA_FAST)
    sma_slow = sma(close, SMA_SLOW)

    # Running max => "the as_of of the latest bar consumed", monotonic and
    # never earlier than any bar that fed the window. See module docstring.
    as_of_running_max = frame["as_of"].cummax()

    snapshots: list[IndicatorSnapshot] = []
    for i in range(len(frame)):
        snapshots.append(
            IndicatorSnapshot(
                symbol=resolved_symbol,
                timeframe=resolved_timeframe,
                ts=frame["ts"].iloc[i].to_pydatetime(),
                as_of=as_of_running_max.iloc[i].to_pydatetime(),
                values={
                    "rsi": _null_safe(rsi_series.iloc[i]),
                    "macd": _null_safe(macd_frame["macd"].iloc[i]),
                    "macdSignal": _null_safe(macd_frame["signal"].iloc[i]),
                    "bbUpper": _null_safe(bb_frame["upper"].iloc[i]),
                    "bbLower": _null_safe(bb_frame["lower"].iloc[i]),
                    "sma20": _null_safe(sma_fast.iloc[i]),
                    "sma50": _null_safe(sma_slow.iloc[i]),
                },
            )
        )
    return snapshots


def snapshots_to_contract(snapshots: Sequence[IndicatorSnapshot]) -> list[dict[str, Any]]:
    return [snap.to_contract() for snap in snapshots]


def snapshots_to_rows(snapshots: Sequence[IndicatorSnapshot]) -> list[dict[str, Any]]:
    return [snap.to_row() for snap in snapshots]
