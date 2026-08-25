import { z } from "zod";
import { Direction } from "./enums.js";

/**
 * Side of an order submitted to broker (buy / sell).
 */
export const OrderSide = z.enum(["buy", "sell"]);
export type OrderSide = z.infer<typeof OrderSide>;

/**
 * Order type supported on Alpaca Paper API.
 */
export const OrderType = z.enum(["market", "limit", "stop", "stop_limit"]);
export type OrderType = z.infer<typeof OrderType>;

/**
 * Time-in-force designation for the order.
 */
export const TimeInForce = z.enum(["day", "gtc", "ioc", "fok"]);
export type TimeInForce = z.infer<typeof TimeInForce>;

/**
 * Lifecycle status of an order as reported by Alpaca Paper API.
 */
export const OrderStatus = z.enum([
  "new",
  "accepted",
  "pending_new",
  "partially_filled",
  "filled",
  "done_for_day",
  "canceled",
  "expired",
  "replaced",
  "pending_cancel",
  "pending_replace",
  "stopped",
  "rejected",
  "suspended",
  "calculated",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

/**
 * Request payload to submit an order to Alpaca Paper Trading.
 */
export const OrderRequest = z.object({
  symbol: z.string(),
  side: OrderSide,
  qty: z.number().positive(),
  type: OrderType.default("market"),
  timeInForce: TimeInForce.default("day"),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  clientOrderId: z.string().optional(),
  allocationId: z.string().uuid().optional(),
});
export type OrderRequest = z.infer<typeof OrderRequest>;

/**
 * Result returned after submitting or querying an order from Alpaca Paper API.
 */
export const OrderResult = z.object({
  orderId: z.string(),
  clientOrderId: z.string(),
  symbol: z.string(),
  side: OrderSide,
  qty: z.number().positive(),
  filledQty: z.number().nonnegative(),
  filledAvgPrice: z.number().positive().nullable().optional(),
  type: OrderType,
  status: OrderStatus,
  timeInForce: TimeInForce,
  submittedAt: z.string().datetime(),
  filledAt: z.string().datetime().nullable().optional(),
  rawBrokerResponse: z.record(z.string(), z.unknown()).optional(),
});
export type OrderResult = z.infer<typeof OrderResult>;

/**
 * Structured audit record logging trade execution across the system.
 */
export const ExecutionAuditRecord = z.object({
  executionId: z.string().uuid(),
  allocationId: z.string().uuid().optional(),
  orderId: z.string(),
  symbol: z.string(),
  direction: Direction,
  side: OrderSide,
  qty: z.number().nonnegative(),
  notional: z.number().nonnegative(),
  status: OrderStatus,
  executedPrice: z.number().positive().optional(),
  asOf: z.string().datetime(),
  executedAt: z.string().datetime(),
});
export type ExecutionAuditRecord = z.infer<typeof ExecutionAuditRecord>;
