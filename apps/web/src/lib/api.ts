/**
 * Typed HTTP client — the ONLY seam between `apps/web` and the backend.
 *
 * Contract shapes are imported from `@committee/contracts`; nothing here
 * re-declares one. Contract responses are parsed through the contract's own Zod
 * schema at the boundary (cross-cutting law #3: a payload is untrusted until it
 * validates), so backend drift surfaces as a handled query error rather than an
 * `undefined` deep inside a component.
 *
 * `zod` is not a dependency of this app, and adding one would be dependency
 * churn for no gain — the schemas exported by `@committee/contracts` carry their
 * own `.parse` / `.pick` / `.array`, which is all we need. The two API-LOCAL
 * shapes (`/auth/*`, `/watchlist`) are not contract types at all — spec 03 §4 is
 * explicit that auth payloads live in `apps/api` — so they get small hand-rolled
 * guards below.
 *
 * Requests go to `/api/*`; Vite proxies that to the API server (see
 * `vite.config.ts`, which strips the prefix). `credentials: "include"` so the
 * spec-03 session cookie rides along.
 */
import { AgentOutput, ExperimentSuiteResult, PortfolioState, VarianceSweepResult } from "@committee/contracts";

const API_BASE = "/api";

/** Everything this client throws. `status` 0 means the request never landed. */
export class ApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
  }

  /** The route guard bounces to `/login` on this. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.isUnauthorized;
}

/** API-LOCAL (spec 03 §4) — not a cross-service contract type. */
export interface AuthUser {
  id: string;
  email: string;
}

/** API-LOCAL — `GET /watchlist -> { symbol }[]` (seeded; spec 01). */
export interface WatchlistEntry {
  symbol: string;
}

/**
 * One point on the portfolio value-over-time chart. Derived from the contract
 * with `Pick` rather than hand-written, so it cannot drift from `PortfolioState`.
 * See CONTRACT GAPS at the bottom of this file for why the route exists.
 */
export type PortfolioPoint = Pick<PortfolioState, "asOf" | "equity">;

const PortfolioPointSchema = PortfolioState.pick({ asOf: true, equity: true });

/**
 * `GET /portfolio`. `PortfolioState` verbatim plus an OPTIONAL aggregate P&L the
 * API may supply. The UI must never sum `positions[].unrealizedPl` itself
 * (cross-cutting law #2) — when the field is absent the P&L tile says so rather
 * than inventing the number. See CONTRACT GAPS below.
 */
export type PortfolioResponse = PortfolioState & { unrealizedPl?: number };

// --- transport ---------------------------------------------------------------

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  const { method = "GET", body, signal } = options;

  const init: RequestInit = { method, credentials: "include" };
  if (signal) init.signal = signal;
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    // Server down / offline / DNS. Distinguishable from a 4xx by status 0.
    throw new ApiError("Could not reach the API. Check that the server is running.", 0, path);
  }

  const raw = response.status === 204 ? "" : await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(errorMessage(payload, response), response.status, path);
  }
  return payload;
}

function errorMessage(payload: unknown, response: Response): string {
  const record = asRecord(payload);
  if (record) {
    for (const key of ["message", "error"] as const) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  if (response.status === 401) return "Your session has expired.";
  return `Request failed (${response.status}).`;
}

// --- parsing -----------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function contractError(path: string): ApiError {
  return new ApiError(
    "The API returned a response that does not match the shared contract.",
    500,
    path,
  );
}

/** Runs a contract schema; a drift becomes a readable, handled error. */
function parseContract<T>(
  schema: { parse: (input: unknown) => T },
  payload: unknown,
  path: string,
): T {
  try {
    return schema.parse(payload);
  } catch {
    throw contractError(path);
  }
}

function parseUserEnvelope(payload: unknown, path: string): AuthUser {
  const user = asRecord(asRecord(payload)?.["user"]);
  if (!user || typeof user["id"] !== "string" || typeof user["email"] !== "string") {
    throw contractError(path);
  }
  return { id: user["id"], email: user["email"] };
}

function parseWatchlist(payload: unknown, path: string): WatchlistEntry[] {
  if (!Array.isArray(payload)) throw contractError(path);
  return payload.map((entry) => {
    const record = asRecord(entry);
    if (!record || typeof record["symbol"] !== "string") throw contractError(path);
    return { symbol: record["symbol"] };
  });
}

