import { z } from "zod";

/**
 * SEC EDGAR Filing Types.
 */
export const FilingType = z.enum(["10-Q", "10-K", "8-K"]);
export type FilingType = z.infer<typeof FilingType>;

/**
 * Fiscal reporting period.
 */
export const FiscalPeriod = z.enum(["Q1", "Q2", "Q3", "Q4", "FY"]);
export type FiscalPeriod = z.infer<typeof FiscalPeriod>;

/**
 * Point-in-time financial statement report from SEC EDGAR XBRL company facts.
 *
 * CRITICAL POINT-IN-TIME DISCIPLINE:
 * `periodEndDate` is when the fiscal period ended (e.g. 2023-09-30).
 * `filedAt` is when the SEC EDGAR system officially accepted the filing (e.g. 2023-11-03T18:00:00Z).
 * `asOf` MUST be >= `filedAt` (the exact moment this report became knowable to the market).
 * It is a fatal look-ahead bias violation to treat `periodEndDate` as knowable on or before `filedAt`.
 */
export const FundamentalReport = z.object({
  id: z.string(),
  symbol: z.string(),
  cik: z.string().optional(),
  form: FilingType,
  fiscalYear: z.number().int(),
  fiscalPeriod: FiscalPeriod,
  periodEndDate: z.string(), // ISO date (YYYY-MM-DD)
  filedAt: z.string().datetime(), // SEC acceptanceDateTime
  asOf: z.string().datetime(), // strictly >= filedAt

  // Income Statement
  revenue: z.number(),
  grossProfit: z.number(),
  operatingIncome: z.number(),
  netIncome: z.number(),
  eps: z.number().nullable().optional(),

  // Balance Sheet
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  stockholdersEquity: z.number(),
  currentAssets: z.number().nullable().optional(),
  currentLiabilities: z.number().nullable().optional(),
  cashAndEquivalents: z.number().nullable().optional(),
  totalDebt: z.number().nullable().optional(),

  // Cash Flow
  operatingCashFlow: z.number(),
  capitalExpenditures: z.number().optional(),
  freeCashFlow: z.number(),

  // Pre-computed deterministic ratios (Facts vs Narration)
  grossMargin: z.number(), // grossProfit / revenue
  operatingMargin: z.number(), // operatingIncome / revenue
  netMargin: z.number(), // netIncome / revenue
  debtToEquity: z.number(), // totalLiabilities / stockholdersEquity
  currentRatio: z.number().nullable().optional(), // currentAssets / currentLiabilities
  revenueGrowthYoY: z.number().nullable().optional(), // YoY growth vs same quarter last year
});
export type FundamentalReport = z.infer<typeof FundamentalReport>;
