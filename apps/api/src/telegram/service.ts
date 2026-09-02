/**
 * OWNER: M4 — Platform / Risk Lead
 * Telegram service orchestrating outbound alerts, 2-way approval state machine, and incoming webhook dispatches.
 */

import { randomUUID } from "node:crypto";
import type {
  TelegramAlertPayload,
  TelegramEodDigestPayload,
  TelegramWebhookUpdate,
  PositionAllocation,
  RiskAssessment,
  PendingTradeApproval,
} from "@committee/contracts";
import {
  type ITelegramClient,
  TelegramHttpClient,
  DeterministicMockTelegramClient,
} from "./client.js";
import { TelegramFormatter } from "./formatter.js";
import { TelegramCommandHandler } from "./commands.js";
import { pendingTradeApprovalStore, PendingTradeApprovalStore } from "./approval-store.js";
import { ExecutionRouter } from "../execution/router.js";

export class TelegramBotService {
  private client: ITelegramClient;
  private readonly defaultChatId: string | number;
  private readonly commandHandler: TelegramCommandHandler;
  private readonly approvalStore: PendingTradeApprovalStore;
  private executionRouter: ExecutionRouter;

  constructor(options?: {
    token?: string;
    chatId?: string | number;
    customClient?: ITelegramClient;
    customApprovalStore?: PendingTradeApprovalStore;
    executionRouter?: ExecutionRouter;
  }) {
    const isTest = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
    const envToken = options?.token ?? (isTest ? undefined : process.env.TELEGRAM_BOT_TOKEN);
    const envChatId = options?.chatId ?? process.env.TELEGRAM_CHAT_ID ?? "demo-chat-id";

    this.defaultChatId = envChatId;

    if (options?.customClient) {
      this.client = options.customClient;
    } else if (envToken && envToken.trim().length > 0) {
      this.client = new TelegramHttpClient(envToken);
    } else {
      this.client = new DeterministicMockTelegramClient();
    }

    this.approvalStore = options?.customApprovalStore ?? pendingTradeApprovalStore;
    this.executionRouter = options?.executionRouter ?? new ExecutionRouter();
    this.commandHandler = new TelegramCommandHandler(undefined, this);
  }

  getClient(): ITelegramClient {
    return this.client;
  }

  setClient(client: ITelegramClient): void {
    this.client = client;
  }

  getApprovalStore(): PendingTradeApprovalStore {
    return this.approvalStore;
  }

  setExecutionRouter(router: ExecutionRouter): void {
    this.executionRouter = router;
  }

  getStatus(): {
    configured: boolean;
    mode: "live" | "mock";
    defaultChatId: string | number;
    pendingApprovalsCount: number;
  } {
    return {
      configured: !this.client.isMock(),
      mode: this.client.isMock() ? "mock" : "live",
      defaultChatId: this.defaultChatId,
      pendingApprovalsCount: this.approvalStore.list("pending").length,
    };
  }

  /**
   * Pushes a real-time trade decision alert.
   */
  async notifyTradeDecision(
    payload: TelegramAlertPayload,
    chatId?: string | number,
  ): Promise<{ ok: boolean; messageId?: number; description?: string }> {
    const targetChatId = chatId ?? this.defaultChatId;
    const formatted = TelegramFormatter.formatTradeAlert(payload);
    return this.client.sendMessage(targetChatId, formatted, { parseMode: "Markdown" });
  }

