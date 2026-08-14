import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildTestApp, dbProbe, readCookie, testEmail } from "./auth.helpers.js";

/**
 * Spec 03 §7 — auth flow integration + session expiry.
 *
 * DB-BACKED: these SKIP (never fail) when Postgres is unreachable or spec 01's
 * migrations have not been applied. The pure guarantees of this feature live in
 * credentials.crypto.test.ts and auth.redaction.test.ts, which always run.
 */

const SESSION_COOKIE = "committee_session";
const PASSWORD = "a-strong-test-password-123";

describe.skipIf(!dbProbe.available)("auth flow (DB-backed)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("register -> me -> logout -> me(401)", async () => {
    const email = testEmail("flow");

    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: PASSWORD },
    });
    expect(registered.statusCode).toBe(201);
    expect(registered.json().user.email).toBe(email);
    expect(registered.json().user).not.toHaveProperty("passwordHash");

    const session = readCookie(registered.cookies, SESSION_COOKIE);
    expect(session).toBeTruthy();

    // The cookie must be opaque — no user data encoded in it (spec 03 §5).
    expect(session).not.toContain(email);
    expect(session).not.toContain(registered.json().user.id);

    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { [SESSION_COOKIE]: session! },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe(email);

    const loggedOut = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: { [SESSION_COOKIE]: session! },
    });
    expect(loggedOut.statusCode).toBe(204);

    const after = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { [SESSION_COOKIE]: session! },
    });
    expect(after.statusCode).toBe(401);
  }, 30_000);

  it("login issues a session that survives a simulated reload", async () => {
    const email = testEmail("reload");
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: PASSWORD },
    });

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    const session = readCookie(login.cookies, SESSION_COOKIE)!;

    // Replay the same cookie three times, as a browser would across reloads.
    for (let i = 0; i < 3; i += 1) {
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        cookies: { [SESSION_COOKIE]: session },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().user.email).toBe(email);
    }
  }, 30_000);

  it("sets httpOnly / sameSite=lax / path=/ on the session cookie", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: testEmail("flags"), password: PASSWORD },
    });
    const header = String(login.headers["set-cookie"]);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\//i);
  }, 30_000);

  it("rejects a wrong password with a generic 401", async () => {
    const email = testEmail("wrongpw");
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: PASSWORD },
    });

    const bad = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "definitely-not-the-password" },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: testEmail("nosuchuser"), password: PASSWORD },
    });

    expect(bad.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    // No user enumeration: identical status AND identical body.
    expect(bad.json()).toEqual(unknown.json());
  }, 30_000);

  it("rejects a duplicate email with 409", async () => {
    const email = testEmail("dupe");
    const first = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: PASSWORD },
    });
    const second = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: PASSWORD },
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(409);
  }, 30_000);

  it("stores the password only as a bcrypt hash", async () => {
    const { users } = await import("@committee/db/schema");
    const { eq } = await import("drizzle-orm");
    const { getDb } = await import("../src/auth/db.js");

    const email = testEmail("hash");
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: PASSWORD },
    });

    const db = await getDb();
    const rows = await db.select().from(users).where(eq(users.email, email));
    const row = rows[0]!;
    expect(row.passwordHash).not.toBe(PASSWORD);
    expect(row.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(JSON.stringify(row)).not.toContain(PASSWORD);
  }, 30_000);

  it("401s on an expired session row", async () => {
    const { sessions } = await import("@committee/db/schema");
    const { eq } = await import("drizzle-orm");
    const { getDb } = await import("../src/auth/db.js");

    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: testEmail("expiry"), password: PASSWORD },
    });
    const session = readCookie(registered.cookies, SESSION_COOKIE)!;

    const db = await getDb();
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.id, session));

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { [SESSION_COOKIE]: session },
    });
    expect(res.statusCode).toBe(401);

    // The expired row is purged on sight, so it can never be replayed.
    const left = await db.select().from(sessions).where(eq(sessions.id, session));
    expect(left).toHaveLength(0);
  }, 30_000);
});

describe.skipIf(!dbProbe.available)("credential vault over HTTP (DB-backed)", () => {
  let app: FastifyInstance;
  let session: string;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: testEmail("vault"), password: PASSWORD },
    });
    session = readCookie(registered.cookies, SESSION_COOKIE)!;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("reports disconnected before any credentials are stored", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/credentials/status",
      cookies: { [SESSION_COOKIE]: session },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ connected: false, keyTail: null });
  });

  it("stores ciphertext only and exposes just the masked tail", async () => {
    const { alpacaCredentials } = await import("@committee/db/schema");
    const { getDb } = await import("../src/auth/db.js");

    const alpacaKey = "PKHTTPTESTKEY1234WXYZ";
    const alpacaSecret = "http-test-alpaca-secret-abcdef";

    const stored = await app.inject({
      method: "POST",
      url: "/credentials",
      payload: { alpacaKey, alpacaSecret },
      cookies: { [SESSION_COOKIE]: session },
    });
    expect(stored.statusCode).toBe(204);
    expect(stored.body).toBe("");

    const db = await getDb();
    const rows = await db.select().from(alpacaCredentials);
    const serialised = JSON.stringify(rows);
    expect(serialised).not.toContain(alpacaKey);
    expect(serialised).not.toContain(alpacaSecret);

    const status = await app.inject({
      method: "GET",
      url: "/credentials/status",
      cookies: { [SESSION_COOKIE]: session },
    });
    expect(status.json()).toEqual({ connected: true, keyTail: "WXYZ" });
    expect(status.body).not.toContain(alpacaKey);
    expect(status.body).not.toContain(alpacaSecret);
  }, 30_000);

  it("round-trips the stored credentials server-side", async () => {
    const { loadCredentials } = await import("../src/credentials/service.js");
    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { [SESSION_COOKIE]: session },
    });
    const userId = me.json().user.id as string;

    const plaintext = await loadCredentials(userId);
    expect(plaintext?.alpacaKey).toBe("PKHTTPTESTKEY1234WXYZ");
    expect(plaintext?.alpacaSecret).toBe("http-test-alpaca-secret-abcdef");
  }, 30_000);
});
