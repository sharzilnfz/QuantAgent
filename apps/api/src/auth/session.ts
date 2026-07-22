import { randomUUID } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { sessions, users } from "@committee/db/schema";

import { config } from "../config.js";
import { getDb } from "./db.js";
import type { PublicUser } from "./schemas.js";

/**
 * OWNER: M4 (spec 03) — server-side session store.
 *
 * The cookie carries an OPAQUE random id and nothing else (spec 03 §5). No
 * email, no user id, no signed claims: every request re-reads the `sessions`
 * row, so revocation (logout) is immediate and a stolen cookie carries zero
 * information about its owner.
 */

export const SESSION_COOKIE = "committee_session";

/**
 * Only refresh a session's `expires_at` when it would move by more than this.
 * Rolling expiry must not mean "one UPDATE per request" on a chatty dashboard.
 */
const REFRESH_SKEW_MS = 60_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cookie flags per spec 03 §5: httpOnly, secure in prod, sameSite=lax, path /. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: config.SESSION_TTL,
  };
}

export interface ResolvedSession {
  sessionId: string;
  user: PublicUser;
  expiresAt: Date;
}

function ttlFromNow(): Date {
  return new Date(Date.now() + config.SESSION_TTL * 1000);
}

/** Mint a new opaque session id and persist it. Returns the id for the cookie. */
export async function createSession(userId: string): Promise<{
  sessionId: string;
  expiresAt: Date;
}> {
  const db = await getDb();
  const sessionId = randomUUID();
  const expiresAt = ttlFromNow();

  await db.insert(sessions).values({ id: sessionId, userId, expiresAt });

  return { sessionId, expiresAt };
}

/**
 * Resolve a cookie value to a live session, applying rolling expiry.
 *
 * FAILS CLOSED: any malformed id, missing row or past `expires_at` returns
 * `null`. An expired row is deleted on sight so it cannot be replayed.
 */
export async function resolveSession(
  rawSessionId: string | undefined,
): Promise<ResolvedSession | null> {
  // Guard before touching SQL: an arbitrary string would blow up the uuid cast
  // and surface as a 500 instead of a clean 401.
  if (!rawSessionId || !UUID_RE.test(rawSessionId)) return null;

  const db = await getDb();
  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, rawSessionId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await destroySession(row.sessionId);
    return null;
  }

  // Rolling expiry, capped at SESSION_TTL from *now* (spec 03 §5).
  let expiresAt = row.expiresAt;
  const next = ttlFromNow();
  if (next.getTime() - expiresAt.getTime() > REFRESH_SKEW_MS) {
    await db
      .update(sessions)
      .set({ expiresAt: next })
      .where(eq(sessions.id, row.sessionId));
    expiresAt = next;
  }

  return {
    sessionId: row.sessionId,
    user: { id: row.userId, email: row.email },
    expiresAt,
  };
}

/** Hard-delete a session row. Idempotent. */
export async function destroySession(sessionId: string): Promise<void> {
  if (!UUID_RE.test(sessionId)) return;
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Housekeeping helper: drop every session whose expiry has passed. */
export async function purgeExpiredSessions(): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