/** Reads the optional, non-contract aggregate off the raw `/portfolio` payload. */
function readOptionalNumber(payload: unknown, key: string): number | undefined {
  const value = asRecord(payload)?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

// --- routes ------------------------------------------------------------------

export const api = {
  /** `GET /auth/me -> { user } | 401`. Rehydrates the session on a hard reload. */
  async me(signal?: AbortSignal): Promise<AuthUser> {
    return parseUserEnvelope(await request("/auth/me", { signal }), "/auth/me");
  },

  /** `POST /auth/login -> 200 { user }` + Set-Cookie. */
  async login(credentials: { email: string; password: string }): Promise<AuthUser> {
    const payload = await request("/auth/login", { method: "POST", body: credentials });
    return parseUserEnvelope(payload, "/auth/login");
  },

  /** `POST /auth/register -> 201 { user }` + Set-Cookie. */
  async register(credentials: { email: string; password: string }): Promise<AuthUser> {
    const payload = await request("/auth/register", { method: "POST", body: credentials });
    return parseUserEnvelope(payload, "/auth/register");
  },

  /** `POST /auth/logout -> 204`, clears the cookie + session row. */
  async logout(): Promise<void> {
    await request("/auth/logout", { method: "POST" });
  },

  /**
   * `GET /portfolio -> PortfolioState`.
   *
   * A `null`/empty body means "no snapshot for this user yet" — a real state in
   * Sprint 1, before the first portfolio row exists. It resolves to `null` so
   * the view can render an intentional empty state instead of a contract error.
   */
  async portfolio(signal?: AbortSignal): Promise<PortfolioResponse | null> {
    const payload = await request("/portfolio", { signal });
    if (payload === null || payload === undefined) return null;
    const state = parseContract(PortfolioState, payload, "/portfolio");
    const unrealizedPl = readOptionalNumber(payload, "unrealizedPl");
    return unrealizedPl === undefined ? state : { ...state, unrealizedPl };
  },

  /** `GET /portfolio/history -> Pick<PortfolioState, "asOf" | "equity">[]`. */
  async portfolioHistory(signal?: AbortSignal): Promise<PortfolioPoint[]> {
    const payload = await request("/portfolio/history", { signal });
    return parseContract(PortfolioPointSchema.array(), payload, "/portfolio/history");
  },

  /** `GET /agents/latest?symbol=AAPL -> AgentOutput | null`. */
  async latestAgentOutput(symbol: string, signal?: AbortSignal): Promise<AgentOutput | null> {
    const path = `/agents/latest?symbol=${encodeURIComponent(symbol)}`;
    const payload = await request(path, { signal });
    if (payload === null || payload === undefined) return null;
    return parseContract(AgentOutput, payload, path);
  },

  /** `GET /watchlist -> { symbol }[]` (seeded; management UI is Sprint 2). */
  async watchlist(signal?: AbortSignal): Promise<WatchlistEntry[]> {
    return parseWatchlist(await request("/watchlist", { signal }), "/watchlist");
  },

  /** `GET /experiments/suite?symbol=AAPL -> ExperimentSuiteResult`. */
  async experimentsSuite(symbol = "AAPL", signal?: AbortSignal): Promise<ExperimentSuiteResult> {
    const path = `/experiments/suite?symbol=${encodeURIComponent(symbol)}`;
    const payload = await request(path, { signal });
    return parseContract(ExperimentSuiteResult, payload, path);
  },

  /** `GET /experiments/variance-sweep?symbol=AAPL&windowSize=25&runs=3 -> VarianceSweepResult`. */
  async varianceSweep(
    symbol = "AAPL",
    windowSize = 25,
    runs = 3,
    budget = 5.0,
    signal?: AbortSignal,
  ): Promise<VarianceSweepResult> {
    const path = `/experiments/variance-sweep?symbol=${encodeURIComponent(symbol)}&windowSize=${windowSize}&runs=${runs}&budget=${budget}`;
    const payload = await request(path, { signal });
    return parseContract(VarianceSweepResult, payload, path);
  },
};

/*
 * ---------------------------------------------------------------------------
 * CONTRACT GAPS — raised, not silently patched. Owners: M1 (spec 02) / M4.
 * ---------------------------------------------------------------------------
 * 1. `PortfolioState` has no aggregate P&L field, but spec 08 §6 requires a P&L
 *    KPI tile. Summing `positions[].unrealizedPl` in the browser would make the
 *    UI compute a financial number, which cross-cutting law #2 forbids. Handled
 *    here as an OPTIONAL `unrealizedPl` on the `/portfolio` response: present →
 *    the tile renders it; absent → the tile renders an explicit "not reported"
 *    state. Proposed fix: add `unrealizedPl: z.number()` to `PortfolioState`.
 *
 * 2. `PortfolioState` is a single snapshot, so none of spec 08 §4's four routes
 *    can feed the value-over-time chart. `GET /portfolio/history` (a series of
 *    `{ asOf, equity }`, oldest → newest) is the minimal addition; its type is
 *    `Pick`ed off `PortfolioState` so it cannot drift. The query is
 *    non-critical — if the route is missing, the chart shows an empty state and
 *    the rest of the dashboard is unaffected.
 */
