# 08 — Dashboard Shell & Portfolio View (M3, UI)

> The React app shell: auth-gated layout, navigation, and a portfolio view that renders positions, cash,
> P&L, and the technical agent's latest output — the face that makes the walking skeleton visible.
> PRD user stories: #4, #6, #7, #13, #30, #3.

## 1. Context & Goal

By end of Sprint 1 the team needs something they can *look at*: log in, see portfolio state, and see a
real agent's output rendered. This spec builds the React + Vite shell (routing, auth guard, layout,
theming) and the first real screen — the portfolio/home view — wired to the backend. It contains **zero
backend logic**; it consumes spec 03's auth routes, a portfolio endpoint, and spec 02's `AgentOutput`
types.

"Done" means: unauthenticated users hit a login screen; authenticated users see a dashboard with
portfolio value, positions, cash, P&L, and a card showing the latest technical-agent output for a
watchlist symbol, using shared contract types (no hand-duplicated shapes).

## 2. Scope

**In scope**
- `apps/web` Vite + React + TS + Tailwind + `shadcn/ui` scaffold; app router with a `requireAuth`
  route guard that redirects to `/login` on 401.
- Login/register form wired to spec 03 (`/auth/*`), session-cookie based; "stay logged in across reload"
  works via `GET /auth/me` on boot.
- App layout: sidebar/nav, header with user + logout, content area. Light/dark theme.
- **Portfolio view** (`/`): portfolio value-over-time chart (Recharts), cash/equity KPI tiles, positions
  table, and an "Agent Activity" card rendering the latest `AgentOutput` (direction badge, confidence
  meter, rationale) for a selected watchlist symbol.
- A typed API client that imports `AgentOutput`/`PortfolioState`/`PriceBar` from `packages/contracts`.
- Loading/empty/error states (Sprint 1 data is sparse — design for empty gracefully).

**Non-goals**
- Debate transcripts, pipeline diagram, config panel, signal-history page — Sprint 3/4.
- Watchlist *management* UI (add/remove) — Sprint 2 (read the seeded list only for now).
- Any data computation client-side. Numbers come from the API already computed (facts-vs-narration:
  the UI never computes P&L/indicators itself).

## 3. Dependencies

- Spec **03** (`/auth/*`, `requireAuth`, session cookie).
- Spec **02** (`AgentOutput`, `PortfolioState` types).
- A **portfolio read endpoint**: `GET /portfolio` returning `PortfolioState`, and `GET /agents/latest?symbol=`
  returning the most recent `AgentOutput` for a symbol. *These are thin read routes over spec 01/06/07
  data.* If not yet owned, coordinate with M4 (portfolio) / M1 (agent-latest); until then, develop
  against a typed mock that matches the contract exactly, so swap-in is trivial.

## 4. Interface & Contracts (consumed, not defined)

```
GET /auth/me                         -> { user } | 401           (spec 03)
GET /portfolio                       -> PortfolioState             (spec 02 shape)
GET /agents/latest?symbol=AAPL       -> AgentOutput | null         (spec 02 shape)
GET /watchlist                       -> { symbol }[]               (seeded; spec 01)
```
- The API client wraps these and returns contract-typed data. 401 anywhere → route guard bounces to login.

## 5. Implementation notes

- Fetch layer: `@tanstack/react-query` for caching/loading/error; credentials `include` so the session
  cookie rides along.
- Render agent output honestly: show `direction` as a colored badge, `confidence` as a 0–100% meter, and
  `rationale` verbatim — do not paraphrase or recompute. If `evidence` is present, show it in a details
  disclosure (lets a viewer sanity-check narration vs. facts).
- Charts via Recharts; format money/percent for display only (never recompute values). Follow the
  `dataviz` skill conventions for the value-over-time chart and KPI tiles (consistent, theme-aware,
  accessible in light + dark).
- Empty states: no positions yet → friendly empty table; no agent output yet → "no analysis yet" card.
- Keep components in `apps/web` only; no imports from `apps/api` internals — cross the boundary via the
  HTTP client + `packages/contracts` types.

## 6. Acceptance criteria

- [ ] Unauthenticated visit to `/` redirects to `/login`; successful login lands on the dashboard.
- [ ] Session persists across a full page reload (no re-login) via `GET /auth/me`.
- [ ] Logout clears the session and returns to `/login`.
- [ ] Portfolio view shows cash, equity, P&L tiles, a value-over-time chart, and a positions table,
      all from `GET /portfolio` (contract-typed).
- [ ] Agent Activity card renders a `direction` badge, confidence meter, and rationale from the latest
      `AgentOutput`.
- [ ] All API shapes come from `packages/contracts` — no duplicated/hand-written response types.
- [ ] Loading, empty, and error states are handled (no crash on missing data).
- [ ] Works in light and dark themes.

## 7. Tests (Vitest + React Testing Library)

- Route-guard test: rendering a protected route while `/auth/me` returns 401 redirects to `/login`.
- Portfolio render test: given a mock `PortfolioState`, tiles/table/chart render the provided values
  (assert displayed numbers equal the mock — UI must not transform them).
- Agent card test: given a mock `AgentOutput`, the badge color matches `direction` and the meter matches
  `confidence`; rationale text appears verbatim.
- Empty-state test: null portfolio / null agent output render empty states, not errors.

## 8. Files & Definition of Done

- `apps/web/`: Vite scaffold, `src/routes/`, `src/lib/api.ts`, `src/components/` (layout, KPI tiles,
  positions table, value chart, agent card, login form), `src/theme`, `tests/`.
- **DoD:** login + persistent session + portfolio + agent-output rendering all work against the real
  endpoints (or contract-exact mocks pending them), contract types reused, tests green, light/dark
  clean. Merged to a feature branch off `main`.
