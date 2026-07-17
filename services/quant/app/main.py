"""
QuantAgent Quant Service — FastAPI application.

Stateless service that receives bar series over HTTP and returns computed
indicator values. The Node backend owns the database; this service is
purely computational.
"""

import logging
import json
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.indicators import (
    IndicatorsRequest,
    IndicatorsResponse,
    compute_indicators,
)

# ─── Structured JSON logging ────────────────────────────────────────────────
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "module": record.module,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger("quant")

# ─── FastAPI app ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="QuantAgent Quant Service",
    version="0.1.0",
    description="Indicator computation and backtesting harness",
)


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    service: str


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
        service="quant",
    )


# ─── POST /indicators ───────────────────────────────────────────────────────

@app.post("/indicators", response_model=IndicatorsResponse)
async def indicators_endpoint(request: IndicatorsRequest) -> IndicatorsResponse:
    """
    Compute technical indicators for a bar series.

    Receives OHLCV bars and returns RSI, MACD, Bollinger Bands, SMA, EMA
    for each bar (null where lookback period is not yet satisfied).
    """
    if len(request.bars) == 0:
        raise HTTPException(status_code=400, detail="No bars provided")

    results = compute_indicators(request.bars)
    return IndicatorsResponse(indicators=results)


# ─── POST /backtest (stub) ───────────────────────────────────────────────────

class BacktestStubResponse(BaseModel):
    status: str
    message: str


@app.post("/backtest", response_model=BacktestStubResponse)
async def backtest_stub() -> BacktestStubResponse:
    """
    Backtesting endpoint — stub for Sprint 1.
    The harness skeleton exists in app/backtest/harness.py but is not
    wired to real strategies yet.
    """
    return BacktestStubResponse(
        status="not_implemented",
        message="Backtest harness is scaffolded but not wired to strategies in Sprint 1.",
    )
