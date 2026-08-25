# 01 — Temporal Guard, Anti-Leakage CI Gate & Frozen Data Fixtures

**What to build:** An immutable, point-in-time data access layer and automated anti-leakage test suite. Ensures any data query for decision timestamp $T$ only observes records with timestamp $\le T$. Freezes zero-credential historical datasets (AAPL, NVDA, SPY for 2023–2024) directly in the repo, provides a dataset seeding CLI (`pnpm seed:data`), and fails CI if future data is ever accessed.

**Blocked by:** None — can start immediately

**Status:** done

- [x] `TemporalGuard` utility intercepts all dataset queries and strictly enforces $\forall r, \text{timestamp}(r) \le T_{\text{decision}}$.
- [x] Querying with a decision timestamp $T$ against a dataset containing $T+1$ records throws an explicit `TemporalIntegrityViolation` error.
- [x] Dedicated anti-leakage test suite runs in CI and verifies that deliberate look-ahead injections cause test failure.
- [x] Pre-packaged, zero-credential JSON fixtures for AAPL, NVDA, and SPY (2023–2024 daily bars and timestamped news) are checked into `packages/fixtures/`.
- [x] Seeding CLI (`pnpm seed:data --ticker <TICKER> --year <YEAR>`) fetches public historical bars and news archive, stamping each record with an immutable `as_of` date and saving frozen fixtures.
- [x] All data ingestion and fixture loading code operates without requiring external API keys.

