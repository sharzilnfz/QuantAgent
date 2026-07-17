"""
Tests for the indicator computation module.

Uses a fixed set of bars with known values and verifies computed indicators
are within acceptable tolerance.
"""

import pytest
from app.indicators import Bar, compute_indicators


def _make_bars(closes: list[float], symbol: str = "TEST") -> list[Bar]:
    """Helper: generate bars from a list of close prices with synthetic OHLV."""
    bars = []
    for i, close in enumerate(closes):
        bars.append(
            Bar(
                symbol=symbol,
                timeframe="1D",
                barTime=f"2024-01-{(i + 1):02d}T00:00:00+00:00",
                open=close - 0.5,
                high=close + 1.0,
                low=close - 1.0,
                close=close,
                volume=1000 * (i + 1),
                asOf=f"2024-01-{(i + 1):02d}T16:00:00+00:00",
            )
        )
    return bars


class TestIndicatorComputation:
    """Tests for compute_indicators."""

    def test_empty_bars_returns_empty(self):
        result = compute_indicators([])
        assert result == []

    def test_returns_one_result_per_bar(self):
        closes = [100.0 + i for i in range(30)]
        bars = _make_bars(closes)
        results = compute_indicators(bars)
        assert len(results) == len(bars)

    def test_rsi_within_bounds(self):
        """RSI should be between 0 and 100 for non-null values."""
        closes = [100 + (i % 10) * (-1) ** i for i in range(30)]
        bars = _make_bars(closes)
        results = compute_indicators(bars)

        for r in results:
            if r.values.rsi is not None:
                assert 0 <= r.values.rsi <= 100, f"RSI out of bounds: {r.values.rsi}"

    def test_sma_correctness(self):
        """SMA(20) at bar 20 should equal the mean of the first 20 closes."""
        closes = list(range(1, 31))  # 1, 2, 3, ..., 30
        bars = _make_bars([float(c) for c in closes])
        results = compute_indicators(bars)

        # SMA(20) at index 19 (bar 20) = mean(1..20) = 10.5
        sma_at_20 = results[19].values.sma
        assert sma_at_20 is not None
        assert abs(sma_at_20 - 10.5) < 0.01, f"Expected SMA=10.5, got {sma_at_20}"

    def test_macd_values_present_after_warmup(self):
        """MACD should have values after the slow period (26 bars)."""
        closes = [100 + i * 0.5 for i in range(40)]
        bars = _make_bars(closes)
        results = compute_indicators(bars)

        # After 26+ bars, MACD should be non-null
        macd_val = results[35].values.macd
        assert macd_val is not None, "MACD should be computed after 26 bars"

    def test_bollinger_bands_order(self):
        """BB lower < BB mid < BB upper for non-null values."""
        closes = [100 + (i % 5) * 2 for i in range(30)]
        bars = _make_bars(closes)
        results = compute_indicators(bars)

        for r in results:
            if (
                r.values.bb_lower is not None
                and r.values.bb_mid is not None
                and r.values.bb_upper is not None
            ):
                assert r.values.bb_lower <= r.values.bb_mid <= r.values.bb_upper, (
                    f"BB order violated: {r.values.bb_lower} <= "
                    f"{r.values.bb_mid} <= {r.values.bb_upper}"
                )

    def test_early_bars_have_null_indicators(self):
        """Bars before the lookback period should have null indicators."""
        closes = [100.0 + i for i in range(5)]
        bars = _make_bars(closes)
        results = compute_indicators(bars)

        # With only 5 bars, RSI(14) and SMA(20) should be null
        for r in results:
            assert r.values.rsi is None, "RSI should be null with <14 bars"
            assert r.values.sma is None, "SMA should be null with <20 bars"
