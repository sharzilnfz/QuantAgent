import { randomUUID } from "node:crypto";
import {
  type PositionAllocation,
  type RiskAssessment,
  type OrderResult,
  type OrderRequest,
  ExecutionAuditRecord,
} from "@committee/contracts";
import { TemporalGuard } from "@committee/fixtures";
import { type IAlpacaClient, DeterministicMockAlpacaClient } from "./alpaca-client.js";

export interface ExecutionRouterOptions {
  client?: IAlpacaClient;
}

export interface RouteExecutionResult {
  executed: boolean;
  order?: OrderResult;
  auditRecord: ExecutionAuditRecord;
  reason?: string;
}

export class ExecutionRouter {
  private readonly client: IAlpacaClient;

  constructor(options: ExecutionRouterOptions = {}) {
    this.client = options.client ?? new DeterministicMockAlpacaClient();
  }

  /**
   * Routes an approved PositionAllocation to Alpaca Paper API.
   */
  async execute(input: {
    allocation: PositionAllocation;
    riskAssessment: RiskAssessment;
    decisionTs: string;
  }): Promise<RouteExecutionResult> {
    const { allocation, riskAssessment, decisionTs } = input;

    // Temporal Point-in-Time discipline
    TemporalGuard.assertNoLeakage([allocation], decisionTs, "PositionAllocation");
    TemporalGuard.assertNoLeakage([riskAssessment], decisionTs, "RiskAssessment");

    const executionId = randomUUID();

    // Guard: Risk gate must approve execution
    if (!riskAssessment.executionAllowed || riskAssessment.status === "REJECTED") {
      const auditRecord = ExecutionAuditRecord.parse({
        executionId,
        allocationId: allocation.allocationId,
        orderId: "NONE",
        symbol: allocation.symbol,
        direction: allocation.direction,
        side: allocation.direction === "bearish" ? "sell" : "buy",
        qty: 0,
        notional: 0,
        status: "rejected",
        asOf: decisionTs,
        executedAt: new Date().toISOString(),
      });

      return {
        executed: false,
        auditRecord,
        reason: `Execution blocked by Risk Gate (status: ${riskAssessment.status}).`,
      };
    }

    // Guard: Zero quantity allocation (e.g. neutral or already at target)
    if (allocation.targetQty <= 0) {
      const auditRecord = ExecutionAuditRecord.parse({
        executionId,
        allocationId: allocation.allocationId,
        orderId: "NONE",
        symbol: allocation.symbol,
        direction: allocation.direction,
        side: allocation.direction === "bearish" ? "sell" : "buy",
        qty: 0,
        notional: 0,
        status: "canceled",
        asOf: decisionTs,
        executedAt: new Date().toISOString(),
      });

      return {
        executed: false,
        auditRecord,
        reason: `Allocation target quantity is 0 shares. No broker order generated.`,
      };
    }

    const side: OrderRequest["side"] = allocation.direction === "bearish" ? "sell" : "buy";

    const orderReq: OrderRequest = {
      symbol: allocation.symbol,
      side,
      qty: allocation.targetQty,
      type: "market",
      timeInForce: "day",
      allocationId: allocation.allocationId,
    };

    const orderResult = await this.client.placeOrder(orderReq);

    const executedPrice = orderResult.filledAvgPrice ?? allocation.estimatedPrice;
    const executedNotional = orderResult.filledQty * executedPrice;

    const auditRecord = ExecutionAuditRecord.parse({
      executionId,
      allocationId: allocation.allocationId,
      orderId: orderResult.orderId,
      symbol: allocation.symbol,
      direction: allocation.direction,
      side,
      qty: orderResult.filledQty,
      notional: executedNotional,
      status: orderResult.status,
      executedPrice,
      asOf: decisionTs,
      executedAt: orderResult.filledAt ?? new Date().toISOString(),
    });

    return {
      executed: orderResult.status === "filled" || orderResult.status === "accepted",
      order: orderResult,
      auditRecord,
    };
  }
}
