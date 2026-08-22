import { describe, expect, it, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  TelegramAlertPayload,
  TelegramEodDigestPayload,
  TelegramWebhookUpdate,
} from "@committee/contracts";

import { buildApp } from "../src/app.js";
import {
  DeterministicMockTelegramClient,
  TelegramFormatter,
  TelegramCommandHandler,
  TelegramBotService,
} from "../src/telegram/index.js";

describe("Telegram Alert Bot — Formatting & Contracts", () => {
  it("formats a BUY trade alert with consensus and preserved dissent", () => {
    const alert: TelegramAlertPayload = {
      symbol: "AAPL",
      action: "BUY",
      confidence: 0.85,
      price: 185.5,
      allocatedQty: 25,
      riskApproved: true,
      rationale: "Bullish SMA golden cross with Wilder RSI supporting momentum.",
      debateDissent: "Sentiment specialist noted macro headwind caution.",
      decisionTs: "2024-02-15T21:00:00.000Z",
    };

    expect(TelegramAlertPayload.safeParse(alert).success).toBe(true);

    const formatted = TelegramFormatter.formatTradeAlert(alert);
    expect(formatted).toContain("QUANT COMMITTEE SIGNAL: BUY AAPL");
    expect(formatted).toContain("• *Confidence:* 85%");
    expect(formatted).toContain("• *Allocated Sizing:* 25 shares");
    expect(formatted).toContain("✅ *APPROVED*");
    expect(formatted).toContain("Bullish SMA golden cross");
    expect(formatted).toContain("Sentiment specialist noted macro headwind");
  });

  it("formats a trade alert BLOCKED by deterministic risk gate", () => {
    const alert: TelegramAlertPayload = {
      symbol: "NVDA",
      action: "BUY",
      confidence: 0.92,
      riskApproved: false,
      riskReason: "Max position concentration limit (25%) exceeded.",
      rationale: "Unanimous bullish breakout across all specialists.",
      decisionTs: "2024-02-15T21:00:00.000Z",
    };

    const formatted = TelegramFormatter.formatTradeAlert(alert);
    expect(formatted).toContain("QUANT COMMITTEE SIGNAL: BUY NVDA");
    expect(formatted).toContain("🛡️ *BLOCKED BY RISK GATE*");
    expect(formatted).toContain("Max position concentration limit (25%) exceeded.");
  });

  it("formats an End-of-Day performance digest", () => {
    const digest: TelegramEodDigestPayload = {
      asOf: "2024-02-15T21:00:00.000Z",
      portfolioEquity: 104250.75,
      cash: 45000.0,
      dayChange: 4250.75,
      dayChangePercent: 4.25,
      executedTradesCount: 3,
      topPositions: [
        { symbol: "AAPL", qty: 50, marketValue: 9275.0, unrealizedPl: 320.5 },
        { symbol: "MSFT", qty: 100, marketValue: 41200.0, unrealizedPl: -150.0 },
      ],
    };

    expect(TelegramEodDigestPayload.safeParse(digest).success).toBe(true);

    const formatted = TelegramFormatter.formatEodDigest(digest);
    expect(formatted).toContain("DAILY TRADING DIGEST");
    expect(formatted).toContain("104,250.75");
    expect(formatted).toContain("+$4250.75 (+4.25%)");
    expect(formatted).toContain("• *Executed Trades Today:* 3");
    expect(formatted).toContain("*AAPL*: 50 shares");
    expect(formatted).toContain("P&L: +$320.50");
  });
});

