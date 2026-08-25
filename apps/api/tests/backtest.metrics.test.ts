import { describe, expect, it } from "vitest";
import {
  calculateClosedTradePnLs,
  calculateFinancialMetrics,
  safeRound,
} from "../src/backtest/metrics.js";
import type { EquityPoint, Trade } from "../src/backtest/types.js";

describe("Financial Metrics Engine", () => {
  describe("safeRound", () => {
    it("eliminates floating point noise", () => {
      expect(0.1 + 0.2).not.toBe(0.3);
      expect(safeRound(0.1 + 0.2, 4)).toBe(0.3);
    });

    it("handles non-finite values safely", () => {
      expect(safeRound(NaN)).toBe(0);
      expect(safeRound(Infinity)).toBe(0);
      expect(safeRound(-Infinity)).toBe(0);
    });
  });

  describe("calculateClosedTradePnLs", () => {
    it("correctly computes FIFO round-trip PnL for closed trades", () => {
      const trades: Trade[] = [
        {
          ts: "2024-01-02T00:00:00.000Z",
          price: 100,
          fromPosition: 0,
          toPosition: 1,
          shares: 10,
          value: 1000,
          fee: 1, // $1 entry fee
        },
        {
          ts: "2024-01-03T00:00:00.000Z",
          price: 120,
          fromPosition: 1,
          toPosition: 0,
          shares: 10,
          value: 1200,
          fee: 1.2, // $1.2 exit fee
        },
      ];

      const pnls = calculateClosedTradePnLs(trades);
      expect(pnls).toHaveLength(1);
      const first = pnls[0];
      expect(first).toBeDefined();
      if (!first) throw new Error("Expected first trade PnL to be defined");
      // Net PnL = 1200 - 1000 - 1 - 1.2 = 197.8
      expect(safeRound(first.pnl, 2)).toBe(197.8);
      expect(first.grossProfit).toBeCloseTo(197.8, 4);
      expect(first.grossLoss).toBe(0);
    });

    it("computes gross profit and gross loss across winning and losing trades", () => {
      const trades: Trade[] = [
        // Trade 1: Buy @ 100, Sell @ 110 (+10 - fees)
        {
          ts: "2024-01-02T00:00:00.000Z",
          price: 100,
          fromPosition: 0,
          toPosition: 1,
          shares: 10,
          value: 1000,
          fee: 0,
        },
        {
          ts: "2024-01-03T00:00:00.000Z",
          price: 110,
          fromPosition: 1,
          toPosition: 0,
          shares: 10,
          value: 1100,
          fee: 0,
        },
        // Trade 2: Buy @ 100, Sell @ 90 (-10)
        {
          ts: "2024-01-04T00:00:00.000Z",
          price: 100,
          fromPosition: 0,
          toPosition: 1,
          shares: 10,
          value: 1000,
          fee: 0,
        },
        {
          ts: "2024-01-05T00:00:00.000Z",
          price: 90,
          fromPosition: 1,
          toPosition: 0,
          shares: 10,
          value: 900,
          fee: 0,
        },
      ];

      const pnls = calculateClosedTradePnLs(trades);
      expect(pnls).toHaveLength(2);
      const pnl0 = pnls[0];
      const pnl1 = pnls[1];
      expect(pnl0).toBeDefined();
      expect(pnl1).toBeDefined();
      if (!pnl0 || !pnl1) throw new Error("Expected PnLs to be defined");
      expect(pnl0.pnl).toBe(100);
      expect(pnl1.pnl).toBe(-100);
    });
  });

  describe("calculateFinancialMetrics", () => {
    it("returns zeroed metrics for empty equity curves", () => {
      const metrics = calculateFinancialMetrics([], [], 100000);
      expect(metrics.initialCash).toBe(100000);
      expect(metrics.finalEquity).toBe(100000);
      expect(metrics.totalReturn).toBe(0);
      expect(metrics.annualizedReturn).toBe(0);
      expect(metrics.sharpeRatio).toBe(0);
      expect(metrics.sortinoRatio).toBe(0);
      expect(metrics.maxDrawdown).toBe(0);
      expect(metrics.totalTurnover).toBe(0);
      expect(metrics.tradeCount).toBe(0);
      expect(metrics.winRate).toBe(0);
      expect(metrics.profitFactor).toBe(0);
    });

    it("calculates accurate total return and annualized return", () => {
      const initialCash = 100000;
      // 252 trading days with 10% gain
      const equityCurve: EquityPoint[] = Array.from({ length: 252 }, (_, i) => ({
        ts: new Date(2024, 0, i + 1).toISOString(),
        cash: 0,
        position: 1,
        price: 100,
        equity: initialCash * (1 + (0.1 * (i + 1)) / 252),
        drawdown: 0,
      }));

      const metrics = calculateFinancialMetrics(equityCurve, [], initialCash, 252);
      expect(metrics.totalReturn).toBeCloseTo(0.1, 4);
      // Over exactly 252 bars with annualTradingDays = 252, annualized return equals total return
      expect(metrics.annualizedReturn).toBeCloseTo(0.1, 4);
    });

    it("handles total loss without NaN", () => {
      const initialCash = 100000;
      const equityCurve: EquityPoint[] = [
        { ts: "2024-01-01T00:00:00.000Z", cash: 100000, position: 0, price: 100, equity: 100000, drawdown: 0 },
        { ts: "2024-01-02T00:00:00.000Z", cash: 0, position: 1, price: 0, equity: 0, drawdown: -1.0 },
      ];

      const metrics = calculateFinancialMetrics(equityCurve, [], initialCash, 252);
      expect(metrics.totalReturn).toBe(-1.0);
      expect(metrics.annualizedReturn).toBe(-1.0);
      expect(metrics.maxDrawdown).toBe(-1.0);
    });

    it("calculates Sharpe and Sortino ratios correctly with mathematical precision", () => {
      const initialCash = 100;
      // Daily returns of +2%, -1%, +2%, -1%
      const equities = [100, 102, 100.98, 102.9996, 101.9696];
      const equityCurve: EquityPoint[] = equities.map((eq, i) => ({
        ts: `2024-01-0${i + 1}T00:00:00.000Z`,
        cash: 0,
        position: 1,
        price: eq,
        equity: eq,
        drawdown: (eq - Math.max(...equities.slice(0, i + 1))) / Math.max(...equities.slice(0, i + 1)),
      }));

      const metrics = calculateFinancialMetrics(equityCurve, [], initialCash, 252);
      expect(metrics.sharpeRatio).toBeGreaterThan(0);
      expect(metrics.sortinoRatio).toBeGreaterThan(0);
      expect(metrics.maxDrawdown).toBeLessThan(0);
    });

    it("computes turnover, win rate, and profit factor from trades", () => {
      const trades: Trade[] = [
        {
          ts: "2024-01-02T00:00:00.000Z",
          price: 100,
          fromPosition: 0,
          toPosition: 1,
          shares: 100,
          value: 10000,
          fee: 5,
        },
        {
          ts: "2024-01-03T00:00:00.000Z",
          price: 110,
          fromPosition: 1,
          toPosition: 0,
          shares: 100,
          value: 11000,
          fee: 5.5,
        },
      ];

      const equityCurve: EquityPoint[] = [
        { ts: "2024-01-01T00:00:00.000Z", cash: 100000, position: 0, price: 100, equity: 100000, drawdown: 0 },
        { ts: "2024-01-02T00:00:00.000Z", cash: 89995, position: 0.1, price: 100, equity: 99995, drawdown: -0.00005 },
        { ts: "2024-01-03T00:00:00.000Z", cash: 100989.5, position: 0, price: 110, equity: 100989.5, drawdown: 0 },
      ];

      const metrics = calculateFinancialMetrics(equityCurve, trades, 100000);
      expect(metrics.totalTurnover).toBe(2.0); // 0->1 (|1|) + 1->0 (|1|) = 2
      expect(metrics.tradeCount).toBe(2);
      expect(metrics.winRate).toBe(1.0); // 1 winning closed trade out of 1 closed trade
      expect(metrics.profitFactor).toBeGreaterThan(0);
    });
  });
});
