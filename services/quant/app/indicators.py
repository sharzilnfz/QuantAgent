"""
Indicator computation module.

Receives OHLCV bar series and computes:
  - RSI (14-period)
  - MACD (12, 26, 9)
  - Bollinger Bands (20-period, 2 std dev)
  - SMA (20-period)
  - EMA (20-period)

Uses pandas + pandas_ta for computation. Stateless — receives data in,
returns indicators out.
"""

import logging
from typing import Optional

import pandas as pd
import pandas_ta as ta
from pydantic import BaseModel

logger = logging.getLogger("quant")


# ─── Request / Response models ───────────────────────────────────────────────

class Bar(BaseModel):
    symbol: str
    timeframe: str
    barTime: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    asOf: str


class IndicatorValues(BaseModel):
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_mid: Optional[float] = None
    bb_lower: Optional[float] = None
    sma: Optional[float] = None
    ema: Optional[float] = None


class IndicatorResult(BaseModel):
    barTime: str
    values: IndicatorValues


class IndicatorsRequest(BaseModel):
    bars: list[Bar]


class IndicatorsResponse(BaseModel):
    indicators: list[IndicatorResult]


# ─── Computation ─────────────────────────────────────────────────────────────

def compute_indicators(bars: list[Bar]) -> list[IndicatorResult]:
    """
    Compute technical indicators for a series of OHLCV bars.

    Returns one IndicatorResult per bar, with null values where the
    lookback period hasn't been satisfied yet.
    """
    if len(bars) == 0:
        return []

    # Build DataFrame
    df = pd.DataFrame([b.model_dump() for b in bars])
    df = df.sort_values("barTime").reset_index(drop=True)

    # RSI (14)
    df["rsi"] = ta.rsi(df["close"], length=14)

    # MACD (12, 26, 9)
    macd_df = ta.macd(df["close"], fast=12, slow=26, signal=9)
    if macd_df is not None and not macd_df.empty:
        df["macd"] = macd_df.iloc[:, 0]  # MACD line
        df["macd_signal"] = macd_df.iloc[:, 1]  # Signal line
        df["macd_hist"] = macd_df.iloc[:, 2]  # Histogram

    # Bollinger Bands (20, 2)
    bb_df = ta.bbands(df["close"], length=20, std=2)
    if bb_df is not None and not bb_df.empty:
        df["bb_lower"] = bb_df.iloc[:, 0]
        df["bb_mid"] = bb_df.iloc[:, 1]
        df["bb_upper"] = bb_df.iloc[:, 2]

    # SMA (20)
    df["sma"] = ta.sma(df["close"], length=20)

    # EMA (20)
    df["ema"] = ta.ema(df["close"], length=20)

    # Build results
    results: list[IndicatorResult] = []
    indicator_cols = [
        "rsi", "macd", "macd_signal", "macd_hist",
        "bb_upper", "bb_mid", "bb_lower", "sma", "ema",
    ]

    for _, row in df.iterrows():
        values_dict = {}
        for col in indicator_cols:
            val = row.get(col)
            if pd.isna(val):
                values_dict[col] = None
            else:
                # Round to 6 decimal places to avoid float noise
                values_dict[col] = round(float(val), 6)

        results.append(
            IndicatorResult(
                barTime=row["barTime"],
                values=IndicatorValues(**values_dict),
            )
        )

    logger.info(
        "Computed indicators for %d bars, %d results",
        len(bars),
        len(results),
    )
    return results
