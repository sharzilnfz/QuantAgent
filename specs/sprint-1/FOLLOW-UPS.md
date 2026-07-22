# Sprint 1 — Implementation Follow-Ups & Known Gaps

Deviations, contract gaps, and deferred work discovered *while implementing* the Sprint 1 specs.
Recorded here rather than silently absorbed, because several are cross-team contract issues that need
an owner before Sprint 2 branches off `main`.

Legend: **[contract]** needs a schema/API change · **[deferred]** correct to defer · **[cleanup]** tidy-up.

---

## 1. `PortfolioState` has no aggregate P&L field — **[contract]** — owner: M1 (spec 02)

Spec 08 §6 requires a P&L KPI tile, but `PortfolioState` (spec 02) exposes only per-position
`unrealizedPl`. Summing those in the browser would violate **cross-cutting law #2 (facts vs. narration)**
— the UI must never compute a financial number.

**Current behavior:** the client reads an *optional* `unrealizedPl` off `GET /portfolio` and renders an
explicit "Not reported" state when it is absent. A regression test asserts the UI does **not** produce
the sum (the fixture's aggregate is deliberately ≠ the sum of its positions).

**Fix:** add `unrealizedPl: z.number()` to `PortfolioState` and compute it server-side. Naturally lands
in Sprint 3 with real Alpaca portfolio sync, since Sprint 1 has no real position data to aggregate.

---

## 2. No portfolio history source — **[contract]** — owner: M4

None of spec 08 §4's four routes can feed a value-over-time chart (PRD user story #6). The web client
calls `GET /portfolio/history → Pick<PortfolioState,"asOf"|"equity">[]`, typed off the contract so it
can't drift, and treats it as non-critical: a 404 degrades only the chart, not the page.

**Fix:** implement the route. Requires periodic equity snapshots, so it pairs with Sprint 3 execution.

---

## 3. `GET /portfolio` is a Sprint-1 placeholder — **[deferred]** — owner: M4

Returns a contract-valid but deliberately **empty** snapshot rather than fabricated cash/equity numbers.
Marked as a placeholder in `apps/api/src/portfolio/service.ts`. Real Alpaca sync is Sprint 3 (spec: Paper
Trade Execution). This is intentional — an empty portfolio is honest; invented numbers are not.

---

## 4. `keyTail` derived on read, not stored — **[contract]** — owners: M4 (spec 03) + spec 01

Spec 03 §4 says `keyTail` is "computed at store time," but spec 01's `alpaca_credentials` table has no
`key_tail` column. The two specs contradict each other. Current implementation decrypts server-side on
`GET /credentials/status` and takes the last 4 chars — same value, same 4-char exposure ceiling.

**Fix:** either add a `key_tail` column to spec 01 (then store at write time as spec 03 says), or amend
spec 03 to say "derived on read." Prefer the column: it avoids a decrypt on a status check.

---

## 5. Two GCM nonces packed into one `iv` column — **[cleanup]** — owner: M4

Spec 01 gives `alpaca_credentials` a single `iv` and single `auth_tag` for **two** independent
plaintexts (key + secret). Reusing one nonce across both under the same key is a catastrophic GCM
misuse, so the implementation generates a distinct 12-byte nonce per field and stores them
concatenated (`iv` = 24 bytes b64, `auth_tag` = 2×16 bytes b64). Each field is additionally AAD-bound to
its slot (`"alpaca:key"` / `"alpaca:secret"`), so a row with swapped ciphertext columns fails
authentication rather than silently decrypting into the wrong field.

**Fix (optional):** split into explicit `key_iv`/`secret_iv`/`key_auth_tag`/`secret_auth_tag` columns so
the schema states the intent instead of relying on a packing convention. Behavior is already correct.

---

## 6. Structured LLM output uses forced tool use — **[cleanup]** — owner: M1 (spec 07)

The pinned `@anthropic-ai/sdk@0.68.0` has no `output_config` in its types. The technical agent unwraps
`AgentOutputJsonSchema.definitions.AgentOutput` and passes it as a single tool's `input_schema` with
`tool_choice: {type:"tool"}`. Still one call, still cheap tier, still one Zod-derived source of truth.

**Fix:** switch to `output_config.format` when the SDK is bumped.

---

## 7. `pandas-ta` / `vectorbt` not used — **[deferred]** — owner: M2 (spec 05)

Both lack reliable Python 3.13 wheels and are left commented out in `requirements.txt`. Indicators are
hand-rolled with pandas/numpy, and the backtest skeleton is pandas/numpy. This is arguably *better* for
Sprint 1, since spec 05 requires matching hand-computed values and a transparent implementation is the
point.

Because the conventions are now a cross-team contract, they are pinned in `app/indicators/core.py`'s
docstring: **SMA-seeded EMA, Wilder RSI, population stdev for Bollinger**. Sprint 3's evaluation suite
should reconsider `vectorbt` (on Python 3.12) for research-grade backtesting.

---

## 8. Half-day sessions get a conservative `as_of` — **[deferred]** — owner: M2 (spec 04)

1pm-ET holiday closes are stamped `as_of = 16:00 ET`, i.e. **later** than the true close. Deliberately
conservative: a late `as_of` merely delays availability, an early one is a look-ahead bug. Flagged in
code as a Sprint-3 tightening candidate (needs a market-calendar dependency).

Related and working as intended: a bar whose computed `as_of` exceeds `now` is **dropped and reported,
not clamped** — clamping to `now` would move `as_of` earlier than truth, creating exactly the look-ahead
bias the discipline exists to prevent. Dropped bars land on the next run.

---

## 9. DB-backed tests are written but have never executed — **[deferred]** — owner: all

There is no Postgres in the current dev environment, so 26 tests skip via connectivity probes (they
check both reachability *and* that spec 01's tables exist, so a skip can't be mistaken for a pass).
These cover: duplicate-email 409, expired-session 401 + purge, bcrypt-hash-only storage, ciphertext-only
rows over HTTP, ingestion idempotency against a real DB, and agent-run persistence.

**Action:** run `docker compose up -d postgres && pnpm db:migrate` and confirm the full suite before the
Sprint 1 demo. Everything else (199 TS + 57 Python assertions) runs and passes without infrastructure.

---

## 10. Web bundle is 727 kB — **[cleanup]** — owner: M3

Recharts dominates. Code-splitting was out of scope for Sprint 1; revisit when the pipeline
visualization (React Flow, Sprint 3) adds another heavy dependency.
