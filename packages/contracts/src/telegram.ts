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
});
export type TelegramWebhookUpdate = z.infer<typeof TelegramWebhookUpdate>;