describe("Telegram Bot Service & Command Handlers", () => {
  let mockClient: DeterministicMockTelegramClient;
  let service: TelegramBotService;
  let handler: TelegramCommandHandler;

  beforeEach(() => {
    mockClient = new DeterministicMockTelegramClient();
    service = new TelegramBotService({ customClient: mockClient, chatId: 12345 });
    handler = new TelegramCommandHandler();
  });

  it("reports mock status in offline mode", () => {
    const status = service.getStatus();
    expect(status.mode).toBe("mock");
    expect(status.configured).toBe(false);
  });

  it("dispatches trade alerts to the mock client sink", async () => {
    const alert: TelegramAlertPayload = {
      symbol: "SPY",
      action: "HOLD",
      confidence: 0.6,
      riskApproved: true,
      rationale: "Neutral macroeconomic environment.",
      decisionTs: "2024-02-15T21:00:00.000Z",
    };

    const res = await service.notifyTradeDecision(alert);
    expect(res.ok).toBe(true);

    const messages = mockClient.getDispatchedMessages();
    expect(messages.length).toBe(1);
    expect(messages[0]?.chatId).toBe(12345);
    expect(messages[0]?.text).toContain("QUANT COMMITTEE SIGNAL: HOLD SPY");
  });

  it("handles /help command via webhook", async () => {
    const update: TelegramWebhookUpdate = {
      update_id: 1,
      message: {
        message_id: 101,
        chat: { id: 99999 },
        text: "/help",
      },
    };

    const result = await service.handleWebhookUpdate(update);
    expect(result.handled).toBe(true);
    expect(result.responseText).toContain("Available commands:");

    const messages = mockClient.getDispatchedMessages();
    expect(messages.length).toBe(1);
    expect(messages[0]?.chatId).toBe(99999);
    expect(messages[0]?.text).toContain("/portfolio");
  });

  it("handles /portfolio command", async () => {
    const response = await handler.handle({
      chatId: 88888,
      text: "/portfolio",
      client: mockClient,
    });

    expect(response).toContain("PORTFOLIO STATUS");
    expect(response).toContain("Total Equity");
    expect(mockClient.getDispatchedMessages().length).toBe(1);
  });

  it("handles /watchlist command", async () => {
    const response = await handler.handle({
      chatId: 88888,
      text: "/watchlist",
      client: mockClient,
    });

    expect(response).toMatch(/WATCHLIST|Watchlist is currently empty/i);
    expect(mockClient.getDispatchedMessages().length).toBe(1);
  });

  it("handles /latest command for a symbol", async () => {
    const response = await handler.handle({
      chatId: 88888,
      text: "/latest AAPL",
      client: mockClient,
    });

    expect(response).toContain("LATEST COMMITTEE DECISION: AAPL");
    expect(mockClient.getDispatchedMessages().length).toBe(1);
  });

  it("handles /eod digest command", async () => {
    const response = await handler.handle({
      chatId: 88888,
      text: "/eod",
      client: mockClient,
    });

    expect(response).toContain("DAILY TRADING DIGEST");
    expect(mockClient.getDispatchedMessages().length).toBe(1);
  });
});

