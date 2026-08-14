import { asc, eq } from "drizzle-orm";
import { watchlistItems } from "@committee/db/schema";
import { PortfolioState } from "@committee/contracts";

import { getDb } from "../auth/db.js";

/**
 * OWNER: M4 — portfolio + watchlist READ endpoints consumed by spec 08's
 * dashboard. Thin reads only; no computation beyond what the DB already holds.
 */

/**
 * ─── SPRINT-1 PLACEHOLDER ──────────────────────────────────────────────────
 * There is no broker sync yet. Spec 08 §3 needs `GET /portfolio` to return a
 * contract-valid `PortfolioState` so the dashboard can be built and typed
 * against the real endpoint; real balances arrive in Sprint 3 (spec: Alpaca
 * execution / portfolio sync), and spec 01 has no portfolio/positions tables
 * for Sprint 1.
 *
 * We therefore return the only HONEST snapshot available: nothing is held and
 * nothing is known. Zeroes and an empty positions array are deliberate — they
 * say "no data yet", whereas an invented cash balance would violate the
 * facts-vs-narration law (overview §"Cross-cutting laws" #2) by presenting a
 * fabricated number as a fact. The dashboard's empty states are what should
 * render off this.
 *
 * When Sprint 3 lands, replace `emptySnapshot()` with a read of the synced
 * broker snapshot. The route, the contract and the response shape do not change.
 */
const PLACEHOLDER_CASH = 0;
const PLACEHOLDER_EQUITY = 0;

function emptySnapshot(asOf: Date): PortfolioState {
  return {
    cash: PLACEHOLDER_CASH,
    equity: PLACEHOLDER_EQUITY,
    positions: [],
    asOf: asOf.toISOString(),
  };
}

/**
 * Current portfolio state for a user.
 *
 * The result is parsed through the shared Zod contract before it leaves this
 * function, so an endpoint drift from `PortfolioState` fails here rather than
 * in the browser.
 */
export async function getPortfolioState(userId: string): Promise<PortfolioState> {
  void userId; // per-user broker snapshot arrives with the Sprint-3 sync.
  return PortfolioState.parse(emptySnapshot(new Date()));
}

export interface WatchlistEntry {
  symbol: string;
}

/** The user's seeded watchlist (spec 08 §2: read-only in Sprint 1). */
export async function getWatchlist(userId: string): Promise<WatchlistEntry[]> {
  const db = await getDb();
  const rows = await db
    .select({ symbol: watchlistItems.symbol })
    .from(watchlistItems)
    .where(eq(watchlistItems.userId, userId))
    .orderBy(asc(watchlistItems.symbol));

  return rows;
}