  /**
   * Dispatches an interactive 2-way approval request with inline keyboard buttons.
   */
  async requestTradeApproval(input: {
    allocation: PositionAllocation;
    riskAssessment: RiskAssessment;
    decisionTs: string;
    confidence: number;
    rationale: string;
    ttlMs?: number;
    chatId?: string | number;
  }): Promise<{ ok: boolean; messageId?: number; approval: PendingTradeApproval }> {
    const targetChatId = input.chatId ?? this.defaultChatId;
    const approvalId = randomUUID();
    const ttlMs = input.ttlMs ?? 5 * 60 * 1000; // 5 minute default TTL
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    const estimatedNotional =
      input.allocation.targetNotional > 0
        ? input.allocation.targetNotional
        : input.allocation.targetQty * input.allocation.estimatedPrice;

    const riskNotes = Array.isArray(input.riskAssessment.violations)
      ? input.riskAssessment.violations.map((v) =>
          typeof v === "string" ? v : (v as { message: string }).message,
        )
      : undefined;

    const approval = this.approvalStore.add({
      approvalId,
      symbol: input.allocation.symbol,
      direction: input.allocation.direction,
      side: input.allocation.direction === "bearish" ? "sell" : "buy",
      targetQty: input.allocation.targetQty,
      estimatedPrice: input.allocation.estimatedPrice,
      estimatedNotional,
      confidence: input.confidence,
      rationale: input.rationale,
      riskStatus: input.riskAssessment.status,
      riskNotes,
      status: "pending",
      createdAt,
      expiresAt,
      decisionTs: input.decisionTs,
    });

    const text = TelegramFormatter.formatPendingApprovalAlert(approval);
    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "✅ Approve Trade",
            callback_data: `trade:approve:${approval.approvalId}`,
          },
          {
            text: "❌ Reject Trade",
            callback_data: `trade:reject:${approval.approvalId}`,
          },
        ],
      ],
    };

    const sendRes = await this.client.sendMessage(targetChatId, text, {
      parseMode: "Markdown",
      replyMarkup,
    });

    return {
      ok: sendRes.ok,
      messageId: sendRes.messageId,
      approval,
    };
  }

  /**
   * Resolves a pending trade approval and executes if approved.
   */
  async resolveApproval(
    approvalIdOrPrefix: string,
    action: "approve" | "reject",
    resolvedBy: string = "User via Telegram",
    reason?: string,
    chatId?: string | number,
  ): Promise<{ ok: boolean; approval: PendingTradeApproval; error?: string }> {
    const existing = this.approvalStore.get(approvalIdOrPrefix);
    if (!existing) {
      return {
        ok: false,
        error: `Trade approval request "${approvalIdOrPrefix}" not found or expired.`,
        approval: undefined as unknown as PendingTradeApproval,
      };
    }

    if (existing.status !== "pending") {
      return {
        ok: false,
        error: `Trade "${existing.symbol}" was already resolved as ${existing.status.toUpperCase()}.`,
        approval: existing,
      };
    }

    let executionId: string | undefined;

    if (action === "approve") {
      // Execute through ExecutionRouter with contract-valid PositionAllocation & RiskAssessment
      const nowIso = new Date().toISOString();
      const routeRes = await this.executionRouter.execute({
        allocation: {
          allocationId: randomUUID(),
          symbol: existing.symbol,
          direction: existing.direction,
          targetQty: existing.targetQty,
          targetWeight: 0.1,
          estimatedPrice: existing.estimatedPrice,
          targetNotional: existing.estimatedNotional,
          sizingMethod: "fixed_percentage",
          sizingParameters: {},
          rationale: existing.rationale,
          asOf: existing.decisionTs,
          allocatedAt: nowIso,
        },
        riskAssessment: {
          assessmentId: randomUUID(),
          symbol: existing.symbol,
          direction: existing.direction,
          status: "APPROVED",
          executionAllowed: true,
          evaluatedRules: [],
          violations: [],
          adjustedConstraints: {},
          asOf: existing.decisionTs,
          evaluatedAt: nowIso,
        },
        decisionTs: existing.decisionTs,
      });

      executionId = routeRes.auditRecord.executionId;
    }

    const updated = this.approvalStore.resolve(existing.approvalId, {
      status: action === "approve" ? "approved" : "rejected",
      resolvedBy,
      resolutionReason: reason,
      executionId,
    });

    // Notify channel of resolution
    const resolutionText = TelegramFormatter.formatApprovalResolution(updated);
    const targetChatId = chatId ?? this.defaultChatId;
    await this.client.sendMessage(targetChatId, resolutionText, { parseMode: "Markdown" });

    return { ok: true, approval: updated };
  }

  /**
   * Pushes an End-of-Day digest.
   */
  async notifyEodDigest(
    payload: TelegramEodDigestPayload,
    chatId?: string | number,
  ): Promise<{ ok: boolean; messageId?: number; description?: string }> {
    const targetChatId = chatId ?? this.defaultChatId;
    const formatted = TelegramFormatter.formatEodDigest(payload);
    return this.client.sendMessage(targetChatId, formatted, { parseMode: "Markdown" });
  }

  /**
   * Processes incoming Telegram webhook updates (both messages and callback queries).
   */
  async handleWebhookUpdate(
    update: TelegramWebhookUpdate,
  ): Promise<{ handled: boolean; responseText?: string; error?: string }> {
    // 1. Handle Callback Queries (Inline Button Clicks)
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data.trim();
      const user = cb.from.username ? `@${cb.from.username}` : `User ${cb.from.id}`;
      const chatId = cb.message?.chat.id ?? this.defaultChatId;

      if (data.startsWith("trade:approve:") || data.startsWith("trade:reject:")) {
        const isApprove = data.startsWith("trade:approve:");
        const approvalId = isApprove
          ? data.replace("trade:approve:", "")
          : data.replace("trade:reject:", "");

        const action = isApprove ? "approve" : "reject";
        const result = await this.resolveApproval(
          approvalId,
          action,
          user,
          `Inline button clicked by ${user}`,
          chatId,
        );

        const alertText = result.ok
          ? `Trade ${action === "approve" ? "Approved" : "Rejected"}!`
          : (result.error ?? "Failed to resolve");

        await this.client.answerCallbackQuery(cb.id, alertText, !result.ok);

        return {
          handled: true,
          responseText: alertText,
          error: result.error,
        };
      }

      await this.client.answerCallbackQuery(cb.id, "Acknowledged");
      return { handled: true, responseText: "Acknowledged callback" };
    }

    // 2. Handle Text Messages & Slash Commands
    if (!update.message || !update.message.text) {
      return { handled: false, error: "no_text_or_callback_in_update" };
    }

    const chatId = update.message.chat.id;
    const text = update.message.text;

    try {
      const responseText = await this.commandHandler.handle({
        chatId,
        text,
        client: this.client,
      });
      return { handled: true, responseText };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { handled: false, error: errorMsg };
    }
  }
}

// Global shared singleton instance for the Fastify app
export const telegramBotService = new TelegramBotService();

