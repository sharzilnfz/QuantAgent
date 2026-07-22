"""THE BUG TRIPWIRE (spec 05 §7, PRD Testing Decisions).

Every expected number below is derived by hand or by an INDEPENDENT explicit
implementation written inside the test — never by calling the module under test
and pinning whatever it produced. If someone "optimises" `core.py` and changes a
convention, these fail.
"""

from __future__ import annotations

import math

import pandas as pd
import pytest

from app.backtest.strategies import crossover_indices
from app.indicators.core import bollinger, ema, macd, rsi, sma
from app.indicators.engine import compute_indicator_snapshots

from .conftest import CROSSOVER_BAR


# ---------------------------------------------------------------------------
# Independent oracles — plain loops, no shared code with app.indicators.core.
# ---------------------------------------------------------------------------
def oracle_sma(values: list[float], n: int) -> list[float | None]:
    return [None if i < n - 1 else sum(values[i - n + 1 : i + 1]) / n for i in range(len(values))]


def oracle_ema(values: list[float], n: int) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if len(values) < n:
        return out
    alpha = 2.0 / (n + 1.0)
    prev = sum(values[:n]) / n
    out[n - 1] = prev
    for i in range(n, len(values)):
        prev = (values[i] - prev) * alpha + prev
        out[i] = prev
    return out


def oracle_rsi(values: list[float], n: int = 14) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if len(values) <= n:
        return out
    gains = [max(values[i] - values[i - 1], 0.0) for i in range(1, len(values))]
    losses = [max(values[i - 1] - values[i], 0.0) for i in range(1, len(values))]
    avg_g = sum(gains[:n]) / n
    avg_l = sum(losses[:n]) / n

    def to_rsi(g: float, ll: float) -> float:
        if g == 0.0 and ll == 0.0:
            return 50.0
        if ll == 0.0:
            return 100.0
        if g == 0.0:
            return 0.0
        return 100.0 - 100.0 / (1.0 + g / ll)

    out[n] = to_rsi(avg_g, avg_l)
    for i in range(n + 1, len(values)):
        avg_g = (avg_g * (n - 1) + gains[i - 1]) / n
        avg_l = (avg_l * (n - 1) + losses[i - 1]) / n
        out[i] = to_rsi(avg_g, avg_l)
    return out


# ---------------------------------------------------------------------------
# SMA
# ---------------------------------------------------------------------------
class TestSma:
    def test_closed_form_on_a_linear_ramp(self, ramp_bars: pd.DataFrame) -> None:
        # p[i] = i, so SMA20[i] = i - 9.5 and SMA50[i] = i - 24.5.
        closes = ramp_bars["close"]
        s20 = sma(closes, 20)
        s50 = sma(closes, 50)
        assert s20.iloc[19] == pytest.approx(9.5)
        assert s20.iloc[50] == pytest.approx(40.5)
        assert s50.iloc[49] == pytest.approx(24.5)
        assert s50.iloc[79] == pytest.approx(54.5)

    def test_matches_the_independent_oracle(self, crossover_bars: pd.DataFrame) -> None:
        closes = crossover_bars["close"].tolist()
        for n in (20, 50):
            expected = oracle_sma(closes, n)
            actual = sma(crossover_bars["close"], n)
            for i, want in enumerate(expected):
                if want is None:
                    assert math.isnan(actual.iloc[i])
                else:
                    assert actual.iloc[i] == pytest.approx(want, rel=1e-12)

    def test_rejects_a_nonsense_length(self) -> None:
        with pytest.raises(ValueError):
            sma(pd.Series([1.0, 2.0]), 0)


