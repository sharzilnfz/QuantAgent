# 04 — Market Data Ingestion Service (M2, L0)

> Pull daily/hourly price bars from Alpaca into `price_bars`, stamping every row with the **`as_of`
> timestamp** that marks when it became knowable. This is the mechanism that prevents look-ahead bias
> for the entire project.
> PRD user stories: #7, #11, #12.

## 1. Context & Goal

Everything above L0 treats stored data as ground truth, so the ingestion layer's one job it cannot get
wrong is **point-in-time correctness**: a bar for 2024-03-05 must carry an `as_of` no earlier than the
moment that bar was actually complete/available, so no backtest can ever "peek." The indicator engine
(05) and technical agent (07) build directly on these rows.

"Done" means: an idempotent ingestion command fills `price_bars` for the watchlist symbols over a date
range, with correct `as_of` semantics, safe re-runs, and basic rate-limit/caching behavior.

## 2. Scope

**In scope**
- An ingestion module (in `apps/api`, TS) that fetches bars from Alpaca's market-data API for given
  symbols, timeframe (`1Day`, `1Hour`), and date range, and upserts into `price_bars`.
- Correct `as_of` assignment (see notes) and `source="alpaca"`.
- Idempotent upsert on (`symbol`,`timeframe`,`ts`) — re-running never duplicates or corrupts.
- A CLI/script entrypoint (`ingest:prices --symbols AAPL,MSFT --from … --to … --timeframe 1Day`) and a
  thin internal route `POST /ingest/prices` (auth-guarded, for manual/cron trigger).
- Basic retry + respect for Alpaca rate limits; on-disk or DB cache to avoid re-hitting for the same window.

**Non-goals**
- News/headline ingestion — Sprint 2.
- Fundamentals/company profiles — Sprint 2.
- Indicator computation — spec 05 (this layer stores raw bars only, no derived math).
- A live streaming feed — batch/backfill is enough for Sprint 1.

## 3. Dependencies

- Spec **01** (`price_bars` table + `as_of` index).
- Alpaca paper account API keys (data endpoint). For Sprint 1 a shared/dev key via env
  (`ALPACA_KEY`,`ALPACA_SECRET`,`ALPACA_DATA_URL`) is fine — per-user keys (spec 03) are for execution,
  not data.

## 4. Interface & Contracts

- Writes rows conforming to spec 01 `price_bars` / spec 02 `PriceBar` (field-aligned).
- Entrypoints:
  ```
  ingest:prices --symbols <csv> --from <ISO> --to <ISO> --timeframe <1Day|1Hour>
  POST /ingest/prices  { symbols: string[], from, to, timeframe }  -> 200 { inserted, skipped }  [auth]
  ```
- A reusable `fetchBars(symbol, timeframe, from, to): Promise<PriceBar[]>` returning normalized,
  `as_of`-stamped bars — the seam spec 05 and tests use.

## 5. Implementation notes

- **`as_of` rule (the crux):** for a completed `1Day` bar, `as_of` = the session close / when Alpaca
  considers the bar final (not the bar's `ts`, which is the open). For `1Hour`, `as_of` = end of that
  hour. Never set `as_of` in the future. Document the exact rule in code comments — a reviewer must be
  able to verify it. When in doubt, set `as_of` *later* (more conservative) rather than earlier; an
  early `as_of` is a look-ahead bug, a late one merely delays availability.
- Upsert via `onConflictDoUpdate` on the unique key; treat re-ingest as safe.
- Normalize Alpaca's response (adjust field names, ensure `numeric`-safe values, UTC timestamps).
- Cache raw API responses per (symbol,timeframe,window) so dev re-runs don't burn rate limit; the guide
  flags Alpaca rate limits as a real Sprint-1 risk.
- Backpressure: chunk long date ranges; exponential backoff on 429.

## 6. Acceptance criteria

- [ ] `ingest:prices` fills `price_bars` for the seeded watchlist over a chosen window.
- [ ] Every inserted row has a non-null `as_of` obeying the documented rule; **no `as_of` is in the future**.
- [ ] Re-running the same command is idempotent (0 duplicates, `skipped` reported).
- [ ] `fetchBars()` returns normalized `PriceBar[]` and is unit-testable against a recorded fixture.
- [ ] 429/5xx from Alpaca triggers backoff, not a crash; partial failure reports what was ingested.
- [ ] `POST /ingest/prices` requires auth (reuses spec 03 `requireAuth`).

## 7. Tests

- Fixture-based unit test of `fetchBars` normalization: a recorded Alpaca payload → expected `PriceBar[]`
  with correct `as_of`.
- **Point-in-time unit test:** assert no returned bar has `as_of` earlier than its own session close and
  none is in the future.
- Idempotency test: ingest a fixed fixture twice → row count unchanged, values identical.
- Rate-limit test: mocked 429 then 200 → backoff path succeeds without duplicating.

## 8. Files & Definition of Done

- `apps/api/src/ingest/prices.ts`, `.../alpaca-client.ts`, CLI wiring, route, `tests/` with fixtures.
- **DoD:** watchlist backfilled with correct `as_of`, idempotent, tests green (incl. the PIT test),
  no future timestamps, rate-limit-safe. Merged to a feature branch off `main`.
