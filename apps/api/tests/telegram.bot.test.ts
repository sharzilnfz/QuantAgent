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

    expect(response).toContain("WATCHLIST");
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
