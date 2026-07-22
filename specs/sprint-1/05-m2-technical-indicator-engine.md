# 05 — Technical Indicator Engine + Quant Service Scaffold (M2, L1)

> The Python quant service: deterministic computation of RSI, MACD, Bollinger Bands, and moving
> averages from `price_bars`, written to `indicator_snapshots` with `as_of` preserved — **plus** the
> empty-but-real backtesting harness scaffold so it is never a Sprint 3 scramble.
> PRD user stories: #8, #11, #35, #38.

## 1. Context & Goal

L1 is deterministic ground truth: no LLM ever touches it, and everything above (the technical agent, the
eventual evaluation suite) trusts its numbers. This spec stands up `apps/quant` (FastAPI + pandas +
pandas-ta + vectorbt), computes the four indicator families point-in-time-correctly, and lays down the
backtest-harness skeleton the guide flags as the single deliverable most likely to be silently dropped.

This folds two PRD Sprint-1 rows — "Technical Indicator Engine" and "Backtesting Harness Skeleton" —
into one spec because they share the same owner (M2) and the same new service scaffold.

"Done" means: the quant service runs in Docker, exposes an indicator endpoint that fills
`indicator_snapshots`, its numbers match hand-computed values on a synthetic series, and an importable
(empty-but-wired) backtest harness + a placeholder point-in-time integrity test exist.

## 2. Scope

**In scope**
- `apps/quant` FastAPI scaffold: healthcheck, config, Postgres access (read `price_bars`, write
  `indicator_snapshots`), Dockerfile, `pytest` setup.
- Indicator computation via `pandas-ta`: RSI(14), MACD(12,26,9), Bollinger(20,2), SMA(20)/SMA(50)
  (extendable). Output the jsonb shape spec 01/02 expect.
- `POST /indicators/compute { symbol, timeframe, from, to }` → computes and upserts snapshots; returns
  what was written.
- **Point-in-time computation:** each snapshot at time `ts` uses only bars with `as_of <= ` that
  snapshot's `as_of`. Preserve/propagate `as_of` onto every snapshot.
- **Backtest harness skeleton:** a `quant/backtest/` module with a `run_backtest(strategy, bars, ...)`
  interface (vectorbt-backed) that *works on a trivial strategy* but is otherwise empty — the seam
  Sprint 3's evaluation suite fills. Include one synthetic-series smoke test.
- A **placeholder point-in-time integrity test** (`test_point_in_time.py`) that Sprint 3 hardens —
  present now so the discipline is visible from day one.

**Non-goals**
- Full evaluation/ablation suite, baselines, tearsheets — Sprint 3.
- Any LLM/agent logic. This service is pure math.
- The Node side calling this endpoint in the live pipeline — spec 07 wires the agent; here you just
  expose and test the endpoint.

## 3. Dependencies

- Spec **01** (`price_bars` to read, `indicator_snapshots` to write; `DATABASE_URL`).
- Spec **04** to have real bars to compute on (can develop against a small seeded fixture in parallel).

## 4. Interface & Contracts

```
GET  /health                         -> 200 { status: "ok" }
POST /indicators/compute
     { symbol, timeframe, from, to } -> 200 { snapshots: IndicatorSnapshot[] }   (also upserted to DB)
```
- `IndicatorSnapshot` JSON matches spec 02 (`rsi, macd, macdSignal, bbUpper, bbLower, sma20, sma50,
  asOf, ts, symbol, timeframe`). Nulls allowed during warm-up periods (e.g. RSI first 14 bars).
- `run_backtest(strategy: Strategy, bars: DataFrame, cash: float) -> BacktestResult` — importable
  Python signature (skeleton).

## 5. Implementation notes

- **Determinism:** given the same bars, the same numbers, always. Pin `pandas`/`pandas-ta`/`vectorbt`
  versions. No randomness, no wall-clock reads in the math.
- **Warm-up nulls:** emit `null` for an indicator until it has enough history rather than a wrong value.
- **`as_of` propagation:** a snapshot's `as_of` is the `as_of` of the latest bar it consumed. Filter
  input bars by `as_of <= decision boundary` when the caller supplies one; never let a future bar leak
  into an earlier snapshot.
- The backtest skeleton must **actually run** on a toy SMA-crossover strategy over a synthetic series —
  an empty stub that can't execute is worse than a thin one that can. Keep it minimal.

## 6. Acceptance criteria

- [ ] `apps/quant` builds and runs in Docker; `GET /health` returns ok.
- [ ] `POST /indicators/compute` fills `indicator_snapshots` for a symbol/window with correct jsonb.
- [ ] RSI/MACD/Bollinger/SMA values match hand-computed expected values on a synthetic series (below).
- [ ] Warm-up periods emit `null`, not fabricated numbers.
- [ ] Each snapshot's `as_of` equals the `as_of` of the latest bar consumed; no future leakage.
- [ ] `run_backtest` executes a toy SMA-crossover on a synthetic series and returns a result object.
- [ ] `test_point_in_time.py` exists (placeholder assertion) and runs in CI.

## 7. Tests (Pytest)

- **Hand-computed indicator test (required by PRD Testing Decisions):** a synthetic price series with a
  known SMA-crossover point and known RSI/MACD values → assert computed output matches within tolerance,
  and the crossover fires on the expected bar. This is the bug tripwire the guide insists on.
- Null-warmup test: first N snapshots have `null` for the indicator that needs N bars.
- `as_of` propagation test: given bars with mixed `as_of`, a snapshot never carries an `as_of` later
  than any bar it should not have seen.
- Backtest smoke test: toy strategy on synthetic series returns a sane, deterministic result.

## 8. Files & Definition of Done

- `apps/quant/`: `main.py`, `indicators/`, `backtest/`, `db.py`, `tests/`, `Dockerfile`,
  `pyproject.toml`/`requirements.txt`.
- **DoD:** service runs in compose, indicator numbers verified against hand-computed values, `as_of`
  preserved, backtest skeleton executes a toy strategy, PIT placeholder test present, all Pytest green.
  Merged to a feature branch off `main`.
