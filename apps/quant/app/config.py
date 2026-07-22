"""Environment configuration for the quant service.

Deliberately dependency-light and side-effect-free at import time: importing
this module must never require a database, a network, or a populated .env.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

try:  # python-dotenv is optional at runtime (it is present in Docker).
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - defensive
    pass


@dataclass(frozen=True)
class Settings:
    database_url: str | None
    service_name: str
    # Statement/connect timeout so a dead Postgres fails fast instead of hanging
    # a request thread.
    connect_timeout_seconds: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        database_url=os.getenv("DATABASE_URL") or None,
        service_name=os.getenv("QUANT_SERVICE_NAME", "committee-quant"),
        connect_timeout_seconds=int(os.getenv("DB_CONNECT_TIMEOUT", "5")),
    )
