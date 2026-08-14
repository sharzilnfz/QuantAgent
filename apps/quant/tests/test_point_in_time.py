"""POINT-IN-TIME INTEGRITY TEST — placeholder (spec 05 §2, cross-cutting law 1).

Sprint 3 hardens this into the real thing: a sweep over every fact table and
every decision row asserting that no decision at time T read a fact whose
`as_of > T`, run against a seeded database in CI so a violation fails the build.

It exists NOW, green and running in CI, so the discipline is visible from day
one rather than retrofitted. What it checks today are the invariants that can be
proven without a database — which is most of them, because the `as_of` rules are
pure functions of the data.

DO NOT DELETE OR WEAKEN. Tighten only.
"""

from __future__ import annotations

from datetime import timedelta

import pandas as pd
import pytest

from app import db
from app.indicators.engine import compute_indicator_snapshots

from .conftest import SESSION_CLOSE_OFFSET, make_bars

requires_db = pytest.mark.skipif(
    not db.database_available(),
    reason="no live Postgres — DB-backed PIT checks are skipped (Sprint 3 runs these in CI)",
)


# ---------------------------------------------------------------------------
# Invariants provable without a database. These run everywhere, always.
# ---------------------------------------------------------------------------
class TestPointInTimeInvariants:
    def test_no_snapshot_is_knowable_before_the_bar_it_describes(
        self, crossover_bars: pd.DataFrame
    ) -> None:
        for snap in compute_indicator_snapshots(crossover_bars):
            assert pd.Timestamp(snap.as_of) >= pd.Timestamp(snap.ts)

    def test_no_snapshot_sees_a_bar_it_was_not_allowed_to_see(
        self, crossover_bars: pd.DataFrame
    ) -> None:
        """For every decision boundary, bounded output == output over truncated input."""
        snapshots = compute_indicator_snapshots(crossover_bars)
        for boundary_index in (49, 80, 122, 199):
            boundary = crossover_bars["as_of"].iloc[boundary_index].to_pydatetime()
            bounded = compute_indicator_snapshots(crossover_bars, as_of_max=boundary)
            assert len(bounded) == boundary_index + 1
            for i, snap in enumerate(bounded):
                assert snap.to_contract() == snapshots[i].to_contract()

    def test_widening_the_window_never_changes_an_earlier_snapshot(
        self, crossover_bars: pd.DataFrame
    ) -> None:
        """The look-ahead tripwire: adding future bars must not move past values."""
        short = compute_indicator_snapshots(crossover_bars.iloc[:120].copy())
        full = compute_indicator_snapshots(crossover_bars)
        assert [s.to_contract() for s in short] == [s.to_contract() for s in full[:120]]

    def test_every_snapshot_carries_a_non_null_as_of(self, crossover_bars: pd.DataFrame) -> None:
        for snap in compute_indicator_snapshots(crossover_bars):
            assert snap.as_of is not None
            assert pd.Timestamp(snap.as_of).tzinfo is not None

    def test_a_bar_revised_after_the_boundary_is_invisible(self) -> None:
        n = 60
        offsets = [SESSION_CLOSE_OFFSET] * n
        offsets[10] = SESSION_CLOSE_OFFSET + timedelta(days=500)  # revised much later
        bars = make_bars([100.0 + i for i in range(n)], as_of_offsets=offsets)

        boundary = bars["as_of"].iloc[59].to_pydatetime()
        bounded = compute_indicator_snapshots(bars, as_of_max=boundary)

        # The late-revised bar 10 is excluded entirely, so 59 bars remain.
        assert len(bounded) == n - 1
        excluded_ts = bars["ts"].iloc[10]
        assert all(pd.Timestamp(s.ts) != excluded_ts for s in bounded)


# ---------------------------------------------------------------------------
# DB-backed checks. Skipped without Postgres; Sprint 3 makes these the core.
# ---------------------------------------------------------------------------
class TestPointInTimeAgainstDatabase:
    @requires_db
    def test_no_price_bar_has_an_as_of_before_its_own_ts(self) -> None:
        with db.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("select count(*) from price_bars where as_of < ts")
                (violations,) = cur.fetchone()
        assert violations == 0, f"{violations} price_bars rows have as_of < ts"

    @requires_db
    def test_no_fact_row_has_an_as_of_in_the_future(self) -> None:
        with db.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("select count(*) from price_bars where as_of > now()")
                (bars,) = cur.fetchone()
                cur.execute("select count(*) from indicator_snapshots where as_of > now()")
                (snaps,) = cur.fetchone()
        assert bars == 0 and snaps == 0

    @requires_db
    def test_every_snapshot_as_of_matches_its_latest_consumed_bar(self) -> None:
        """A snapshot must never claim to be knowable before the bars it used."""
        with db.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select count(*)
                    from indicator_snapshots s
                    where exists (
                        select 1 from price_bars b
                        where b.symbol = s.symbol
                          and b.timeframe = s.timeframe
                          and b.ts <= s.ts
                          and b.as_of > s.as_of
                    )
                    """
                )
                (violations,) = cur.fetchone()
        assert violations == 0, f"{violations} snapshots predate a bar they consumed"

    @pytest.mark.skip(reason="Sprint 3: decision rows do not exist until L3/L5 land")
    def test_no_decision_read_a_fact_from_its_own_future(self) -> None:  # pragma: no cover
        """PLACEHOLDER for the real integrity sweep.

        Sprint 3: for every agent_outputs / decision row R, assert that every
        fact joined into R has `as_of <= R.decision_ts`. This is the build-failing
        check the overview promises.
        """
        raise AssertionError("not implemented until Sprint 3")


def test_the_service_imports_without_a_database() -> None:
    """The whole point of the db module's lazy design — keep it that way."""
    import importlib

    module = importlib.import_module("app.main")
    assert module.app is not None
