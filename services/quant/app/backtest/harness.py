"""
Backtest harness skeleton — Sprint 1.

Provides:
  - A walk-forward runner interface (not wired to real strategies yet)
  - A point-in-time (PIT) guard that ensures a signal at time t can only
    see bars with as_of <= t

This exists so the harness isn't dropped in later sprints and to prove
point-in-time discipline is enforced from day one.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import pandas as pd

logger = logging.getLogger("quant")


# ─── Data structures ────────────────────────────────────────────────────────

@dataclass
class BacktestBar:
    """A single OHLCV bar with point-in-time metadata."""
    bar_time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    as_of: datetime  # when this bar became available to the system


@dataclass
class Signal:
    """A trading signal produced at a specific decision time."""
    decision_time: datetime
    symbol: str
    bias: str  # "bullish" | "bearish" | "neutral"
    confidence: float
    features: dict = field(default_factory=dict)


# ─── Point-in-time guard ────────────────────────────────────────────────────

class PointInTimeViolation(Exception):
    """Raised when a signal attempts to use future data."""
    pass


def pit_filter(bars: list[BacktestBar], decision_time: datetime) -> list[BacktestBar]:
    """
    Return only bars whose as_of <= decision_time.

    This is the ONLY sanctioned way to access bars during backtesting.
    Any code path that bypasses this guard is a point-in-time violation.
    """
    return [b for b in bars if b.as_of <= decision_time]


def assert_pit_compliance(
    bars: list[BacktestBar],
    signal: Signal,
) -> None:
    """
    Assert that all bars used by a signal have as_of <= signal.decision_time.

    Raises PointInTimeViolation if any bar's as_of is after the decision time.
    """
    for bar in bars:
        if bar.as_of > signal.decision_time:
            raise PointInTimeViolation(
                f"PIT violation: bar at {bar.bar_time} has as_of={bar.as_of} "
                f"which is after decision_time={signal.decision_time}"
            )


# ─── Walk-forward runner interface ──────────────────────────────────────────

class SignalGenerator:
    """
    Abstract signal generator interface.
    Subclass this to implement a strategy for backtesting.
    """

    def generate(
        self, bars: list[BacktestBar], decision_time: datetime
    ) -> Optional[Signal]:
        """
        Generate a signal given bars available at decision_time.
        Must use pit_filter() to respect point-in-time.
        """
        raise NotImplementedError


class WalkForwardRunner:
    """
    Walk-forward backtesting runner skeleton.

    Steps through time, calling the signal generator at each step
    with only the data that was available at that point in time.
    """

    def __init__(self, generator: SignalGenerator):
        self.generator = generator
        self.signals: list[Signal] = []

    def run(
        self,
        bars: list[BacktestBar],
        decision_times: list[datetime],
    ) -> list[Signal]:
        """
        Run the walk-forward backtest.

        For each decision_time, filters bars to those with as_of <= decision_time,
        calls the signal generator, and collects results.
        """
        self.signals = []

        for dt in sorted(decision_times):
            available_bars = pit_filter(bars, dt)

            signal = self.generator.generate(available_bars, dt)
            if signal is not None:
                # Enforce PIT compliance on the generated signal
                assert_pit_compliance(available_bars, signal)
                self.signals.append(signal)

        logger.info(
            "Walk-forward complete: %d decision points, %d signals generated",
            len(decision_times),
            len(self.signals),
        )

        return self.signals


# ─── Example: SMA crossover signal generator (for testing) ──────────────────

class SmaCrossoverGenerator(SignalGenerator):
    """
    Simple SMA crossover strategy for testing the harness.
    Bullish when close > SMA, bearish otherwise.
    """

    def __init__(self, sma_period: int = 5):
        self.sma_period = sma_period

    def generate(
        self, bars: list[BacktestBar], decision_time: datetime
    ) -> Optional[Signal]:
        available = pit_filter(bars, decision_time)

        if len(available) < self.sma_period:
            return None

        closes = [b.close for b in available[-self.sma_period:]]
        sma = sum(closes) / len(closes)
        latest_close = available[-1].close

        bias = "bullish" if latest_close > sma else "bearish"
        confidence = min(abs(latest_close - sma) / sma, 1.0)

        return Signal(
            decision_time=decision_time,
            symbol="TEST",
            bias=bias,
            confidence=round(confidence, 4),
            features={"close": latest_close, "sma": round(sma, 4)},
        )
