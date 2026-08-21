import { describe, expect, it } from "vitest";
import type { PositionAllocation, RiskAssessment } from "@committee/contracts";
import { DeterministicMockAlpacaClient } from "../src/execution/alpaca-client.js";
import { ExecutionRouter } from "../src/execution/router.js";

describe("Alpaca Paper ExecutionRouter (Layer 6)", () => {
  const approvedRiskAssessment: RiskAssessment = {
    assessmentId: "a0000000-0000-0000-0000-000000000001",
    symbol: "AAPL",
    direction: "bullish",
    status: "APPROVED",
    executionAllowed: true,
    evaluatedRules: [],
    violations: [],
    adjustedConstraints: {},
    asOf: "2024-06-30T20:00:00.000Z",
    evaluatedAt: "2024-06-30T20:01:00.000Z",
  };

  const sampleAllocation: PositionAllocation = {
    allocationId: "b0000000-0000-0000-0000-000000000001",
    symbol: "AAPL",
    direction: "bullish",
    targetWeight: 0.10,
    targetQty: 50,
    targetNotional: 9000,
    estimatedPrice: 180,
    sizingMethod: "fractional_kelly",
    sizingParameters: {},
    rationale: "Quarter-Kelly 50 shares",
    asOf: "2024-06-30T20:00:00.000Z",
    allocatedAt: "2024-06-30T20:01:00.000Z",
  };

  it("successfully places buy market order for approved allocation", async () => {
    const mockClient = new DeterministicMockAlpacaClient(100000);
    const router = new ExecutionRouter({ client: mockClient });

    const result = await router.execute({
      allocation: sampleAllocation,
      riskAssessment: approvedRiskAssessment,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(result.executed).toBe(true);
    expect(result.order).toBeDefined();
    expect(result.order?.symbol).toBe("AAPL");
    expect(result.order?.side).toBe("buy");
    expect(result.order?.qty).toBe(50);
    expect(result.order?.status).toBe("filled");
    expect(result.auditRecord.status).toBe("filled");

    const account = await mockClient.getAccount();
    expect(account.cash).toBe(100000 - 50 * 180);
    const positions = await mockClient.getPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0]?.symbol).toBe("AAPL");
    expect(positions[0]?.qty).toBe(50);
  });

  it("suppresses execution when Risk Gate status is REJECTED", async () => {
    const mockClient = new DeterministicMockAlpacaClient(100000);
    const router = new ExecutionRouter({ client: mockClient });

    const rejectedRisk: RiskAssessment = {
      ...approvedRiskAssessment,
      status: "REJECTED",
      executionAllowed: false,
      violations: [
        {
          ruleId: "max_exposure",
          name: "Max Exposure",
          passed: false,
          severity: "BLOCKING",
          message: "Exposure exceeded",
        },
      ],
    };

    const result = await router.execute({
      allocation: sampleAllocation,
      riskAssessment: rejectedRisk,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(result.executed).toBe(false);
    expect(result.order).toBeUndefined();
    expect(result.reason).toContain("Execution blocked by Risk Gate");
    expect(result.auditRecord.status).toBe("rejected");

    const positions = await mockClient.getPositions();
    expect(positions).toHaveLength(0);
  });

  it("handles zero quantity allocations without placing broker orders", async () => {
    const mockClient = new DeterministicMockAlpacaClient(100000);
    const router = new ExecutionRouter({ client: mockClient });

    const zeroAllocation: PositionAllocation = {
      ...sampleAllocation,
      targetQty: 0,
      targetNotional: 0,
    };

    const result = await router.execute({
      allocation: zeroAllocation,
      riskAssessment: approvedRiskAssessment,
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(result.executed).toBe(false);
    expect(result.reason).toContain("target quantity is 0");
  });

  it("routes sell orders on bearish liquidations", async () => {
    const mockClient = new DeterministicMockAlpacaClient(100000);
    // Seed existing position of 50 AAPL shares
    await mockClient.placeOrder({
      symbol: "AAPL",
      side: "buy",
      qty: 50,
      type: "market",
      timeInForce: "day",
    });

    const router = new ExecutionRouter({ client: mockClient });

    const bearishAllocation: PositionAllocation = {
      ...sampleAllocation,
      direction: "bearish",
      targetQty: 50,
    };

    const result = await router.execute({
      allocation: bearishAllocation,
      riskAssessment: { ...approvedRiskAssessment, direction: "bearish" },
      decisionTs: "2024-06-30T20:00:00.000Z",
    });

    expect(result.executed).toBe(true);
    expect(result.order?.side).toBe("sell");
    expect(result.order?.qty).toBe(50);

    const positions = await mockClient.getPositions();
    expect(positions).toHaveLength(0); // Liquidated completely
  });
});
