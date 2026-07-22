"""`as_of` propagation across the L0 -> L1 seam (spec 05 §6, cross-cutting law 1).

A snapshot's `as_of` is the `as_of` of the LATEST bar it consumed. Too early =
look-ahead. These tests pin the rule from both directions.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd

from app.indicators.engine import compute_indicator_snapshots, prepare_bars

from .conftest import SESSION_CLOSE_OFFSET, make_bars


def test_snapshot_as_of_equals_the_latest_consumed_bars_as_of(
    crossover_bars: pd.DataFrame,
) -> None:
    snapshots = compute_indicator_snapshots(crossover_bars)
    for i, snap in enumerate(snapshots):
        expected = crossover_bars["as_of"].iloc[: i + 1].max()
        assert pd.Timestamp(snap.as_of) == expected


def test_as_of_never_precedes_any_bar_that_fed_the_window(
    crossover_bars: pd.DataFrame,
) -> None:
    snapshots = compute_indicator_snapshots(crossover_bars)
    for i, snap in enumerate(snapshots):
        window_max = crossover_bars["as_of"].iloc[: i + 1].max()
        assert pd.Timestamp(snap.as_of) >= window_max


def test_as_of_is_monotonically_non_decreasing(crossover_bars: pd.DataFrame) -> None:
    snapshots = compute_indicator_snapshots(crossover_bars)
    stamps = [pd.Timestamp(s.as_of) for s in snapshots]
    assert stamps == sorted(stamps)


def test_a_late_revised_bar_pushes_as_of_later_never_earlier() -> None:
    """Mixed as_of: bar 30 was revised days after the fact.

    Every snapshot from bar 30 onwards must inherit that later `as_of` — the
    snapshot genuinely was not computable until the revision landed.
    """
    n = 60
    offsets = [SESSION_CLOSE_OFFSET] * n
    offsets[30] = SESSION_CLOSE_OFFSET + timedelta(days=10)  # late revision
    bars = make_bars([100.0 + i for i in range(n)], as_of_offsets=offsets)

    snapshots = compute_indicator_snapshots(bars)
    revised_as_of = bars["as_of"].iloc[30]

    assert pd.Timestamp(snapshots[29].as_of) < revised_as_of
    for i in range(30, n):
        assert pd.Timestamp(snapshots[i].as_of) >= revised_as_of


def test_a_future_bar_never_leaks_into_an_earlier_snapshot() -> None:
    """The last bar carries a far-future as_of; earlier snapshots must ignore it."""
    n = 60
    offsets = [SESSION_CLOSE_OFFSET] * n
    offsets[-1] = SESSION_CLOSE_OFFSET + timedelta(days=365)
    bars = make_bars([100.0 + i for i in range(n)], as_of_offsets=offsets)

    snapshots = compute_indicator_snapshots(bars)
    leaked = bars["as_of"].iloc[-1]
    for snap in snapshots[:-1]:
        assert pd.Timestamp(snap.as_of) < leaked
    assert pd.Timestamp(snapshots[-1].as_of) == leaked


def test_decision_boundary_removes_bars_before_any_maths_runs() -> None:
    """Bars past the boundary must not merely be hidden — they must not compute."""
    n = 80
    bars = make_bars([100.0 + i for i in range(n)])
    boundary = bars["as_of"].iloc[59].to_pydatetime()

    filtered = prepare_bars(bars, as_of_max=boundary)
    assert len(filtered) == 60

    bounded = compute_indicator_snapshots(bars, as_of_max=boundary)
    assert len(bounded) == 60
    for snap in bounded:
        assert pd.Timestamp(snap.as_of) <= pd.Timestamp(boundary)

    # And the values are identical to computing on the truncated input directly:
    # no trace of the excluded bars survives anywhere.
    truncated = compute_indicator_snapshots(bars.iloc[:60].copy())
    assert [s.to_contract() for s in bounded] == [s.to_contract() for s in truncated]


def test_bars_are_sorted_and_deduped_before_computation() -> None:
    bars = make_bars([100.0 + i for i in range(30)])
    shuffled = pd.concat([bars.iloc[10:], bars.iloc[:10], bars.iloc[5:8]], ignore_index=True)

    prepared = prepare_bars(shuffled)
    assert len(prepared) == 30
    assert prepared["ts"].is_monotonic_increasing


def test_timestamps_serialise_as_utc_iso_with_a_z_suffix() -> None:
    bars = make_bars([100.0, 101.0, 102.0])
    contract = compute_indicator_snapshots(bars)[0].to_contract()
    assert contract["ts"] == "2024-01-02T00:00:00.000Z"
    assert contract["asOf"] == "2024-01-02T21:00:00.000Z"
    # Round-trips back to the same instant.
    assert datetime.fromisoformat(contract["asOf"].replace("Z", "+00:00")) == datetime(
        2024, 1, 2, 21, 0, tzinfo=timezone.utc
    )
