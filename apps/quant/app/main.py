"""OWNER: M2 (spec 05) — The Committee quant service.

L1 deterministic ground truth: RSI / MACD / Bollinger / SMA computed from
`price_bars` and written to `indicator_snapshots`, with `as_of` preserved end to
end. No LLM ever touches this service — it is pure maths (cross-cutting law 2:
anything computable is computed, never narrated).

Routes:
    GET  /health                  -> { status, service, databaseConfigured }
    POST /indicators/compute      -> { snapshots: IndicatorSnapshot[], ... }

The repositories are FastAPI dependencies so tests can drive the endpoint with
in-memory doubles and no Postgres.
"""

from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException

from .config import get_settings
from .db import (
    DatabaseUnavailable,
    IndicatorSnapshotRepository,
    PriceBarRepository,
    database_configured,
)
from .indicators import compute_indicator_snapshots, snapshots_to_contract, snapshots_to_rows
from .models import ComputeRequest, ComputeResponse, HealthResponse, IndicatorSnapshotOut

app = FastAPI(title="Committee Quant Service", version="0.1.0")


def get_bar_repository() -> PriceBarRepository:
    return PriceBarRepository()


def get_snapshot_repository() -> IndicatorSnapshotRepository:
    return IndicatorSnapshotRepository()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=get_settings().service_name,
        databaseConfigured=database_configured(),
    )


@app.post("/indicators/compute", response_model=ComputeResponse)
def compute_indicators(
    request: ComputeRequest,
    bar_repo: PriceBarRepository = Depends(get_bar_repository),
    snapshot_repo: IndicatorSnapshotRepository = Depends(get_snapshot_repository),
) -> ComputeResponse:
    if request.start > request.end:
        raise HTTPException(status_code=400, detail="'from' must be <= 'to'")

    try:
        bars = bar_repo.fetch(
            request.symbol,
            request.timeframe,
            request.start,
            request.end,
            as_of_max=request.as_of_max,
        )
    except DatabaseUnavailable as exc:
        raise HTTPException(status_code=503, detail=f"database unavailable: {exc}") from exc
    except Exception as exc:  # pragma: no cover - transport failures
        raise HTTPException(status_code=503, detail=f"price_bars read failed: {exc}") from exc

    snapshots = compute_indicator_snapshots(
        bars,
        symbol=request.symbol,
        timeframe=request.timeframe,
        as_of_max=request.as_of_max,
    )

    # Computation succeeds even when persistence cannot: the caller still gets
    # correct numbers and an explicit `persisted: false` rather than a 500.
    upserted = 0
    persisted = False
    if snapshots:
        try:
            upserted = snapshot_repo.upsert(snapshots_to_rows(snapshots))
            persisted = True
        except DatabaseUnavailable:
            persisted = False
        except Exception:  # pragma: no cover - transport failures
            persisted = False

    return ComputeResponse(
        symbol=request.symbol,
        timeframe=request.timeframe,
        barsConsumed=len(bars),
        upserted=upserted,
        persisted=persisted,
        snapshots=[IndicatorSnapshotOut(**snap) for snap in snapshots_to_contract(snapshots)],
    )
