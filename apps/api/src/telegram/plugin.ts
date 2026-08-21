/**
 * OWNER: M4 — Platform / Risk Lead
 * Fastify plugin for Telegram Alert Bot and webhook routing.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  TelegramAlertPayload,
  TelegramEodDigestPayload,
  TelegramWebhookUpdate,
} from "@committee/contracts";
import { telegramBotService } from "./service.js";

const NotifyTradeBody = z.object({
  alert: TelegramAlertPayload,
  chatId: z.union([z.string(), z.number()]).optional(),
});

const NotifyEodBody = z.object({
  digest: TelegramEodDigestPayload,
  chatId: z.union([z.string(), z.number()]).optional(),
});

export async function telegramPlugin(app: FastifyInstance): Promise<void> {
  /**
   * Status endpoint — check if bot is running in live or offline mock mode.
   */
  app.get("/telegram/status", async () => {
    return telegramBotService.getStatus();
  });

  /**
   * Inbound Telegram webhook receiver.
   */
  app.post("/telegram/webhook", async (request, reply) => {
    const parsed = TelegramWebhookUpdate.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_webhook_payload",
        issues: parsed.error.issues,
      });
    }

    const result = await telegramBotService.handleWebhookUpdate(parsed.data);
    return reply.code(200).send(result);
  });

  /**
   * Outbound trade decision alert trigger.
   */
  app.post("/telegram/notify/trade", async (request, reply) => {
    const parsed = NotifyTradeBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_trade_alert_body",
        issues: parsed.error.issues,
      });
    }

    const result = await telegramBotService.notifyTradeDecision(
      parsed.data.alert,
      parsed.data.chatId,
    );
    return reply.code(200).send(result);
  });

  /**
   * Outbound End-of-Day digest trigger.
   */
  app.post("/telegram/notify/eod", async (request, reply) => {
    const parsed = NotifyEodBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_eod_body",
        issues: parsed.error.issues,
      });
    }

    const result = await telegramBotService.notifyEodDigest(
      parsed.data.digest,
      parsed.data.chatId,
    );
    return reply.code(200).send(result);
  });
}
