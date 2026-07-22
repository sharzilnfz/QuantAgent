"""Pydantic request/response models for the quant service.

These mirror `packages/contracts` (`IndicatorSnapshot`) exactly — camelCase field
names, ISO-8601 timestamps, nullable indicator values. The TS side validates
whatever we return against the Zod schema, so any drift here is a contract
break, not a local detail.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Timeframe = Literal["1Day", "1Hour"]


class ComputeRequest(BaseModel):
    """POST /indicators/compute body: { symbol, timeframe, from, to, asOfMax? }.

    `from` is a Python keyword, so the wire names are supplied as aliases.

    NOTE: FastAPI builds a `TypeAdapter` over this annotation to parse the
    request body, and pydantic >= 2.13 emits an `UnsupportedFieldAttributeWarning`
    for aliases seen in that position. It is a FALSE POSITIVE — the aliases are
    attached to the model fields and do work (see `tests/test_api.py`, which
    posts `from`/`to`/`asOfMax`). The warning is filtered in pyproject.toml.
    """

    model_config = ConfigDict(populate_by_name=True)

    symbol: Annotated[str, Field(min_length=1)]
    timeframe: Timeframe = "1Day"
    start: datetime = Field(alias="from")
    end: datetime = Field(alias="to")
    # Optional point-in-time boundary. When set, bars with as_of > this are not
    # merely excluded from the output — they never enter the computation.
    as_of_max: Optional[datetime] = Field(default=None, alias="asOfMax")


class IndicatorSnapshotOut(BaseModel):
    symbol: str
    timeframe: Timeframe
    ts: str
    rsi: float | None = None
    macd: float | None = None
    macdSignal: float | None = None
    bbUpper: float | None = None
    bbLower: float | None = None
    sma20: float | None = None
    sma50: float | None = None
    asOf: str


class ComputeResponse(BaseModel):
    symbol: str
    timeframe: Timeframe
    barsConsumed: int
    upserted: int
    persisted: bool
    snapshots: list[IndicatorSnapshotOut]


class HealthResponse(BaseModel):
    status: str
    service: str
    databaseConfigured: bool
