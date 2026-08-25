/**
 * OWNER: M4 — Platform / Risk Lead
 * Telegram Bot API client with zero-cost offline deterministic mock fallback.
 */

import type { InlineKeyboardMarkup } from "@committee/contracts";

export interface TelegramMessageOptions {
  parseMode?: "Markdown" | "HTML" | "MarkdownV2";
  disableNotification?: boolean;
  replyMarkup?: InlineKeyboardMarkup;
}

export interface DispatchedTelegramMessage {
  chatId: string | number;
  text: string;
  options?: TelegramMessageOptions;
  timestamp: string;
}

export interface AnsweredCallbackQuery {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
  timestamp: string;
}

export interface ITelegramClient {
  sendMessage(
    chatId: string | number,
    text: string,
    options?: TelegramMessageOptions,
  ): Promise<{ ok: boolean; messageId?: number; description?: string }>;
  answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    showAlert?: boolean,
  ): Promise<{ ok: boolean; description?: string }>;
  getMe(): Promise<{ ok: boolean; username?: string; description?: string }>;
  isMock(): boolean;
  getDispatchedMessages(): DispatchedTelegramMessage[];
  clearDispatchedMessages(): void;
}

/**
 * Live HTTP client using Telegram Bot API.
 */
export class TelegramHttpClient implements ITelegramClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly dispatched: DispatchedTelegramMessage[] = [];

  constructor(token: string) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  isMock(): boolean {
    return false;
  }

  getDispatchedMessages(): DispatchedTelegramMessage[] {
    return [...this.dispatched];
  }

  clearDispatchedMessages(): void {
    this.dispatched.length = 0;
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    options?: TelegramMessageOptions,
  ): Promise<{ ok: boolean; messageId?: number; description?: string }> {
    try {
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode ?? "Markdown",
        disable_notification: options?.disableNotification ?? false,
      };

      if (options?.replyMarkup) {
        payload.reply_markup = options.replyMarkup;
      }

      const res = await fetch(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        ok: boolean;
        result?: { message_id: number };
        description?: string;
      };

      if (data.ok && data.result) {
        this.dispatched.push({
          chatId,
          text,
          options,
          timestamp: new Date().toISOString(),
        });
        return { ok: true, messageId: data.result.message_id };
      }

      return {
        ok: false,
        description: data.description ?? `HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        ok: false,
        description: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    showAlert?: boolean,
  ): Promise<{ ok: boolean; description?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: showAlert ?? false,
        }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        description?: string;
      };

      return { ok: data.ok, description: data.description };
    } catch (err) {
      return {
        ok: false,
        description: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getMe(): Promise<{ ok: boolean; username?: string; description?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/getMe`);
      const data = (await res.json()) as {
        ok: boolean;
        result?: { username?: string };
        description?: string;
      };
      if (data.ok && data.result) {
        return { ok: true, username: data.result.username };
      }
      return { ok: false, description: data.description };
    } catch (err) {
      return { ok: false, description: err instanceof Error ? err.message : String(err) };
    }
  }
}

/**
 * Deterministic in-memory mock client for zero-cost offline testing and demo replay.
 */
export class DeterministicMockTelegramClient implements ITelegramClient {
  private readonly dispatched: DispatchedTelegramMessage[] = [];
  private readonly answeredCallbacks: AnsweredCallbackQuery[] = [];
  private messageCounter = 1000;

  isMock(): boolean {
    return true;
  }

  getDispatchedMessages(): DispatchedTelegramMessage[] {
    return [...this.dispatched];
  }

  clearDispatchedMessages(): void {
    this.dispatched.length = 0;
  }

  getAnsweredCallbacks(): AnsweredCallbackQuery[] {
    return [...this.answeredCallbacks];
  }

  clearAnsweredCallbacks(): void {
    this.answeredCallbacks.length = 0;
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    options?: TelegramMessageOptions,
  ): Promise<{ ok: boolean; messageId?: number; description?: string }> {
    this.messageCounter += 1;
    this.dispatched.push({
      chatId,
      text,
      options,
      timestamp: new Date().toISOString(),
    });
    return { ok: true, messageId: this.messageCounter };
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    showAlert?: boolean,
  ): Promise<{ ok: boolean; description?: string }> {
    this.answeredCallbacks.push({
      callbackQueryId,
      text,
      showAlert,
      timestamp: new Date().toISOString(),
    });
    return { ok: true };
  }

  async getMe(): Promise<{ ok: boolean; username?: string; description?: string }> {
    return { ok: true, username: "QuantAgentDemoBot" };
  }
}
