import { z } from "zod";
import { PriceBar, IndicatorSnapshot } from "./signals";

/**
 * Signal emitted by a strategy for a bar.
 * Can be a discrete directional stance ("buy", "sell", "neutral")
 * or a target portfolio allocation in [-1.0, 1.0] (1.0 = 100% long, 0.0 = flat/cash, -1.0 = 100% short).
 */
export const SignalType = z.union([
  z.enum(["buy", "sell", "neutral"]),
  z.number().min(-1).max(1),
]);
export type SignalType = z.infer<typeof SignalType>;

/**
 * An individual executed trade record.
 */
export const Trade = z.object({
  ts: z.string(),
  price: z.number(),
  fromPosition: z.number(),
  toPosition: z.number(),
  shares: z.number(),
  value: z.number(),
  fee: z.number(),
});
export type Trade = z.infer<typeof Trade>;

/**
 * Point on the simulated equity curve at the close of a bar.
 */
export const EquityPoint = z.object({
  ts: z.string(),
  cash: z.number(),
  position: z.number(),
  price: z.number(),
  equity: z.number(),
  drawdown: z.number(),
});
export type EquityPoint = z.infer<typeof EquityPoint>;

/**
 * Standard financial performance metrics computed across a backtest run.
 */
export const FinancialMetrics = z.object({
  initialCash: z.number(),
  finalEquity: z.number(),
  totalReturn: z.number(),
  annualizedReturn: z.number(),
  sharpeRatio: z.number(),
  sortinoRatio: z.number(),
  maxDrawdown: z.number(),
  totalTurnover: z.number(),
  tradeCount: z.number(),
  winRate: z.number(),
  profitFactor: z.number(),
});
export type FinancialMetrics = z.infer<typeof FinancialMetrics>;

/**
 * Full output payload of a strategy backtest run.
 */
export const BacktestResult = FinancialMetrics.extend({
  strategy: z.string(),
  trades: z.array(Trade),
  equityCurve: z.array(EquityPoint),
});
export type BacktestResult = z.infer<typeof BacktestResult>;

/**
 * Trade executed on an individual asset within a multi-asset portfolio.
 */
export const MultiAssetTrade = Trade.extend({
  symbol: z.string(),
});
export type MultiAssetTrade = z.infer<typeof MultiAssetTrade>;

/**
 * Snapshot of a specific asset's position within a multi-asset portfolio at a point in time.
 */
export const AssetPositionSnapshot = z.object({
  symbol: z.string(),
  shares: z.number(),
  price: z.number(),
  marketValue: z.number(),
  weight: z.number(), // Fraction of total portfolio equity [0.0, 1.0]
});
export type AssetPositionSnapshot = z.infer<typeof AssetPositionSnapshot>;

/**
 * Point on the multi-asset simulated equity curve at the close of a synchronized timestamp.
 */
export const MultiAssetEquityPoint = z.object({
  ts: z.string(),
  cash: z.number(),
  cashWeight: z.number(),
  totalEquity: z.number(),
  drawdown: z.number(),
  positions: z.record(z.string(), AssetPositionSnapshot),
});
export type MultiAssetEquityPoint = z.infer<typeof MultiAssetEquityPoint>;

/**
 * Full output payload of a multi-asset portfolio strategy backtest run.
 */
export const MultiAssetBacktestResult = FinancialMetrics.extend({
  strategy: z.string(),
  symbols: z.array(z.string()),
  trades: z.array(MultiAssetTrade),
  equityCurve: z.array(MultiAssetEquityPoint),
  perAssetTurnover: z.record(z.string(), z.number()).default({}),
  perAssetTradeCount: z.record(z.string(), z.number()).default({}),
});
export type MultiAssetBacktestResult = z.infer<typeof MultiAssetBacktestResult>;

/**
 * Configuration options for simulation execution.
 */
export const BacktestOptions = z.object({
  initialCash: z.number().positive().optional(),
  feeBps: z.number().min(0).optional(),
  slippageBps: z.number().min(0).optional(),
  annualTradingDays: z.number().positive().optional(),
  cashReserve: z.number().min(0).max(1).default(0.05).optional(),
});
export type BacktestOptions = z.infer<typeof BacktestOptions>;

/**
 * Interface that all backtestable strategies must implement.
 */
export interface Strategy {
  name: string;
  generateSignals(
    bars: PriceBar[],
    snapshots?: IndicatorSnapshot[],
  ): SignalType[] | Promise<SignalType[]>;
}

/**
 * Interface for strategies evaluating multi-asset universes.
 */
export interface MultiAssetStrategy {
  name: string;
  generateMultiAssetSignals(
    universeBars: Record<string, PriceBar[]>,
    snapshotsBySymbol?: Record<string, IndicatorSnapshot[]>,
  ): Record<string, SignalType>[] | Promise<Record<string, SignalType>[]>;
}

