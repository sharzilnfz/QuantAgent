import { z } from "zod";
import { Direction } from "./enums.js";

/**
 * Mathematical position sizing methodology employed by L5 Position Allocator.
 * - `fractional_kelly`: Sizing using conservative fractional Kelly formula scaled by agent confidence.
 * - `volatility_parity`: Sizing scaled inversely to asset volatility to normalize risk contribution.
 * - `fixed_percentage`: Sizing based on fixed proportion of available portfolio equity.
 */
export const SizingMethod = z.enum([
  "fractional_kelly",
  "volatility_parity",
  "fixed_percentage",
]);
export type SizingMethod = z.infer<typeof SizingMethod>;

/**
 * Deterministic output produced by the L5 Position Allocator.
 */
export const PositionAllocation = z.object({
  allocationId: z.string().uuid(),
  symbol: z.string(),
  direction: Direction,
  targetWeight: z.number().min(0).max(1),
  targetQty: z.number().nonnegative(),
  targetNotional: z.number().nonnegative(),
  estimatedPrice: z.number().positive(),
  sizingMethod: SizingMethod,
  sizingParameters: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  rationale: z.string().min(1).max(2000),
  asOf: z.string().datetime(),
  allocatedAt: z.string().datetime(),
});
export type PositionAllocation = z.infer<typeof PositionAllocation>;

/**
 * Configuration options for the mathematical position allocator.
 */
export const AllocationConfig = z.object({
  /** Default sizing algorithm to use. */
  defaultMethod: SizingMethod.default("fractional_kelly"),
  /** Multiplier applied to full Kelly fraction (e.g. 0.25 = quarter-Kelly for safety). */
  kellyFraction: z.number().min(0.01).max(1.0).default(0.25),
  /** Target annualized portfolio volatility for volatility parity sizing (e.g. 0.15 = 15%). */
  targetVolatility: z.number().positive().default(0.15),
  /** Fixed allocation fraction of equity when using fixed_percentage sizing (e.g. 0.05 = 5%). */
  fixedPercentage: z.number().min(0.01).max(1.0).default(0.05),
  /** Hard upper bound on single-asset target allocation weight regardless of sizing calculation. */
  maxWeightCap: z.number().min(0.01).max(1.0).default(0.20),
  /** Minimum cash buffer fraction preserved for uninvested liquidity (e.g. 0.05 = 5%). */
  cashBuffer: z.number().min(0).max(0.5).default(0.05),
  /** Rolling window of daily bars used to calculate historical realized volatility. */
  volatilityLookback: z.number().int().min(5).max(100).default(20),
  /** Default reward-to-risk payout ratio (b) for Kelly sizing if unspecified. */
  defaultPayoffRatio: z.number().positive().default(1.5),
});
export type AllocationConfig = z.infer<typeof AllocationConfig>;
