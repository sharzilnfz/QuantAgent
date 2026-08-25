import { describe, expect, it } from "vitest";
import { getPortfolioState, getPortfolioHistory } from "../src/portfolio/service.js";

describe("Live Portfolio Sync Service", () => {
  it("fetches and returns a contract-valid PortfolioState from broker client", async () => {
    const portfolio = await getPortfolioState("user-test-001");

    expect(portfolio.asOf).toBeDefined();
    expect(portfolio.cash).toBeGreaterThanOrEqual(0);
    expect(portfolio.equity).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(portfolio.positions)).toBe(true);
  });

  it("fetches and returns portfolio history", async () => {
    const history = await getPortfolioHistory("user-test-001");

    expect(Array.isArray(history)).toBe(true);
    if (history.length > 0) {
      expect(history[0]?.equity).toBeGreaterThanOrEqual(0);
      expect(history[0]?.asOf).toBeDefined();
    }
  });
});
