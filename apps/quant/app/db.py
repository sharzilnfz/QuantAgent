"""Postgres access for the quant service.

CONTRACT: this module must be IMPORTABLE WITHOUT A LIVE DATABASE. No connection
is opened at import time; `psycopg` itself is imported defensively. Every
DB-dependent test guards on `database_available()` and skips otherwise, so the
indicator maths stays testable on a laptop with no Docker running.

Reads `price_bars`, writes `indicator_snapshots` (spec 01). Column names and the
`indicators` jsonb shape are kept isomorphic with the Drizzle schema and the
`IndicatorSnapshot` Zod contract.
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterable, Iterator, Sequence

import pandas as pd

from .config import get_settings

try:  # pragma: no cover - import guard
    import psycopg
    from psycopg.types.json import Jsonb

    PSYCOPG_AVAILABLE = True
except Exception:  # pragma: no cover - defensive
    psycopg = None  # type: ignore[assignment]
    Jsonb = None  # type: ignore[assignment]
    PSYCOPG_AVAILABLE = False


BAR_COLUMNS = ("symbol", "timeframe", "ts", "open", "high", "low", "close", "volume", "as_of")


class DatabaseUnavailable(RuntimeError):
    """Raised when a DB-backed operation is attempted with no reachable Postgres."""


def database_configured() -> bool:
    return PSYCOPG_AVAILABLE and bool(get_settings().database_url)


def database_available() -> bool:
    """True only if we can actually open a connection. Used by test skip guards."""
    if not database_configured():
        return False
    try:
        with connection() as conn:
            conn.execute("select 1")
        return True
    except Exception:
        return False


@contextmanager
def connection() -> Iterator[Any]:
    settings = get_settings()
    if not PSYCOPG_AVAILABLE:
        raise DatabaseUnavailable("psycopg is not installed")
    if not settings.database_url:
        raise DatabaseUnavailable("DATABASE_URL is not set")
    conn = psycopg.connect(  # type: ignore[union-attr]
        settings.database_url,
        connect_timeout=settings.connect_timeout_seconds,
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def empty_bars_frame() -> pd.DataFrame:
    """A correctly-typed, zero-row bars frame — the shape everything downstream expects."""
    frame = pd.DataFrame({col: pd.Series(dtype="object") for col in BAR_COLUMNS})
    for col in ("open", "high", "low", "close", "volume"):
        frame[col] = frame[col].astype("float64")
    frame["ts"] = pd.to_datetime(frame["ts"], utc=True, errors="coerce")
    frame["as_of"] = pd.to_datetime(frame["as_of"], utc=True, errors="coerce")
    return frame


def rows_to_bars_frame(rows: Iterable[Sequence[Any]]) -> pd.DataFrame:
    frame = pd.DataFrame(list(rows), columns=list(BAR_COLUMNS))
    if frame.empty:
        return empty_bars_frame()
    frame["ts"] = pd.to_datetime(frame["ts"], utc=True)
    frame["as_of"] = pd.to_datetime(frame["as_of"], utc=True)
    for col in ("open", "high", "low", "close", "volume"):
        frame[col] = frame[col].astype("float64")
    return frame.sort_values("ts", kind="stable").reset_index(drop=True)


class PriceBarRepository:
    """Read seam for `price_bars`. Swappable in tests via FastAPI dependency override."""

    def fetch(
        self,
        symbol: str,
        timeframe: str,
        start: datetime,
        end: datetime,
        as_of_max: datetime | None = None,
    ) -> pd.DataFrame:
        """Bars for [start, end], optionally filtered to what was knowable by `as_of_max`.

        POINT-IN-TIME: when the caller supplies a decision boundary we filter on
        `as_of <= boundary` in SQL, not in pandas — the boundary must never be
        something a later refactor can accidentally drop.
        """
        sql = """
            select symbol, timeframe, ts, open, high, low, close, volume, as_of
            from price_bars
            where symbol = %s and timeframe = %s and ts >= %s and ts <= %s
        """
        params: list[Any] = [symbol, timeframe, start, end]
        if as_of_max is not None:
            sql += " and as_of <= %s"
            params.append(as_of_max)
        sql += " order by ts asc"

        with connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        return rows_to_bars_frame(rows)


class IndicatorSnapshotRepository:
    """Write seam for `indicator_snapshots`. Idempotent on (symbol, timeframe, ts)."""

    def upsert(self, snapshots: Sequence[dict[str, Any]]) -> int:
        if not snapshots:
            return 0
        sql = """
            insert into indicator_snapshots (symbol, timeframe, ts, indicators, as_of)
            values (%s, %s, %s, %s, %s)
            on conflict (symbol, timeframe, ts)
            do update set indicators = excluded.indicators, as_of = excluded.as_of
        """
        with connection() as conn:
            with conn.cursor() as cur:
                for snap in snapshots:
                    cur.execute(
                        sql,
                        (
                            snap["symbol"],
                            snap["timeframe"],
                            snap["ts"],
                            _jsonb(snap["indicators"]),
                            snap["asOf"],
                        ),
                    )
        return len(snapshots)


def _jsonb(value: dict[str, Any]) -> Any:
    if Jsonb is not None:  # pragma: no branch
        return Jsonb(value)
    return json.dumps(value)  # pragma: no cover


class InMemoryPriceBarRepository(PriceBarRepository):
    """Test/dev double: serves a preloaded frame, applying the same PIT filter."""

    def __init__(self, frame: pd.DataFrame) -> None:
        self._frame = frame.copy()

    def fetch(
        self,
        symbol: str,
        timeframe: str,
        start: datetime,
        end: datetime,
        as_of_max: datetime | None = None,
    ) -> pd.DataFrame:
        frame = self._frame
        if frame.empty:
            return empty_bars_frame()
        mask = (
            (frame["symbol"] == symbol)
            & (frame["timeframe"] == timeframe)
            & (frame["ts"] >= pd.Timestamp(start))
            & (frame["ts"] <= pd.Timestamp(end))
        )
        if as_of_max is not None:
            mask &= frame["as_of"] <= pd.Timestamp(as_of_max)
        return frame[mask].sort_values("ts", kind="stable").reset_index(drop=True)


class InMemoryIndicatorSnapshotRepository(IndicatorSnapshotRepository):
    """Test/dev double mirroring the DB's upsert-on-conflict semantics."""

    def __init__(self) -> None:
        self.rows: dict[tuple[str, str, Any], dict[str, Any]] = {}

    def upsert(self, snapshots: Sequence[dict[str, Any]]) -> int:
        for snap in snapshots:
            self.rows[(snap["symbol"], snap["timeframe"], snap["ts"])] = dict(snap)
        return len(snapshots)
