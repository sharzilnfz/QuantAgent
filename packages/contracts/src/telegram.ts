import { z } from "zod";

/**
 * Telegram trade alert notification payload schema.
 */
export const TelegramAlertPayload = z.object({
  symbol: z.string().min(1),
  action: z.enum(["BUY", "SELL", "HOLD"]),
  confidence: z.number().min(0).max(1),
  price: z.number().positive().optional(),
  rationale: z.string(),
  debateDissent: z.string().optional(),
  riskApproved: z.boolean(),
  riskReason: z.string().optional(),
  allocatedQty: z.number().nonnegative().optional(),
  decisionTs: z.string().datetime(),
});
export type TelegramAlertPayload = z.infer<typeof TelegramAlertPayload>;

/**
 * Telegram End-of-Day summary digest payload schema.
 */
export const TelegramEodDigestPayload = z.object({
  asOf: z.string().datetime(),
  portfolioEquity: z.number(),
  cash: z.number(),
  dayChange: z.number(),
  dayChangePercent: z.number(),
  executedTradesCount: z.number().int().nonnegative(),
  topPositions: z.array(
    z.object({
      symbol: z.string(),
      qty: z.number(),
      marketValue: z.number(),
      unrealizedPl: z.number().optional(),
    }),
  ),
});
export type TelegramEodDigestPayload = z.infer<typeof TelegramEodDigestPayload>;

/**
 * Inline keyboard button schema for interactive Telegram messages.
 */
export const InlineKeyboardButton = z.object({
  text: z.string().min(1),
  callback_data: z.string().optional(),
  url: z.string().optional(),
});
export type InlineKeyboardButton = z.infer<typeof InlineKeyboardButton>;

export const InlineKeyboardMarkup = z.object({
  inline_keyboard: z.array(z.array(InlineKeyboardButton)),
});
export type InlineKeyboardMarkup = z.infer<typeof InlineKeyboardMarkup>;

/**
 * Telegram webhook update incoming payload schema.
 */
export const TelegramWebhookUpdate = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int(),
      from: z
        .object({
          id: z.number().int(),
          is_bot: z.boolean().optional(),
          first_name: z.string().optional(),
          username: z.string().optional(),
        })
        .optional(),
      chat: z.object({
        id: z.union([z.number().int(), z.string()]),
        type: z.string().optional(),
      }),
      date: z.number().int().optional(),
      text: z.string().optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      from: z.object({
        id: z.number().int(),
        is_bot: z.boolean().optional(),
        first_name: z.string().optional(),
        username: z.string().optional(),
      }),
      message: z
        .object({
          message_id: z.number().int(),
          chat: z.object({
            id: z.union([z.number().int(), z.string()]),
            type: z.string().optional(),
          }),
          text: z.string().optional(),
        })
        .optional(),
      data: z.string(),
    })
    .optional(),
});
export type TelegramWebhookUpdate = z.infer<typeof TelegramWebhookUpdate>;

/**
 * Status enum for pending trade approvals.
 */
export const TradeApprovalStatus = z.enum(["pending", "approved", "rejected", "expired"]);
export type TradeApprovalStatus = z.infer<typeof TradeApprovalStatus>;

/**
 * Pending trade approval request schema.
 */
export const PendingTradeApproval = z.object({
  approvalId: z.string().uuid(),
  symbol: z.string().min(1),
  direction: z.enum(["bullish", "bearish", "neutral"]),
  side: z.enum(["buy", "sell"]),
  targetQty: z.number().positive(),
  estimatedPrice: z.number().positive(),
  estimatedNotional: z.number().positive(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  riskStatus: z.enum(["APPROVED", "MODIFIED", "REJECTED"]),
  riskNotes: z.array(z.string()).optional(),
  status: TradeApprovalStatus,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  decisionTs: z.string().datetime(),
  resolvedBy: z.string().optional(),
  resolvedAt: z.string().datetime().optional(),
  resolutionReason: z.string().optional(),
  executionId: z.string().uuid().optional(),
});
export type PendingTradeApproval = z.infer<typeof PendingTradeApproval>;