# ---------------------------------------------------------------------------
# The SMA crossover — the specific bar the spec asks us to pin.
# ---------------------------------------------------------------------------
class TestSmaCrossover:
    def test_fires_on_the_expected_bar(self, crossover_bars: pd.DataFrame) -> None:
        closes = crossover_bars["close"]
        s20 = sma(closes, 20)
        s50 = sma(closes, 50)

        # Hand-computed at the crossover bar (see conftest for the derivation).
        assert s20.iloc[CROSSOVER_BAR] == pytest.approx(114.50)
        assert s50.iloc[CROSSOVER_BAR] == pytest.approx(113.54)
        # ...and not yet crossed on the bar before.
        assert s20.iloc[CROSSOVER_BAR - 1] == pytest.approx(113.50)
        assert s50.iloc[CROSSOVER_BAR - 1] == pytest.approx(113.62)
        assert s20.iloc[CROSSOVER_BAR - 1] < s50.iloc[CROSSOVER_BAR - 1]

        assert crossover_indices(s20, s50) == [CROSSOVER_BAR]

    def test_snapshots_agree_with_the_raw_series(self, crossover_bars: pd.DataFrame) -> None:
        snapshots = compute_indicator_snapshots(crossover_bars)
        at = snapshots[CROSSOVER_BAR].values
        before = snapshots[CROSSOVER_BAR - 1].values
        assert at["sma20"] is not None and at["sma50"] is not None
        assert at["sma20"] > at["sma50"]
        assert before["sma20"] is not None and before["sma50"] is not None
        assert before["sma20"] <= before["sma50"]


# ---------------------------------------------------------------------------
# RSI
# ---------------------------------------------------------------------------
class TestRsi:
    def test_is_100_on_a_strictly_rising_series(self, rising_bars: pd.DataFrame) -> None:
        values = rsi(rising_bars["close"], 14)
        assert values.iloc[14] == pytest.approx(100.0)
        assert values.iloc[-1] == pytest.approx(100.0)

    def test_is_0_on_a_strictly_falling_series(self, falling_bars: pd.DataFrame) -> None:
        values = rsi(falling_bars["close"], 14)
        assert values.iloc[14] == pytest.approx(0.0)
        assert values.iloc[-1] == pytest.approx(0.0)

    def test_is_50_on_a_flat_series(self, flat_bars: pd.DataFrame) -> None:
        values = rsi(flat_bars["close"], 14)
        assert values.iloc[14] == pytest.approx(50.0)

    def test_matches_the_independent_wilder_oracle(self, crossover_bars: pd.DataFrame) -> None:
        closes = crossover_bars["close"].tolist()
        expected = oracle_rsi(closes, 14)
        actual = rsi(crossover_bars["close"], 14)
        for i, want in enumerate(expected):
            if want is None:
                assert math.isnan(actual.iloc[i])
            else:
                assert actual.iloc[i] == pytest.approx(want, rel=1e-10)

    def test_hand_computed_on_a_tiny_series(self) -> None:
        # 15 closes -> exactly one RSI value, at index 14.
        # Gains at odd steps (+2), losses at even steps (-1): 7 gains, 7 losses.
        closes = [100.0]
        for i in range(14):
            closes.append(closes[-1] + (2.0 if i % 2 == 0 else -1.0))
        avg_gain = (7 * 2.0) / 14
        avg_loss = (7 * 1.0) / 14
        expected = 100.0 - 100.0 / (1.0 + avg_gain / avg_loss)  # rs = 2 -> 66.666...
        values = rsi(pd.Series(closes), 14)
        assert math.isnan(values.iloc[13])
        assert values.iloc[14] == pytest.approx(expected)
        assert values.iloc[14] == pytest.approx(200.0 / 3.0)


