import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { PortfolioState } from "@committee/contracts";

import { getPortfolioState } from "../src/portfolio/service.js";
import { buildTestApp, dbProbe, readCookie, testEmail } from "./auth.helpers.js";

/**
 * Read endpoints consumed by spec 08 §3/§4.
 *
 * The contract assertions are pure (the Sprint-1 portfolio snapshot needs no
 * DB); the watchlist tests are DB-backed and skip gracefully.
 */

const SESSION_COOKIE = "committee_session";

describe("GET /portfolio returns a contract-valid PortfolioState", () => {
  it("validates against the shared PortfolioState contract", async () => {
    const state = await getPortfolioState("00000000-0000-4000-8000-000000000000");
    expect(PortfolioState.safeParse(state).success).toBe(true);
  });

  it("is an explicit empty Sprint-1 snapshot, not fabricated numbers", async () => {
    const state = await getPortfolioState("00000000-0000-4000-8000-000000000000");
    expect(state.positions).toEqual([]);
    expect(state.cash).toBe(0);
    expect(state.equity).toBe(0);
  });

  it("stamps asOf as an ISO-8601 instant", async () => {
    const state = await getPortfolioState("00000000-0000-4000-8000-000000000000");
    expect(new Date(state.asOf).toISOString()).toBe(state.asOf);
    expect(Math.abs(Date.now() - Date.parse(state.asOf))).toBeLessThan(60_000);
  });
});

describe("portfolio routes require a session", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  it("401s /portfolio and /watchlist without a cookie", async () => {
    for (const url of ["/portfolio", "/watchlist"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(401);
    }
  });
});

describe.skipIf(!dbProbe.available)("portfolio + watchlist reads (DB-backed)", () => {
  let app: FastifyInstance;
  let session: string;

  beforeAll(async () => {
    ({ app } = await buildTestApp());

    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: testEmail("portfolio"), password: "portfolio-pass-123" },
    });
    expect(registered.statusCode).toBe(201);
    session = readCookie(registered.cookies, SESSION_COOKIE)!;
    expect(session).toBeTruthy();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("serves a contract-valid PortfolioState over HTTP", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/portfolio",
      cookies: { [SESSION_COOKIE]: session },
    });
    expect(res.statusCode).toBe(200);
    expect(PortfolioState.safeParse(res.json()).success).toBe(true);
  });

  it("returns an empty watchlist for a brand-new user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/watchlist",
      cookies: { [SESSION_COOKIE]: session },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns { symbol } entries once the user has watchlist rows", async () => {
    const { watchlistItems } = await import("@committee/db/schema");
    const { getDb } = await import("../src/auth/db.js");
    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { [SESSION_COOKIE]: session },
    });
    const userId = me.json().user.id as string;

    const db = await getDb();
    await db
      .insert(watchlistItems)
      .values([
        { userId, symbol: "AAPL" },
        { userId, symbol: "MSFT" },
      ])
      .onConflictDoNothing();

    const res = await app.inject({
      method: "GET",
      url: "/watchlist",
      cookies: { [SESSION_COOKIE]: session },
    });
    expect(res.statusCode).toBe(200);
    // Sorted by symbol; shape is exactly { symbol } (spec 08 §4).
    expect(res.json()).toEqual([{ symbol: "AAPL" }, { symbol: "MSFT" }]);
  });
});
