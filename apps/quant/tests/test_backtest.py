"""Backtest harness smoke tests (spec 05 §7).

The harness is deliberately thin, but it RUNS: a toy SMA crossover over a
synthetic series produces a deterministic, sane result object. Sprint 3 fills in
costs, sizing and multi-asset support behind the same `run_backtest` signature.
"""

from __future__ import annotations

import pandas as pd
import pytest

from app.backtest import BacktestResult, BuyAndHold, SmaCrossover, Strategy, run_backtest

from .conftest import CROSSOVER_BAR, make_bars


def test_run_backtest_executes_a_toy_sma_crossover(crossover_bars: pd.DataFrame) -> None:
    result = run_backtest(SmaCrossover(20, 50), crossover_bars, cash=100_000.0)

    assert isinstance(result, BacktestResult)
    assert result.strategy == "sma_crossover"
    assert result.n_bars == len(crossover_bars)
    assert result.initial_cash == 100_000.0
    assert result.final_equity > 0
    assert len(result.equity_curve) == len(crossover_bars)
    assert result.n_trades >= 1


def test_the_toy_strategy_makes_money_on_a_series_built_for_it(
    crossover_bars: pd.DataFrame,
) -> None:
    """Series falls then rises; a trend follower should end up ahead of its start."""
    result = run_backtest(SmaCrossover(20, 50), crossover_bars, cash=100_000.0)
    assert result.total_return > 0
    assert result.final_equity > result.initial_cash


def test_entry_happens_one_bar_after_the_signal_no_look_ahead(
    crossover_bars: pd.DataFrame,
) -> None:
    """THE anti-look-ahead assertion: the crossover bar itself is still flat."""
    result = run_backtest(SmaCrossover(20, 50), crossover_bars)

    assert result.positions.iloc[CROSSOVER_BAR] == 0.0  # signal fires here...
    assert result.positions.iloc[CROSSOVER_BAR + 1] == 1.0  # ...traded here

    first_trade = result.trades[0]
    assert first_trade.from_position == 0.0
    assert first_trade.to_position == 1.0
    assert result.equity_curve.iloc[CROSSOVER_BAR] == pytest.approx(result.initial_cash)


def test_results_are_deterministic(crossover_bars: pd.DataFrame) -> None:
    a = run_backtest(SmaCrossover(), crossover_bars)
    b = run_backtest(SmaCrossover(), crossover_bars)
    assert a.summary() == b.summary()
    assert a.equity_curve.equals(b.equity_curve)


def test_buy_and_hold_baseline_tracks_the_underlying() -> None:
    closes = [100.0 * (1.01**i) for i in range(50)]
    bars = make_bars(closes)
    result = run_backtest(BuyAndHold(), bars, cash=1_000.0)

    # Entered on bar 1, so it captures the return from bar 1 to the end.
    expected = closes[-1] / closes[0]
    assert result.final_equity == pytest.approx(1_000.0 * expected, rel=1e-9)
    assert result.n_trades == 1


def test_a_flat_series_produces_no_pnl_and_no_trades(flat_bars: pd.DataFrame) -> None:
    result = run_backtest(SmaCrossover(20, 50), flat_bars, cash=50_000.0)
    assert result.final_equity == pytest.approx(50_000.0)
    assert result.total_return == pytest.approx(0.0)
    assert result.n_trades == 0
    assert result.max_drawdown == pytest.approx(0.0)


def test_max_drawdown_is_negative_when_the_strategy_loses(falling_bars: pd.DataFrame) -> None:
    result = run_backtest(BuyAndHold(), falling_bars, cash=10_000.0)
    assert result.total_return < 0
    assert result.max_drawdown < 0


def test_empty_bars_return_the_starting_cash() -> None:
    result = run_backtest(SmaCrossover(), make_bars([]), cash=1_234.0)
    assert result.n_bars == 0
    assert result.final_equity == 1_234.0
    assert result.total_return == 0.0


def test_invalid_inputs_are_rejected(crossover_bars: pd.DataFrame) -> None:
    with pytest.raises(ValueError):
        run_backtest(SmaCrossover(), crossover_bars.drop(columns=["close"]))
    with pytest.raises(ValueError):
        run_backtest(SmaCrossover(), crossover_bars, cash=0.0)


def test_strategies_satisfy_the_protocol() -> None:
    assert isinstance(SmaCrossover(), Strategy)
    assert isinstance(BuyAndHold(), Strategy)


def test_result_summary_is_json_friendly(crossover_bars: pd.DataFrame) -> None:
    import json

    summary = run_backtest(SmaCrossover(), crossover_bars).summary()
    assert json.loads(json.dumps(summary))["strategy"] == "sma_crossover"
