import { describe, expect, it, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  EodReportRecord,
  CronStatusResponse,
} from "@committee/contracts";

import { buildApp } from "../src/app.js";
import { EodReportService } from "../src/reports/service.js";
import { EodCronScheduler } from "../src/reports/cron.js";
import {
  DeterministicMockTelegramClient,
  telegramBotService,
} from "../src/telegram/index.js";

describe("EOD Report Service & Computation", () => {
  let service: EodReportService;
  let mockTgClient: DeterministicMockTelegramClient;

  beforeEach(() => {
    service = new EodReportService();
    mockTgClient = new DeterministicMockTelegramClient();
    telegramBotService.setClient(mockTgClient);
  });

  it("generates a contract-valid EOD snapshot", async () => {
    const report = await service.generateReport("00000000-0000-4000-8000-000000000000");

    expect(EodReportRecord.safeParse(report).success).toBe(true);
    expect(report.portfolioEquity).toBe(100_000);
    expect(report.cash).toBe(100_000);
    expect(report.benchmarkSymbol).toBe("SPY");
    expect(new Date(report.asOf).toISOString()).toBe(report.asOf);
  });

  it("dispatches EOD digest via Telegram and saves snapshot to history", async () => {
    const report = await service.generateAndDispatch("00000000-0000-4000-8000-000000000000", {
      notifyTelegram: true,
      chatId: 55555,
    });

    expect(report.dispatchedTelegram).toBe(true);

    const dispatchedMessages = mockTgClient.getDispatchedMessages();
    expect(dispatchedMessages.length).toBe(1);
    expect(dispatchedMessages[0]?.chatId).toBe(55555);
    expect(dispatchedMessages[0]?.text).toContain("DAILY TRADING DIGEST");

    const history = await service.getReportHistory("00000000-0000-4000-8000-000000000000");
    expect(history.length).toBe(1);
    expect(history[0]?.id).toBe(report.id);
  });

  it("retrieves the latest report or computes on-demand", async () => {
    const latest = await service.getLatestReport("00000000-0000-4000-8000-000000000000");
    expect(latest.portfolioEquity).toBe(100_000);
    expect(EodReportRecord.safeParse(latest).success).toBe(true);
  });
});

describe("EOD Cron Scheduler", () => {
  let scheduler: EodCronScheduler;

  beforeEach(() => {
    scheduler = new EodCronScheduler();
  });

  it("tracks scheduler status and next run time", () => {
    const status = scheduler.getStatus();
    expect(CronStatusResponse.safeParse(status).success).toBe(true);
    expect(status.active).toBe(false);
    expect(status.cronSchedule).toContain("16:00 ET");
    expect(status.nextRun).toBeTruthy();
  });

  it("triggers manual run successfully", async () => {
    const res = await scheduler.triggerManual("00000000-0000-4000-8000-000000000000");
    expect(res.ok).toBe(true);
    expect(res.reportId).toBeTruthy();

    const status = scheduler.getStatus();
    expect(status.lastRunStatus).toBe("ok");
    expect(status.lastRunAt).toBeTruthy();
  });

  it("can start and stop background timer", () => {
    scheduler.start();
    expect(scheduler.getStatus().active).toBe(true);
    scheduler.stop();
    expect(scheduler.getStatus().active).toBe(false);
  });
});

describe("EOD Reports Fastify HTTP Endpoints", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("GET /reports/eod/latest returns latest snapshot", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/eod/latest",
    });

    expect(res.statusCode).toBe(200);
    expect(EodReportRecord.safeParse(res.json()).success).toBe(true);
  });

  it("GET /reports/eod/history returns archived digests", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/eod/history",
    });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("POST /reports/eod/trigger generates and returns an EOD report", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/reports/eod/trigger",
      payload: { notifyTelegram: false },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(EodReportRecord.safeParse(json).success).toBe(true);
    expect(json.portfolioEquity).toBe(100_000);
  }, 15000);

  it("GET /reports/cron/status returns scheduler state", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/cron/status",
    });

    expect(res.statusCode).toBe(200);
    expect(CronStatusResponse.safeParse(res.json()).success).toBe(true);
  });
});
