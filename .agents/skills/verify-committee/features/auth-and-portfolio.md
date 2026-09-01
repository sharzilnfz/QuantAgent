# Auth and Portfolio Dashboard

The Auth and Portfolio Dashboard provides user session management, paper-trading portfolio summaries, historical equity curves, position tables, and live technical agent analysis summaries.

## Sub-features

- `auth-login` authenticates registered users via email/password and sets a secure session cookie.
- `auth-guard` redirects unauthenticated visitors to `/login` and restores destination routes after sign-in.
- `portfolio-kpis` displays account cash, total equity, and unrealized P&L KPI tiles.
- `portfolio-chart` renders total equity over time as reported by the portfolio history service.
- `portfolio-positions` lists open paper positions with quantity, entry price, current price, and unrealized P&L.
- `portfolio-agent-card` displays the latest technical analyst stance for selected watchlist symbols.

## How to get to it (user POV)

- Navigate to `http://localhost:5173/` in a browser.
- If not signed in, the app automatically lands on `http://localhost:5173/login`.
- Choose the `Portfolio` item in the primary sidebar navigation.

## Driving it with Playwright

Preconditions:
- PostgreSQL is running and seeded with demo credentials (`demo@committee.local` / `demo-committee`).
- API server is running on `http://localhost:3000`.
- Web UI is running on `http://localhost:5173`.
- `bash .agents/skills/verify-committee/scripts/doctor.sh` passes.

- **Navigate to app.** Go to `http://localhost:5173/`. Run `browser_navigate` with `url: "http://localhost:5173"`. The browser is redirected to `http://localhost:5173/login` with heading `Sign in`.
- **Enter credentials.** Fill in the login form. Run `browser_fill_form` with `target: "input[type='email']"`, `value: "demo@committee.local"` and `target: "input[type='password']"`, `value: "demo-committee"`.
- **Submit login.** Click the submit button. Run `browser_click` with `target: "button[type='submit']"`. The page navigates to `http://localhost:5173/` and displays heading `Portfolio` and user email `demo@committee.local`.
- **Verify KPI row.** Observe the `Key figures` region. Assert cash ($100,000.00) and equity ($100,000.00) tiles are rendered.
- **Verify equity chart.** Observe the `Portfolio value over time` card containing the SVG chart canvas and timeframe markers.
- **Select watchlist symbol.** Change symbol in the Agent activity card. Run `browser_snapshot`. Observe `Watchlist symbol` combobox containing `AAPL`, `MSFT`, and `SPY`.
- **Capture proof.** Save visual and DOM state. Run `browser_take_screenshot` to `artifacts/verify-committee/portfolio.png` and `browser_snapshot` to `artifacts/verify-committee/portfolio.snapshot.yml`.

## Gotchas

- Calling `POST /auth/logout` clears the session cookie; all subsequent navigation requests will bounce to `/login`.
- If the database is freshly created without running `pnpm db:seed`, login will fail with `Invalid credentials`.
- The portfolio value chart requires at least two daily snapshot records to draw a multi-point trendline.