# ---------------------------------------------------------------------------
# MACD
# ---------------------------------------------------------------------------
class TestMacd:
    def test_ema_matches_the_independent_oracle(self, crossover_bars: pd.DataFrame) -> None:
        closes = crossover_bars["close"].tolist()
        for n in (9, 12, 26):
            expected = oracle_ema(closes, n)
            actual = ema(crossover_bars["close"], n)
            for i, want in enumerate(expected):
                if want is None:
                    assert math.isnan(actual.iloc[i])
                else:
                    assert actual.iloc[i] == pytest.approx(want, rel=1e-12)

    def test_line_is_fast_ema_minus_slow_ema(self, crossover_bars: pd.DataFrame) -> None:
        closes = crossover_bars["close"].tolist()
        fast = oracle_ema(closes, 12)
        slow = oracle_ema(closes, 26)
        frame = macd(crossover_bars["close"], 12, 26, 9)
        for i in range(len(closes)):
            if fast[i] is None or slow[i] is None:
                assert math.isnan(frame["macd"].iloc[i])
            else:
                assert frame["macd"].iloc[i] == pytest.approx(fast[i] - slow[i], rel=1e-12)

    def test_signal_is_an_ema_of_the_line_and_histogram_is_their_difference(
        self, crossover_bars: pd.DataFrame
    ) -> None:
        frame = macd(crossover_bars["close"], 12, 26, 9)
        line_tail = frame["macd"].dropna().tolist()
        expected_signal = oracle_ema(line_tail, 9)
        actual_signal = frame["signal"].dropna().tolist()
        assert len(actual_signal) == len([v for v in expected_signal if v is not None])
        for want, got in zip([v for v in expected_signal if v is not None], actual_signal):
            assert got == pytest.approx(want, rel=1e-12)

        valid = frame.dropna()
        assert (valid["histogram"] - (valid["macd"] - valid["signal"])).abs().max() < 1e-12

    def test_is_zero_on_a_flat_series(self, flat_bars: pd.DataFrame) -> None:
        frame = macd(flat_bars["close"], 12, 26, 9)
        assert frame["macd"].dropna().abs().max() == pytest.approx(0.0, abs=1e-12)

    def test_rejects_fast_slower_than_slow(self) -> None:
        with pytest.raises(ValueError):
            macd(pd.Series([1.0] * 40), fast=26, slow=12)


# ---------------------------------------------------------------------------
# Bollinger Bands
# ---------------------------------------------------------------------------
class TestBollinger:
    def test_hand_computed_on_a_linear_ramp(self, ramp_bars: pd.DataFrame) -> None:
        # Window 0..19 of p[i] = i: mid = 9.5; population variance = 33.25.
        expected_std = math.sqrt(33.25)
        frame = bollinger(ramp_bars["close"], 20, 2.0)
        assert frame["mid"].iloc[19] == pytest.approx(9.5)
        assert frame["upper"].iloc[19] == pytest.approx(9.5 + 2 * expected_std)
        assert frame["lower"].iloc[19] == pytest.approx(9.5 - 2 * expected_std)
        assert frame["upper"].iloc[19] == pytest.approx(21.0325623198)

    def test_collapses_to_the_mean_on_a_flat_series(self, flat_bars: pd.DataFrame) -> None:
        frame = bollinger(flat_bars["close"], 20, 2.0)
        assert frame["upper"].iloc[19] == pytest.approx(100.0)
        assert frame["lower"].iloc[19] == pytest.approx(100.0)
        assert frame["mid"].iloc[19] == pytest.approx(100.0)

    def test_uses_population_stdev_not_sample(self, ramp_bars: pd.DataFrame) -> None:
        frame = bollinger(ramp_bars["close"], 20, 2.0)
        width = frame["upper"].iloc[19] - frame["mid"].iloc[19]
        sample_std_width = 2 * ramp_bars["close"].iloc[0:20].std(ddof=1)
        assert width == pytest.approx(2 * math.sqrt(33.25))
        assert width != pytest.approx(sample_std_width)


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------
def test_repeated_computation_is_bit_identical(crossover_bars: pd.DataFrame) -> None:
    first = [s.to_contract() for s in compute_indicator_snapshots(crossover_bars)]
    second = [s.to_contract() for s in compute_indicator_snapshots(crossover_bars)]
    assert first == second
