import { z } from "zod";

/**
 * Portfolio state rendered by the dashboard (spec 08). `asOf` is the ISO timestamp the
 * snapshot was taken. Field names are kept aligned with spec 01's portfolio tables.
 */
export const PortfolioState = z.object({
  cash: z.number(),
  equity: z.number(),
  positions: z.array(
    z.object({
      symbol: z.string(),
      qty: z.number(),
      marketValue: z.number(),
      unrealizedPl: z.number(),
    }),
  ),
  asOf: z.string().datetime(),
});
export type PortfolioState = z.infer<typeof PortfolioState>;
