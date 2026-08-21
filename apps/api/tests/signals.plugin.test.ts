import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { LiveSignalRadarResponse } from "@committee/contracts";
import { buildApp } from "../src/app.js";
import { dbProbe, readCookie, testEmail } from "./auth.helpers.js";

const SESSION_COOKIE = "committee_session";

describe("Signals Plugin HTTP Endpoints", () => {
  let app: FastifyInstance;
  let session: string = "";

  beforeAll(async () => {
    app = await buildApp();

    if (dbProbe.available) {
      const registered = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: testEmail("signals-test"), password: "signals-password-123" },
      });
      if (registered.statusCode === 201) {
        session = readCookie(registered.cookies, SESSION_COOKIE) ?? "";
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("401s /signals/radar without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/signals/radar",
    });
    expect(res.statusCode).toBe(401);
  });

  it("401s /signals/evaluate without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/signals/evaluate",
      payload: { symbol: "AAPL" },
    });
    expect(res.statusCode).toBe(401);
  });

  describe.skipIf(!dbProbe.available)("Authenticated Signals Endpoints", () => {
    it("GET /signals/radar returns a contract-valid LiveSignalRadarResponse", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/signals/radar?symbols=AAPL,NVDA,SPY",
        cookies: { [SESSION_COOKIE]: session },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      const parsed = LiveSignalRadarResponse.safeParse(json);
      expect(parsed.success).toBe(true);

      if (!parsed.success) return;

      expect(parsed.data.items.length).toBeGreaterThan(0);
      const aapl = parsed.data.items.find((it) => it.symbol === "AAPL");
      expect(aapl).toBeDefined();
      expect(aapl?.indicators.rsi).toBeDefined();
      expect(aapl?.specialistVotes).toBeDefined();
      expect(aapl?.consensus).toBeDefined();
    }, 20000);

    it("POST /signals/evaluate executes on-demand multi-agent deliberation", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/signals/evaluate",
        cookies: { [SESSION_COOKIE]: session },
        payload: { symbol: "AAPL", debateEnabled: true },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.symbol).toBe("AAPL");
      expect(json.consensus).toBeDefined();
      expect(json.riskAssessment).toBeDefined();
      expect(json.indicators).toBeDefined();
    }, 20000);
  });
});
