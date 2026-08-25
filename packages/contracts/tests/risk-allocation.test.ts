import { describe, expect, it } from "vitest";
import {
  RiskAssessment,
  RiskConfig,
  RiskRuleResult,
  RiskStatus,
  PositionAllocation,
  AllocationConfig,
  SizingMethod,
} from "../src/index.js";

describe("Risk Contracts", () => {
  it("validates a standard RiskAssessment payload", () => {
    const validAssessment = {
      assessmentId: "a0000000-0000-0000-0000-000000000001",
      symbol: "AAPL",
      direction: "bullish",
      status: "APPROVED",
      executionAllowed: true,
      evaluatedRules: [
        {
          ruleId: "max_exposure",
          name: "Max Position Exposure",
          passed: true,
          severity: "BLOCKING",
          currentValue: 0.12,
          threshold: 0.20,
          message: "Current exposure 12% is within 20% limit",
        },
      ],
      violations: [],
      adjustedConstraints: {
        maxAllowedWeight: 0.20,
      },
      asOf: "2024-06-30T20:00:00.000Z",
      evaluatedAt: "2024-06-30T20:01:00.000Z",
    };

    const parsed = RiskAssessment.parse(validAssessment);
    expect(parsed.status).toBe("APPROVED");
    expect(parsed.executionAllowed).toBe(true);
  });

  it("rejects invalid RiskStatus", () => {
    expect(() => RiskStatus.parse("PENDING")).toThrow();
  });

  it("applies default values for RiskConfig", () => {
    const config = RiskConfig.parse({});
    expect(config.maxPositionWeight).toBe(0.20);
    expect(config.minCashReservePct).toBe(0.10);
    expect(config.maxDrawdownCircuitBreaker).toBe(0.15);
  });
});

describe("Allocation Contracts", () => {
  it("validates a PositionAllocation payload", () => {
    const validAllocation = {
      allocationId: "b0000000-0000-0000-0000-000000000001",
      symbol: "AAPL",
      direction: "bullish",
      targetWeight: 0.15,
      targetQty: 85,
      targetNotional: 15000,
      estimatedPrice: 176.47,
      sizingMethod: "fractional_kelly",
      sizingParameters: {
        kellyFraction: 0.25,
        confidence: 0.75,
      },
      rationale: "Allocated 15% equity ($15,000) using Quarter-Kelly sizing.",
      asOf: "2024-06-30T20:00:00.000Z",
      allocatedAt: "2024-06-30T20:01:00.000Z",
    };

    const parsed = PositionAllocation.parse(validAllocation);
    expect(parsed.targetQty).toBe(85);
    expect(parsed.sizingMethod).toBe("fractional_kelly");
  });

  it("applies default values for AllocationConfig", () => {
    const config = AllocationConfig.parse({});
    expect(config.defaultMethod).toBe("fractional_kelly");
    expect(config.kellyFraction).toBe(0.25);
    expect(config.maxWeightCap).toBe(0.20);
  });
});
