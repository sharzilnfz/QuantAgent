"""Hand-rolled technical indicators (pandas/numpy only).

WHY HAND-ROLLED: `pandas-ta` / `vectorbt` have no reliable Python 3.13 wheels and
are commented out in requirements.txt. That turns out to be the better choice
here anyway — spec 05 requires the numbers to match HAND-COMPUTED values, so a
transparent ~150-line implementation whose conventions are written down is the
point, not a workaround.

CONVENTIONS (pinned; changing one is a cross-team event because L2 agents and the
Sprint-3 evaluation suite compare against these numbers):

* SMA(n)          simple arithmetic mean of the last n closes.
                  Warm-up: indices 0..n-2 are NaN.
* EMA(n)          alpha = 2 / (n + 1), recursive, SEEDED WITH THE SMA of the
                  first n valid values (the classic TA-Lib convention, not
                  pandas' `adjust=True` expanding form). Warm-up: n-1 NaNs.
* RSI(14)         Wilder's smoothing (RMA, alpha = 1/n). The first value lands at
                  index n (n price changes needed), so indices 0..n-1 are NaN.
                  Degenerate windows: avg_loss == 0 and avg_gain > 0 -> 100;
                  avg_gain == 0 and avg_loss > 0 -> 0; both zero (flat series)
                  -> 50 (no directional information).
* MACD(12,26,9)   line = EMA(12) - EMA(26); signal = EMA(9) OF THE LINE, computed
                  on the line's valid tail (so the signal's own warm-up starts
                  where the line starts, not at index 0).
* Bollinger(20,2) mid = SMA(20); band = mid +/- k * POPULATION stdev (ddof=0) of
                  the same window. ddof=0 is the TA standard; ddof=1 would move
                  every band and silently change agent behaviour.

DETERMINISM: no randomness, no wall-clock reads, no I/O. Same input -> same
output, always. Warm-up periods emit NaN (-> JSON null), never a fabricated
number.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

__all__ = [
    "sma",
    "ema",
    "rsi",
    "macd",
    "bollinger",
    "rolling_std_population",
]


def _as_float_series(values: pd.Series | np.ndarray | list[float]) -> pd.Series:
    if isinstance(values, pd.Series):
        return values.astype("float64")
    return pd.Series(np.asarray(values, dtype="float64"))


def sma(values: pd.Series, length: int) -> pd.Series:
    """Simple moving average. First `length - 1` entries are NaN."""
    if length < 1:
        raise ValueError("sma length must be >= 1")
    series = _as_float_series(values)
    return series.rolling(window=length, min_periods=length).mean()


def rolling_std_population(values: pd.Series, length: int) -> pd.Series:
    """Rolling standard deviation with ddof=0 (population) — the TA convention."""
    if length < 1:
        raise ValueError("length must be >= 1")
    series = _as_float_series(values)
    return series.rolling(window=length, min_periods=length).std(ddof=0)


def ema(values: pd.Series, length: int) -> pd.Series:
    """SMA-seeded exponential moving average, alpha = 2/(length+1).

    Leading NaNs in the input are skipped (so `ema(macd_line, 9)` starts its
    warm-up where the MACD line becomes valid, not at index 0).
    """
    if length < 1:
        raise ValueError("ema length must be >= 1")
    series = _as_float_series(values)
    out = pd.Series(np.full(len(series), np.nan), index=series.index, dtype="float64")

    valid = series.dropna()
    if len(valid) < length:
        return out

    alpha = 2.0 / (length + 1.0)
    raw = valid.to_numpy(dtype="float64")
    positions = [series.index.get_loc(idx) for idx in valid.index]

    prev = float(raw[:length].mean())  # SMA seed
    out.iloc[positions[length - 1]] = prev
    for i in range(length, len(raw)):
        prev = (raw[i] - prev) * alpha + prev
        out.iloc[positions[i]] = prev
    return out


def wilder_rma(values: pd.Series, length: int) -> pd.Series:
    """Wilder's running moving average (alpha = 1/length), seeded with the SMA."""
    series = _as_float_series(values)
    out = pd.Series(np.full(len(series), np.nan), index=series.index, dtype="float64")
    raw = series.to_numpy(dtype="float64")
    if len(raw) < length:
        return out
    prev = float(np.mean(raw[:length]))
    out.iloc[length - 1] = prev
    for i in range(length, len(raw)):
        prev = (prev * (length - 1) + raw[i]) / length
        out.iloc[i] = prev
    return out


def rsi(values: pd.Series, length: int = 14) -> pd.Series:
    """Wilder's RSI. Indices 0..length-1 are NaN (need `length` price changes)."""
    if length < 1:
        raise ValueError("rsi length must be >= 1")
    series = _as_float_series(values)
    out = pd.Series(np.full(len(series), np.nan), index=series.index, dtype="float64")
    if len(series) <= length:
        return out

    delta = series.diff()
    gain = delta.clip(lower=0.0).fillna(0.0)
    loss = (-delta).clip(lower=0.0).fillna(0.0)

    raw_gain = gain.to_numpy(dtype="float64")
    raw_loss = loss.to_numpy(dtype="float64")

    # Seed on changes at indices 1..length -> first RSI value sits at index `length`.
    avg_gain = float(raw_gain[1 : length + 1].mean())
    avg_loss = float(raw_loss[1 : length + 1].mean())
    out.iloc[length] = _rsi_from_averages(avg_gain, avg_loss)

    for i in range(length + 1, len(series)):
        avg_gain = (avg_gain * (length - 1) + raw_gain[i]) / length
        avg_loss = (avg_loss * (length - 1) + raw_loss[i]) / length
        out.iloc[i] = _rsi_from_averages(avg_gain, avg_loss)

    return out


def _rsi_from_averages(avg_gain: float, avg_loss: float) -> float:
    if avg_loss == 0.0 and avg_gain == 0.0:
        # Perfectly flat window: no directional information. 50 is neutral.
        return 50.0
    if avg_loss == 0.0:
        return 100.0
    if avg_gain == 0.0:
        return 0.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def macd(
    values: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> pd.DataFrame:
    """MACD line, signal line and histogram. Columns: macd, signal, histogram."""
    if fast >= slow:
        raise ValueError("macd requires fast < slow")
    series = _as_float_series(values)
    line = ema(series, fast) - ema(series, slow)
    signal_line = ema(line, signal)
    return pd.DataFrame(
        {
            "macd": line,
            "signal": signal_line,
            "histogram": line - signal_line,
        },
        index=series.index,
    )


def bollinger(values: pd.Series, length: int = 20, num_std: float = 2.0) -> pd.DataFrame:
    """Bollinger Bands. Columns: lower, mid, upper."""
    series = _as_float_series(values)
    mid = sma(series, length)
    dev = rolling_std_population(series, length) * num_std
    return pd.DataFrame(
        {"lower": mid - dev, "mid": mid, "upper": mid + dev},
        index=series.index,
    )
