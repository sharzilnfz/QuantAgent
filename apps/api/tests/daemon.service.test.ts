import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { TradingDaemonService } from "../src/daemon/service.js";
import { buildApp } from "../src/app.js";
import { dbProbe, readCookie, testEmail } from "./auth.helpers.js";

const SESSION_COOKIE = "committee_session";

describe("Autonomous Trading Daemon Service", () => {
  it("initializes in idle state with default config", () => {
    const daemon = new TradingDaemonService();
    const status = daemon.getStatus();

    expect(status.state).toBe("idle");
    expect(status.config.dryRun).toBe(true);
    expect(status.totalCycles).toBe(0);
  });

  it("transitions between running and paused states", () => {
    const daemon = new TradingDaemonService();

    const running = daemon.start();
    expect(running.state).toBe("running");
    expect(running.nextCycleAt).toBeTruthy();

    const paused = daemon.stop();
    expect(paused.state).toBe("paused");
    expect(paused.nextCycleAt).toBeNull();
  });

  it("executes a dry-run trading cycle across symbols", async () => {
    const daemon = new TradingDaemonService();
    daemon.updateConfig({
      symbols: ["AAPL"],
      dryRun: true,
    });

    const cycle = await daemon.executeCycle();

    expect(cycle.id).toBeTruthy();
    expect(cycle.symbolsEvaluated).toContain("AAPL");
    expect(cycle.results.length).toBeGreaterThan(0);

    const aaplResult = cycle.results.find((r) => r.symbol === "AAPL");
    expect(aaplResult).toBeDefined();
    expect(aaplResult?.consensus).toBeDefined();
    expect(aaplResult?.riskAssessment).toBeDefined();
    expect(["dry_run_recorded", "neutral_abstain", "rejected_by_risk"]).toContain(
      aaplResult?.actionTaken,
    );
  }, 20000);
});

describe("Daemon Fastify HTTP Routes", () => {
  let app: FastifyInstance;
  let session: string = "";

  beforeAll(async () => {
    app = await buildApp();

    if (dbProbe.available) {
      const registered = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: testEmail("daemon-test"), password: "daemon-pass-123" },
      });
      if (registered.statusCode === 201) {
        session = readCookie(registered.cookies, SESSION_COOKIE) ?? "";
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("401s /daemon/status without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/daemon/status",
    });
    expect(res.statusCode).toBe(401);
  });

  describe.skipIf(!dbProbe.available)("Authenticated Daemon Routes", () => {
    it("GET /daemon/status returns contract-valid DaemonStatus", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/daemon/status",
        cookies: { [SESSION_COOKIE]: session },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.state).toBeDefined();
      expect(json.config).toBeDefined();
    });

    it("POST /daemon/run-cycle triggers on-demand cycle execution", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/daemon/run-cycle",
        cookies: { [SESSION_COOKIE]: session },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.id).toBeTruthy();
      expect(Array.isArray(json.results)).toBe(true);
    }, 25000);
  });
});
