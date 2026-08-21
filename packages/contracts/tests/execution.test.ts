import { describe, expect, it } from "vitest";
import {
  OrderRequest,
  OrderResult,
  OrderStatus,
  ExecutionAuditRecord,
} from "../src/index.js";

describe("Execution Contracts", () => {
  it("validates an OrderRequest payload with defaults", () => {
    const validRequest = {
      symbol: "AAPL",
      side: "buy",
      qty: 50,
    };

    const parsed = OrderRequest.parse(validRequest);
    expect(parsed.type).toBe("market");
    expect(parsed.timeInForce).toBe("day");
    expect(parsed.qty).toBe(50);
  });

  it("validates an OrderResult payload", () => {
    const validResult = {
      orderId: "alpaca-order-12345",
      clientOrderId: "committee-client-12345",
      symbol: "AAPL",
      side: "buy",
      qty: 50,
      filledQty: 50,
      filledAvgPrice: 185.25,
      type: "market",
      status: "filled",
      timeInForce: "day",
      submittedAt: "2024-06-30T20:00:00.000Z",
      filledAt: "2024-06-30T20:00:01.000Z",
    };

    const parsed = OrderResult.parse(validResult);
    expect(parsed.status).toBe("filled");
    expect(parsed.filledAvgPrice).toBe(185.25);
  });

  it("validates ExecutionAuditRecord payload", () => {
    const validAudit = {
      executionId: "c0000000-0000-0000-0000-000000000001",
      allocationId: "b0000000-0000-0000-0000-000000000001",
      orderId: "alpaca-order-12345",
      symbol: "AAPL",
      direction: "bullish",
      side: "buy",
      qty: 50,
      notional: 9262.5,
      status: "filled",
      executedPrice: 185.25,
      asOf: "2024-06-30T20:00:00.000Z",
      executedAt: "2024-06-30T20:00:01.000Z",
    };

    const parsed = ExecutionAuditRecord.parse(validAudit);
    expect(parsed.symbol).toBe("AAPL");
    expect(parsed.status).toBe("filled");
  });

  it("rejects invalid OrderStatus", () => {
    expect(() => OrderStatus.parse("unknown_status")).toThrow();
  });
});
