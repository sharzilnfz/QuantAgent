"""HTTP surface tests. No Postgres required: the repositories are FastAPI
dependencies, so we override them with in-memory doubles.
"""

from __future__ import annotations

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.db import InMemoryIndicatorSnapshotRepository, InMemoryPriceBarRepository
from app.main import app, get_bar_repository, get_snapshot_repository

from .conftest import CROSSOVER_BAR, crossover_closes, make_bars


@pytest.fixture
def bars() -> pd.DataFrame:
    return make_bars(crossover_closes(), symbol="AAPL")


@pytest.fixture
def snapshot_repo() -> InMemoryIndicatorSnapshotRepository:
    return InMemoryIndicatorSnapshotRepository()


@pytest.fixture
def client(
    bars: pd.DataFrame, snapshot_repo: InMemoryIndicatorSnapshotRepository
) -> TestClient:
    app.dependency_overrides[get_bar_repository] = lambda: InMemoryPriceBarRepository(bars)
    app.dependency_overrides[get_snapshot_repository] = lambda: snapshot_repo
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "databaseConfigured" in body


def test_compute_returns_contract_shaped_snapshots(
    client: TestClient, snapshot_repo: InMemoryIndicatorSnapshotRepository
) -> None:
    response = client.post(
        "/indicators/compute",
        json={
            "symbol": "AAPL",
            "timeframe": "1Day",
            "from": "2024-01-01T00:00:00Z",
            "to": "2025-01-01T00:00:00Z",
        },
    )
    assert response.status_code == 200
    body = response.json()

    assert body["symbol"] == "AAPL"
    assert body["barsConsumed"] == 200
    assert len(body["snapshots"]) == 200
    assert body["persisted"] is True
    assert body["upserted"] == 200
    assert len(snapshot_repo.rows) == 200

    first = body["snapshots"][0]
    assert set(first) == {
        "symbol",
        "timeframe",
        "ts",
        "rsi",
        "macd",
        "macdSignal",
        "bbUpper",
        "bbLower",
        "sma20",
        "sma50",
        "asOf",
    }
    assert first["rsi"] is None  # warm-up
    assert body["snapshots"][CROSSOVER_BAR]["sma20"] == pytest.approx(114.5)


def test_compute_is_idempotent(
    client: TestClient, snapshot_repo: InMemoryIndicatorSnapshotRepository
) -> None:
    payload = {
        "symbol": "AAPL",
        "timeframe": "1Day",
        "from": "2024-01-01T00:00:00Z",
        "to": "2025-01-01T00:00:00Z",
    }
    first = client.post("/indicators/compute", json=payload).json()
    second = client.post("/indicators/compute", json=payload).json()
    assert first["snapshots"] == second["snapshots"]
    assert len(snapshot_repo.rows) == 200  # upsert on conflict, no duplicates


def test_compute_honours_the_as_of_boundary(client: TestClient, bars: pd.DataFrame) -> None:
    boundary = bars["as_of"].iloc[99].isoformat()
    response = client.post(
        "/indicators/compute",
        json={
            "symbol": "AAPL",
            "timeframe": "1Day",
            "from": "2024-01-01T00:00:00Z",
            "to": "2025-01-01T00:00:00Z",
            "asOfMax": boundary,
        },
    )
    assert response.status_code == 200
    assert len(response.json()["snapshots"]) == 100


def test_compute_rejects_an_inverted_range(client: TestClient) -> None:
    response = client.post(
        "/indicators/compute",
        json={
            "symbol": "AAPL",
            "timeframe": "1Day",
            "from": "2025-01-01T00:00:00Z",
            "to": "2024-01-01T00:00:00Z",
        },
    )
    assert response.status_code == 400


def test_compute_rejects_an_unknown_timeframe(client: TestClient) -> None:
    response = client.post(
        "/indicators/compute",
        json={
            "symbol": "AAPL",
            "timeframe": "5Min",
            "from": "2024-01-01T00:00:00Z",
            "to": "2025-01-01T00:00:00Z",
        },
    )
    assert response.status_code == 422


def test_compute_on_an_unknown_symbol_returns_nothing(client: TestClient) -> None:
    response = client.post(
        "/indicators/compute",
        json={
            "symbol": "NOPE",
            "timeframe": "1Day",
            "from": "2024-01-01T00:00:00Z",
            "to": "2025-01-01T00:00:00Z",
        },
    )
    assert response.status_code == 200
    assert response.json()["snapshots"] == []
