"""Warm-up periods must emit `null`, never a fabricated number (spec 05 §6).

A backfilled or "close enough" value during warm-up is worse than no value: the
agent above cannot tell it apart from a real reading.
"""

from __future__ import annotations

import pandas as pd

from app.indicators.engine import (
    BB_LENGTH,
    MACD_SIGNAL,
    MACD_SLOW,
    RSI_LENGTH,
    SMA_FAST,
    SMA_SLOW,
    compute_indicator_snapshots,
)

from .conftest import make_bars

# First index at which each indicator is legitimately defined.
FIRST_VALID = {
    "rsi": RSI_LENGTH,  # 14 — needs 14 price changes
    "macd": MACD_SLOW - 1,  # 25 — slow EMA seeds at index 25
    "macdSignal": (MACD_SLOW - 1) + (MACD_SIGNAL - 1),  # 33
    "bbUpper": BB_LENGTH - 1,  # 19
    "bbLower": BB_LENGTH - 1,  # 19
    "sma20": SMA_FAST - 1,  # 19
    "sma50": SMA_SLOW - 1,  # 49
}


def test_every_indicator_is_null_until_its_lookback_is_satisfied(
    crossover_bars: pd.DataFrame,
) -> None:
    snapshots = compute_indicator_snapshots(crossover_bars)
    assert len(snapshots) == len(crossover_bars)

    for key, first_valid in FIRST_VALID.items():
        for i in range(first_valid):
            assert snapshots[i].values[key] is None, (
                f"{key} must be null at bar {i} (warm-up ends at {first_valid})"
            )
        assert snapshots[first_valid].values[key] is not None, (
            f"{key} should be defined at bar {first_valid}"
        )


def test_the_very_first_snapshot_is_all_nulls(crossover_bars: pd.DataFrame) -> None:
    first = compute_indicator_snapshots(crossover_bars)[0]
    assert all(value is None for value in first.values.values())
    # But it is still a real row with real timestamps.
    assert first.ts is not None
    assert first.as_of is not None


def test_a_series_shorter_than_every_lookback_yields_all_nulls() -> None:
    bars = make_bars([100.0 + i for i in range(5)])
    snapshots = compute_indicator_snapshots(bars)
    assert len(snapshots) == 5
    for snap in snapshots:
        assert all(value is None for value in snap.values.values())


def test_no_snapshots_for_an_empty_frame() -> None:
    bars = make_bars([])
    assert compute_indicator_snapshots(bars) == []


def test_contract_shape_always_carries_every_key(crossover_bars: pd.DataFrame) -> None:
    """Nulls are emitted as explicit keys, not omitted — the Zod schema requires them."""
    contract = compute_indicator_snapshots(crossover_bars)[0].to_contract()
    for key in ("rsi", "macd", "macdSignal", "bbUpper", "bbLower", "sma20", "sma50"):
        assert key in contract
        assert contract[key] is None
    assert contract["symbol"] == "SYNTH"
    assert contract["timeframe"] == "1Day"
    assert contract["ts"].endswith("Z")
    assert contract["asOf"].endswith("Z")


def test_null_values_are_json_serialisable(crossover_bars: pd.DataFrame) -> None:
    import json

    payload = json.dumps([s.to_contract() for s in compute_indicator_snapshots(crossover_bars)])
    assert '"rsi": null' in payload
