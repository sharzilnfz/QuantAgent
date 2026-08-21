/**
 * OWNER: M4 — Platform / Risk Lead
 * Telegram service orchestrating outbound alerts and incoming webhook dispatches.
 */

import type {
  TelegramAlertPayload,
  TelegramEodDigestPayload,
  TelegramWebhookUpdate,
} from "@committee/contracts";
import {
  type ITelegramClient,
  TelegramHttpClient,
  DeterministicMockTelegramClient,
} from "./client.js";
import { TelegramFormatter } from "./formatter.js";
import { TelegramCommandHandler } from "./commands.js";

export class TelegramBotService {
  private client: ITelegramClient;
  private readonly defaultChatId: string | number;
  private readonly commandHandler: TelegramCommandHandler;

  constructor(options?: {
    token?: string;
    chatId?: string | number;
    customClient?: ITelegramClient;
  }) {
    const envToken = options?.token ?? process.env.TELEGRAM_BOT_TOKEN;
    const envChatId = options?.chatId ?? process.env.TELEGRAM_CHAT_ID ?? "demo-chat-id";

    this.defaultChatId = envChatId;

    if (options?.customClient) {
      this.client = options.customClient;
    } else if (envToken && envToken.trim().length > 0) {
      this.client = new TelegramHttpClient(envToken);
    } else {
      this.client = new DeterministicMockTelegramClient();
    }

    this.commandHandler = new TelegramCommandHandler();
  }

  getClient(): ITelegramClient {
    return this.client;
  }

  setClient(client: ITelegramClient): void {
    this.client = client;
  }

  getStatus(): { configured: boolean; mode: "live" | "mock"; defaultChatId: string | number } {
    return {
      configured: !this.client.isMock(),
      mode: this.client.isMock() ? "mock" : "live",
      defaultChatId: this.defaultChatId,
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
   * Processes incoming Telegram webhook updates.
   */
  async handleWebhookUpdate(
    update: TelegramWebhookUpdate,
  ): Promise<{ handled: boolean; responseText?: string; error?: string }> {
    if (!update.message || !update.message.text) {
      return { handled: false, error: "no_text_in_message" };
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