describe("Telegram Fastify HTTP Endpoints", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("GET /telegram/status returns service status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/telegram/status",
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveProperty("mode");
    expect(json).toHaveProperty("configured");
  });

  it("POST /telegram/webhook processes valid update", async () => {
    const update: TelegramWebhookUpdate = {
      update_id: 42,
      message: {
        message_id: 1,
        chat: { id: 77777 },
        text: "/help",
      },
    };

    const res = await app.inject({
      method: "POST",
      url: "/telegram/webhook",
      payload: update,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().handled).toBe(true);
  });

  it("POST /telegram/notify/trade dispatches trade alert", async () => {
    const alert: TelegramAlertPayload = {
      symbol: "MSFT",
      action: "BUY",
      confidence: 0.88,
      price: 410.25,
      allocatedQty: 10,
      riskApproved: true,
      rationale: "Consistent free cash flow growth and technical momentum.",
      decisionTs: "2024-02-15T21:00:00.000Z",
    };

    const res = await app.inject({
      method: "POST",
      url: "/telegram/notify/trade",
      payload: { alert, chatId: 77777 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("POST /telegram/notify/eod dispatches EOD recap", async () => {
    const digest: TelegramEodDigestPayload = {
      asOf: "2024-02-15T21:00:00.000Z",
      portfolioEquity: 100500.0,
      cash: 50500.0,
      dayChange: 500.0,
      dayChangePercent: 0.5,
      executedTradesCount: 1,
      topPositions: [{ symbol: "AAPL", qty: 25, marketValue: 50000.0, unrealizedPl: 500.0 }],
    };

    const res = await app.inject({
      method: "POST",
      url: "/telegram/notify/eod",
      payload: { digest, chatId: 77777 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});

describe("Interactive 2-Way Trade Approval State Machine", () => {
  let mockClient: DeterministicMockTelegramClient;
  let service: TelegramBotService;

  beforeEach(() => {
    mockClient = new DeterministicMockTelegramClient();
    service = new TelegramBotService({ customClient: mockClient, chatId: 55555 });
    service.getApprovalStore().clear();
  });

  it("stores and resolves pending trade approvals with prefix matching", () => {
    const store = service.getApprovalStore();
    const approvalId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    store.add({
      approvalId,
      symbol: "NVDA",
      direction: "bullish",
      side: "buy",
      targetQty: 50,
      estimatedPrice: 750.0,
      estimatedNotional: 37500.0,
      confidence: 0.95,
      rationale: "Data center demand inflection.",
      riskStatus: "APPROVED",
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      decisionTs: "2024-02-15T21:00:00.000Z",
    });

    expect(store.list("pending").length).toBe(1);

    // Lookup by 8-char prefix
    const found = store.get("a1b2c3d4");
    expect(found).toBeDefined();
    expect(found?.symbol).toBe("NVDA");

    // Resolve approval
    const resolved = store.resolve("a1b2c3d4", {
      status: "approved",
      resolvedBy: "Risk Officer",
      resolutionReason: "Authorized high-conviction trade",
      executionId: "exec-12345",
    });

    expect(resolved.status).toBe("approved");
    expect(resolved.resolvedBy).toBe("Risk Officer");
    expect(store.list("pending").length).toBe(0);
    expect(store.list("approved").length).toBe(1);
  });

  it("expires stale pending trade approvals after TTL", () => {
    const store = service.getApprovalStore();

    store.add({
      approvalId: "11111111-2222-3333-4444-555555555555",
      symbol: "SPY",
      direction: "bearish",
      side: "sell",
      targetQty: 10,
      estimatedPrice: 500.0,
      estimatedNotional: 5000.0,
      confidence: 0.7,
      rationale: "Macro hedge.",
      riskStatus: "MODIFIED",
      status: "pending",
      createdAt: new Date(Date.now() - 100000).toISOString(),
      expiresAt: new Date(Date.now() - 5000).toISOString(), // Expired 5 seconds ago
      decisionTs: "2024-02-15T21:00:00.000Z",
    });

    expect(store.list("pending").length).toBe(0);
    expect(store.list("expired").length).toBe(1);
  });

  it("dispatches approval request with inline keyboard buttons and resolves via callback query", async () => {
    const requestResult = await service.requestTradeApproval({
      allocation: {
        allocationId: "11111111-1111-4111-8111-111111111111",
        symbol: "AAPL",
        direction: "bullish",
        targetQty: 20,
        targetWeight: 0.15,
        targetNotional: 3600.0,
        estimatedPrice: 180.0,
        sizingMethod: "fixed_percentage",
        sizingParameters: {},
        rationale: "Strong breakout above 50-day moving average.",
        asOf: "2024-02-15T21:00:00.000Z",
        allocatedAt: "2024-02-15T21:00:00.000Z",
      },
      riskAssessment: {
        assessmentId: "22222222-2222-4222-8222-222222222222",
        symbol: "AAPL",
        direction: "bullish",
        status: "APPROVED",
        executionAllowed: true,
        evaluatedRules: [],
        violations: [],
        adjustedConstraints: {},
        asOf: "2024-02-15T21:00:00.000Z",
        evaluatedAt: "2024-02-15T21:00:00.000Z",
      },
      decisionTs: "2024-02-15T21:00:00.000Z",
      confidence: 0.88,
      rationale: "Strong breakout above 50-day moving average.",
      chatId: 55555,
    });

    expect(requestResult.ok).toBe(true);
    expect(requestResult.approval.status).toBe("pending");

    const dispatched = mockClient.getDispatchedMessages();
    expect(dispatched.length).toBe(1);
    expect(dispatched[0]?.text).toContain("ACTION REQUIRED: TRADE APPROVAL REQUEST");
    expect(dispatched[0]?.options?.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data).toBe(
      `trade:approve:${requestResult.approval.approvalId}`,
    );

    // Simulate Telegram webhook callback query click on [Approve]
    const webhookUpdate: TelegramWebhookUpdate = {
      update_id: 100,
      callback_query: {
        id: "cb-query-999",
        from: { id: 777, username: "LeadTrader" },
        message: {
          message_id: 1001,
          chat: { id: 55555 },
        },
        data: `trade:approve:${requestResult.approval.approvalId}`,
      },
    };

    const webhookRes = await service.handleWebhookUpdate(webhookUpdate);
    expect(webhookRes.handled).toBe(true);

    const answered = mockClient.getAnsweredCallbacks();
    expect(answered.length).toBe(1);
    expect(answered[0]?.callbackQueryId).toBe("cb-query-999");

    const updatedApproval = service.getApprovalStore().get(requestResult.approval.approvalId);
    expect(updatedApproval?.status).toBe("approved");
    expect(updatedApproval?.resolvedBy).toBe("@LeadTrader");
    expect(updatedApproval?.executionId).toBeDefined();

    // Verification message sent to channel
    const messages = mockClient.getDispatchedMessages();
    expect(messages.length).toBe(2);
    expect(messages[1]?.text).toContain("TRADE APPROVED & SUBMITTED");
  });

  it("handles rejection callback query correctly", async () => {
    const requestResult = await service.requestTradeApproval({
      allocation: {
        allocationId: "33333333-3333-4333-8333-333333333333",
        symbol: "TSLA",
        direction: "bearish",
        targetQty: 15,
        targetWeight: 0.1,
        targetNotional: 3000.0,
        estimatedPrice: 200.0,
        sizingMethod: "volatility_parity",
        sizingParameters: {},
        rationale: "Bearish divergence.",
        asOf: "2024-02-15T21:00:00.000Z",
        allocatedAt: "2024-02-15T21:00:00.000Z",
      },
      riskAssessment: {
        assessmentId: "44444444-4444-4444-8444-444444444444",
        symbol: "TSLA",
        direction: "bearish",
        status: "MODIFIED",
        executionAllowed: true,
        evaluatedRules: [],
        violations: [
          {
            ruleId: "vol_ceiling",
            name: "Volatility Ceiling",
            passed: false,
            severity: "WARNING",
            message: "High Volatility",
          },
        ],
        adjustedConstraints: {},
        asOf: "2024-02-15T21:00:00.000Z",
        evaluatedAt: "2024-02-15T21:00:00.000Z",
      },
      decisionTs: "2024-02-15T21:00:00.000Z",
      confidence: 0.65,
      rationale: "Bearish divergence.",
    });

    const webhookUpdate: TelegramWebhookUpdate = {
      update_id: 101,
      callback_query: {
        id: "cb-query-1000",
        from: { id: 888, username: "RiskAdmin" },
        data: `trade:reject:${requestResult.approval.approvalId}`,
      },
    };

    const res = await service.handleWebhookUpdate(webhookUpdate);
    expect(res.handled).toBe(true);

    const updated = service.getApprovalStore().get(requestResult.approval.approvalId);
    expect(updated?.status).toBe("rejected");
    expect(updated?.executionId).toBeUndefined();
  });

  it("handles /pending and /approve text commands", async () => {
    const handler = new TelegramCommandHandler(undefined, service);

    const req = await service.requestTradeApproval({
      allocation: {
        allocationId: "55555555-5555-4555-8555-555555555555",
        symbol: "MSFT",
        direction: "bullish",
        targetQty: 10,
        targetWeight: 0.08,
        targetNotional: 4000.0,
        estimatedPrice: 400.0,
        sizingMethod: "fractional_kelly",
        sizingParameters: {},
        rationale: "Cloud earnings catalyst.",
        asOf: "2024-02-15T21:00:00.000Z",
        allocatedAt: "2024-02-15T21:00:00.000Z",
      },
      riskAssessment: {
        assessmentId: "66666666-6666-4666-8666-666666666666",
        symbol: "MSFT",
        direction: "bullish",
        status: "APPROVED",
        executionAllowed: true,
        evaluatedRules: [],
        violations: [],
        adjustedConstraints: {},
        asOf: "2024-02-15T21:00:00.000Z",
        evaluatedAt: "2024-02-15T21:00:00.000Z",
      },
      decisionTs: "2024-02-15T21:00:00.000Z",
      confidence: 0.9,
      rationale: "Cloud earnings catalyst.",
    });

    const pendingMsg = await handler.handle({
      chatId: 55555,
      text: "/pending",
      client: mockClient,
    });
    expect(pendingMsg).toContain("PENDING TRADE APPROVALS");
    expect(pendingMsg).toContain("BUY 10 MSFT");

    const approveMsg = await handler.handle({
      chatId: 55555,
      text: `/approve ${req.approval.approvalId.slice(0, 8)}`,
      client: mockClient,
    });
    expect(approveMsg).toContain("approved and routed");

    const afterStore = service.getApprovalStore().get(req.approval.approvalId);
    expect(afterStore?.status).toBe("approved");
  });
});

describe("Telegram Fastify Endpoints for Trade Approvals", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("POST /telegram/approvals/request and POST /telegram/approvals/:id/approve flow", async () => {
    const requestPayload = {
      allocation: {
        allocationId: "77777777-7777-4777-8777-777777777777",
        symbol: "NVDA",
        direction: "bullish",
        targetQty: 30,
        targetWeight: 0.2,
        targetNotional: 21000.0,
        estimatedPrice: 700.0,
        sizingMethod: "fractional_kelly",
        sizingParameters: {},
        rationale: "Accelerating generative AI data center momentum.",
        asOf: "2024-02-15T21:00:00.000Z",
        allocatedAt: "2024-02-15T21:00:00.000Z",
      },
      riskAssessment: {
        assessmentId: "88888888-8888-4888-8888-888888888888",
        symbol: "NVDA",
        direction: "bullish",
        status: "APPROVED",
        executionAllowed: true,
        evaluatedRules: [],
        violations: [],
        adjustedConstraints: {},
        asOf: "2024-02-15T21:00:00.000Z",
        evaluatedAt: "2024-02-15T21:00:00.000Z",
      },
      decisionTs: "2024-02-15T21:00:00.000Z",
      confidence: 0.92,
      rationale: "Accelerating generative AI data center momentum.",
    };

    const reqRes = await app.inject({
      method: "POST",
      url: "/telegram/approvals/request",
      payload: requestPayload,
    });

    expect(reqRes.statusCode).toBe(200);
    const reqJson = reqRes.json();
    expect(reqJson.ok).toBe(true);
    expect(reqJson.approval.status).toBe("pending");
    const approvalId = reqJson.approval.approvalId;

    // List approvals
    const listRes = await app.inject({
      method: "GET",
      url: "/telegram/approvals?status=pending",
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().approvals.some((a: any) => a.approvalId === approvalId)).toBe(true);

    // Approve via API
    const approveRes = await app.inject({
      method: "POST",
      url: `/telegram/approvals/${approvalId}/approve`,
      payload: { resolvedBy: "REST Client Officer", reason: "Approved via API" },
    });

    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().approval.status).toBe("approved");
    expect(approveRes.json().approval.resolvedBy).toBe("REST Client Officer");
  });
});


