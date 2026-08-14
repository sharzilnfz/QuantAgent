import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildTestApp, type CapturedLogs } from "./auth.helpers.js";

/**
 * Spec 03 §7 — "Log-redaction test: /credentials and /auth/* bodies do not
 * appear in captured logs."
 *
 * These need no database: every request here is rejected before it reaches the
 * DB (bad body, or no session cookie), which is exactly the path where a
 * framework-generated error message would otherwise echo the payload.
 */

const PASSWORD = "correct-horse-battery-staple-9f2b";
const ALPACA_KEY = "PKUNITTESTKEY0001";
const ALPACA_SECRET = "unit-test-alpaca-secret-value-771";

let app: FastifyInstance;
let logs: CapturedLogs;

beforeAll(async () => {
  ({ app, logs } = await buildTestApp());
});

afterAll(async () => {
  await app.close();
});

describe("sensitive bodies never reach the log stream", () => {
  it("does not log the password on a malformed /auth/register body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "not-an-email", password: PASSWORD },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid_request" });
    expect(logs.text()).not.toContain(PASSWORD);
    // The generic reply must not echo the payload either.
    expect(res.body).not.toContain(PASSWORD);
  });

  it("does not log the password on a malformed /auth/login body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "still-not-an-email", password: PASSWORD },
    });

    expect(res.statusCode).toBe(400);
    expect(logs.text()).not.toContain(PASSWORD);
  });

  it("does not log the body when JSON parsing fails on /auth/login", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "content-type": "application/json" },
      payload: `{"email":"a@b.co","password":"${PASSWORD}"`, // truncated JSON
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(logs.text()).not.toContain(PASSWORD);
    expect(res.body).not.toContain(PASSWORD);
  });

  it("does not log Alpaca credentials posted without a session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/credentials",
      payload: { alpacaKey: ALPACA_KEY, alpacaSecret: ALPACA_SECRET },
    });

    expect(res.statusCode).toBe(401);
    expect(logs.text()).not.toContain(ALPACA_KEY);
    expect(logs.text()).not.toContain(ALPACA_SECRET);
    expect(res.body).not.toContain(ALPACA_SECRET);
  });

  it("does not log the session cookie value", async () => {
    const fakeSession = "11111111-2222-4333-8444-555555555555";
    await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: { committee_session: fakeSession },
    });

    expect(logs.text()).not.toContain(fakeSession);
  });

  it("captured something — the assertions above are not vacuous", () => {
    // Guards against a silently broken log stream making every not.toContain pass.
    expect(logs.lines.length).toBeGreaterThan(0);
    expect(logs.text()).toContain("/auth/register");
  });
});

describe("requireAuth fails closed without a database", () => {
  it("401s every protected route when no session cookie is present", async () => {
    for (const url of ["/auth/me", "/credentials/status", "/portfolio", "/watchlist"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, `${url} must be 401`).toBe(401);
      expect(res.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("401s on a malformed session id without hitting the database", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { committee_session: "not-a-uuid'; drop table users;--" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("clears the cookie it just rejected", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { committee_session: "not-a-uuid" },
    });
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(String(res.headers["set-cookie"])).toContain("committee_session=");
  });
});
