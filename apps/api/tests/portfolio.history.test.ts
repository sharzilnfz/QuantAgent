import { describe, it, expect, beforeEach } from "vitest";
import { getPortfolioHistory, getPortfolioState, recordPortfolioSnapshot } from "../src/portfolio/service.js";
import { PortfolioState } from "@committee/contracts";

describe("Portfolio History Snapshots & Time-Series Tracking", () => {
  const testUserId = "00000000-0000-0000-0000-000000000001";

  it("getPortfolioState produces contract-valid state and registers a snapshot", async () => {
    const state = await getPortfolioState(testUserId);
    expect(PortfolioState.safeParse(state).success).toBe(true);
    expect(typeof state.cash).toBe("number");
    expect(typeof state.equity).toBe("number");
    expect(Array.isArray(state.positions)).toBe(true);
    expect(typeof state.asOf).toBe("string");
  });

  it("getPortfolioHistory returns >= 2 points for chart rendering", async () => {
    const history = await getPortfolioHistory(testUserId);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(2);

    for (const point of history) {
      expect(typeof point.asOf).toBe("string");
      expect(typeof point.equity).toBe("number");
      expect(point.equity).toBeGreaterThan(0);
    }
  });

  it("recordPortfolioSnapshot accumulates sequential point-in-time snapshots", async () => {
    const customUser = "00000000-0000-0000-0000-000000000002";
    const ts1 = "2024-01-10T21:00:00.000Z";
    const ts2 = "2024-01-11T21:00:00.000Z";

    await recordPortfolioSnapshot(customUser, {
      cash: 50000,
      equity: 105000,
      positions: [{ symbol: "AAPL", qty: 200, marketValue: 55000, unrealizedPl: 5000 }],
      asOf: ts1,
    });

    await recordPortfolioSnapshot(customUser, {
      cash: 50000,
      equity: 108000,
      positions: [{ symbol: "AAPL", qty: 200, marketValue: 58000, unrealizedPl: 8000 }],
      asOf: ts2,
    });

    const history = await getPortfolioHistory(customUser);
    expect(history.length).toBe(2);
    expect(history[0]?.asOf).toBe(ts1);
    expect(history[0]?.equity).toBe(105000);
    expect(history[1]?.asOf).toBe(ts2);
    expect(history[1]?.equity).toBe(108000);
  });
});
