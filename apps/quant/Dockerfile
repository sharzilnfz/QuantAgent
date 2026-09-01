# ==============================================================================
# Stage 1: Builder stage with uv for fast, cached dependency resolution
# ==============================================================================
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Install dependencies in a separate layer cached via BuildKit cache mount
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Copy application source code and perform project sync into virtual environment
COPY app ./app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ==============================================================================
# Stage 2: Minimal runtime image with non-root execution
# ==============================================================================
FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

# Create a dedicated non-root user and group
RUN groupadd --system --gid 10001 appuser && \
    useradd --system --uid 10001 --gid appuser --create-home --home-dir /app appuser

# Copy virtual environment and application code from builder stage
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appuser /app/app /app/app
COPY --from=builder --chown=appuser:appuser /app/pyproject.toml /app/pyproject.toml

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=5s --timeout=5s --start-period=5s --retries=5 \
    CMD python -c 'import urllib.request, sys; sys.exit(0 if urllib.request.urlopen("http://localhost:8000/health").getcode() == 200 else 1)'

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
