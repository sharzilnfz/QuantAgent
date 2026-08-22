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
  PositionAllocation,
  RiskAssessment,
  TradeApprovalStatus,
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

const RequestApprovalBody = z.object({
  allocation: PositionAllocation,
  riskAssessment: RiskAssessment,
  decisionTs: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  ttlMs: z.number().positive().optional(),
  chatId: z.union([z.string(), z.number()]).optional(),
});

const ResolveApprovalBody = z.object({
  resolvedBy: z.string().optional(),
  reason: z.string().optional(),
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

  /**
   * List pending and historical trade approvals.
   */
  app.get("/telegram/approvals", async (request) => {
    const query = request.query as { status?: string };
    const parsedStatus = TradeApprovalStatus.safeParse(query.status);
    const filterStatus = parsedStatus.success ? parsedStatus.data : undefined;
    const approvals = telegramBotService.getApprovalStore().list(filterStatus);
    return { approvals };
  });

  /**
   * Request a new 2-way manual trade approval with Telegram inline buttons.
   */
  app.post("/telegram/approvals/request", async (request, reply) => {
    const parsed = RequestApprovalBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_approval_request_body",
        issues: parsed.error.issues,
      });
    }

    const result = await telegramBotService.requestTradeApproval(parsed.data);
    return reply.code(200).send(result);
  });

  /**
   * Programmatically approve a pending trade approval.
   */
  app.post("/telegram/approvals/:id/approve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ResolveApprovalBody.safeParse(request.body ?? {});
    const resolvedBy = body.success ? body.data.resolvedBy ?? "API User" : "API User";
    const reason = body.success ? body.data.reason : undefined;

    const result = await telegramBotService.resolveApproval(
      id,
      "approve",
      resolvedBy,
      reason,
    );

    if (!result.ok) {
      return reply.code(400).send({ error: result.error, approval: result.approval });
    }
    return reply.code(200).send(result);
  });

  /**
   * Programmatically reject a pending trade approval.
   */
  app.post("/telegram/approvals/:id/reject", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ResolveApprovalBody.safeParse(request.body ?? {});
    const resolvedBy = body.success ? body.data.resolvedBy ?? "API User" : "API User";
    const reason = body.success ? body.data.reason : undefined;

    const result = await telegramBotService.resolveApproval(
      id,
      "reject",
      resolvedBy,
      reason,
    );

    if (!result.ok) {
      return reply.code(400).send({ error: result.error, approval: result.approval });
    }
    return reply.code(200).send(result);
  });
}
