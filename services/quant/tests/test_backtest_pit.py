"""
Tests for the point-in-time guard and backtest harness skeleton.
"""

from datetime import datetime, timezone

import pytest
from app.backtest.harness import (
    BacktestBar,
    PointInTimeViolation,
    Signal,
    SmaCrossoverGenerator,
    WalkForwardRunner,
    assert_pit_compliance,
    pit_filter,
)


def dt(day: int, hour: int = 0) -> datetime:
    """Helper to create UTC datetimes."""
    return datetime(2024, 1, day, hour, tzinfo=timezone.utc)


def _make_bars() -> list[BacktestBar]:
    return [
        # bar_time, as_of, close
        BacktestBar(dt(1, 0), 10.0, 11.0, 9.0, 10.0, 100, dt(1, 16)),
        BacktestBar(dt(2, 0), 10.0, 11.0, 9.0, 11.0, 100, dt(2, 16)),
        BacktestBar(dt(3, 0), 11.0, 12.0, 10.0, 12.0, 100, dt(3, 16)),
        BacktestBar(dt(4, 0), 12.0, 13.0, 11.0, 11.0, 100, dt(4, 16)),
        BacktestBar(dt(5, 0), 11.0, 12.0, 10.0, 10.0, 100, dt(5, 16)),
    ]


class TestPointInTimeGuard:
    def test_pit_filter_returns_only_past_and_present(self):
        bars = _make_bars()
        # Decision at day 3, 15:00 UTC (before day 3 bar's as_of at 16:00)
        available = pit_filter(bars, dt(3, 15))

        assert len(available) == 2
        assert available[0].bar_time == dt(1, 0)
        assert available[1].bar_time == dt(2, 0)

        # Decision at day 3, 17:00 UTC (after day 3 bar's as_of)
        available_later = pit_filter(bars, dt(3, 17))
        assert len(available_later) == 3

    def test_assert_pit_compliance_passes_for_valid_signal(self):
        bars = _make_bars()
        available = pit_filter(bars, dt(3, 17))
        signal = Signal(decision_time=dt(3, 17), symbol="TEST", bias="neutral", confidence=0)

        # Should not raise
        assert_pit_compliance(available, signal)

    def test_assert_pit_compliance_raises_on_violation(self):
        bars = _make_bars()
        # Pretend we maliciously passed all bars to a signal at day 2
        signal = Signal(decision_time=dt(2, 17), symbol="TEST", bias="neutral", confidence=0)

        with pytest.raises(PointInTimeViolation) as exc:
            assert_pit_compliance(bars, signal)

        assert "PIT violation" in str(exc.value)


class TestWalkForwardRunner:
    def test_walk_forward_runner_with_sma_crossover(self):
        bars = _make_bars()
        # SMA period 3 to get signals with 5 bars
        generator = SmaCrossoverGenerator(sma_period=3)
        runner = WalkForwardRunner(generator)

        decision_times = [
            dt(3, 17),  # Has 3 bars (10, 11, 12). SMA=11. Close=12. Bias: bullish
            dt(4, 17),  # Has 4 bars. Last 3: (11, 12, 11). SMA=11.33. Close=11. Bias: bearish
            dt(5, 17),  # Has 5 bars. Last 3: (12, 11, 10). SMA=11. Close=10. Bias: bearish
        ]

        signals = runner.run(bars, decision_times)

        assert len(signals) == 3

        assert signals[0].decision_time == dt(3, 17)
        assert signals[0].bias == "bullish"
        assert signals[0].features["close"] == 12.0
        assert signals[0].features["sma"] == 11.0

        assert signals[1].decision_time == dt(4, 17)
        assert signals[1].bias == "bearish"
        assert signals[1].features["close"] == 11.0
        # 34 / 3 = 11.3333... rounded to 4 decimals = 11.3333
        assert signals[1].features["sma"] == 11.3333

        assert signals[2].decision_time == dt(5, 17)
        assert signals[2].bias == "bearish"
        assert signals[2].features["close"] == 10.0
        assert signals[2].features["sma"] == 11.0
