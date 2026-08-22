import { TemporalIntegrityViolation } from "./temporal-guard.js";

/**
 * NYSE / NASDAQ US Equity Market Holidays (2023 - 2026).
 * Dates formatted as YYYY-MM-DD.
 */
export const US_EQUITY_HOLIDAYS: Record<string, string> = {
  // 2023 Holidays
  "2023-01-02": "New Year's Day (Observed)",
  "2023-01-16": "Martin Luther King Jr. Day",
  "2023-02-20": "Washington's Birthday (Presidents' Day)",
  "2023-04-07": "Good Friday",
  "2023-05-29": "Memorial Day",
  "2023-06-19": "Juneteenth National Independence Day",
  "2023-07-04": "Independence Day",
  "2023-09-04": "Labor Day",
  "2023-11-23": "Thanksgiving Day",
  "2023-12-25": "Christmas Day",

  // 2024 Holidays
  "2024-01-01": "New Year's Day",
  "2024-01-15": "Martin Luther King Jr. Day",
  "2024-02-19": "Washington's Birthday (Presidents' Day)",
  "2024-03-29": "Good Friday",
  "2024-05-27": "Memorial Day",
  "2024-06-19": "Juneteenth National Independence Day",
  "2024-07-04": "Independence Day",
  "2024-09-02": "Labor Day",
  "2024-11-28": "Thanksgiving Day",
  "2024-12-25": "Christmas Day",

  // 2025 Holidays
  "2025-01-01": "New Year's Day",
  "2025-01-20": "Martin Luther King Jr. Day",
  "2025-02-17": "Washington's Birthday (Presidents' Day)",
  "2025-04-18": "Good Friday",
  "2025-05-26": "Memorial Day",
  "2025-06-19": "Juneteenth National Independence Day",
  "2025-07-04": "Independence Day",
  "2025-09-01": "Labor Day",
  "2025-11-27": "Thanksgiving Day",
  "2025-12-25": "Christmas Day",

  // 2026 Holidays
  "2026-01-01": "New Year's Day",
  "2026-01-19": "Martin Luther King Jr. Day",
  "2026-02-16": "Washington's Birthday (Presidents' Day)",
  "2026-04-03": "Good Friday",
  "2026-05-25": "Memorial Day",
  "2026-06-19": "Juneteenth National Independence Day",
  "2026-07-03": "Independence Day (Observed)",
  "2026-09-07": "Labor Day",
  "2026-11-26": "Thanksgiving Day",
  "2026-12-25": "Christmas Day",
};

/**
 * NYSE / NASDAQ US Equity Early Closes (13:00 ET / 1:00 PM ET).
 * Dates formatted as YYYY-MM-DD.
 */
export const US_EQUITY_EARLY_CLOSES: Record<string, string> = {
  "2023-07-03": "Day before Independence Day (13:00 ET close)",
  "2023-11-24": "Day after Thanksgiving / Black Friday (13:00 ET close)",
  "2024-07-03": "Day before Independence Day (13:00 ET close)",
  "2024-11-29": "Day after Thanksgiving / Black Friday (13:00 ET close)",
  "2024-12-24": "Christmas Eve (13:00 ET close)",
  "2025-07-03": "Day before Independence Day (13:00 ET close)",
  "2025-11-28": "Day after Thanksgiving / Black Friday (13:00 ET close)",
  "2025-12-24": "Christmas Eve (13:00 ET close)",
  "2026-11-27": "Day after Thanksgiving / Black Friday (13:00 ET close)",
  "2026-12-24": "Christmas Eve (13:00 ET close)",
};

export interface TradingHours {
  openTimeET: string;
  closeTimeET: string;
  isEarlyClose: boolean;
  earlyCloseReason?: string;
}

/**
 * Extract YYYY-MM-DD date key from a Date or ISO string.
 */
function toDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a given calendar date is a weekend (Saturday or Sunday in UTC/ET).
 */
export function isWeekend(date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const dayOfWeek = d.getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Checks if a given calendar date is an official US equity market holiday.
 */
export function isMarketHoliday(date: Date | string): boolean {
  const key = toDateKey(date);
  return key in US_EQUITY_HOLIDAYS;
}

/**
 * Returns the holiday name if the date is a market holiday, or undefined.
 */
export function getHolidayName(date: Date | string): string | undefined {
  const key = toDateKey(date);
  return US_EQUITY_HOLIDAYS[key];
}

/**
 * Checks if a given date is a valid active trading day (not a weekend and not a holiday).
 */
export function isTradingDay(date: Date | string): boolean {
  return !isWeekend(date) && !isMarketHoliday(date);
}

/**
 * Checks if a given date has an early 13:00 ET market close.
 */
export function isEarlyClose(date: Date | string): boolean {
  const key = toDateKey(date);
  return key in US_EQUITY_EARLY_CLOSES;
}

/**
 * Returns trading hours for a given date if it is an active trading day.
 */
export function getTradingHours(date: Date | string): TradingHours | null {
  if (!isTradingDay(date)) {
    return null;
  }
  const key = toDateKey(date);
  const earlyCloseReason = US_EQUITY_EARLY_CLOSES[key];
  const isEarly = earlyCloseReason !== undefined;

  return {
    openTimeET: "09:30:00",
    closeTimeET: isEarly ? "13:00:00" : "16:00:00",
    isEarlyClose: isEarly,
    earlyCloseReason,
  };
}

/**
 * Validates whether a decision or bar timestamp falls on a legitimate trading day.
 */
export function validateTradingTimestamp(ts: Date | string): {
  isValid: boolean;
  reason?: string;
} {
  if (isWeekend(ts)) {
    return {
      isValid: false,
      reason: `Timestamp falls on a weekend (${toDateKey(ts)})`,
    };
  }

  if (isMarketHoliday(ts)) {
    const holiday = getHolidayName(ts);
    return {
      isValid: false,
      reason: `Timestamp falls on US market holiday: ${holiday} (${toDateKey(ts)})`,
    };
  }

  return { isValid: true };
}

/**
 * Guard class that asserts calendar integrity and throws TemporalIntegrityViolation on invalid dates.
 */
export class MarketCalendarGuard {
  /**
   * Asserts that a timestamp is on a valid trading day.
   * Throws TemporalIntegrityViolation if it falls on a holiday or weekend.
   */
  static assertTradingDay(ts: Date | string, context = "trading_decision"): void {
    const validation = validateTradingTimestamp(ts);
    if (!validation.isValid) {
      const tsStr = typeof ts === "string" ? ts : ts.toISOString();
      throw new TemporalIntegrityViolation(
        `[MarketCalendarGuard] Invalid ${context} timestamp: ${validation.reason}`,
        { decisionTs: tsStr, recordTs: tsStr },
      );
    }
  }

  /**
   * Filters a series of dated items (bars, news, decisions) to only those on valid trading days.
   */
  static filterTradingDays<T extends { ts?: string; timestamp?: string; asOf?: string }>(
    items: readonly T[],
  ): T[] {
    return items.filter((item) => {
      const dateStr = item.ts ?? item.timestamp ?? item.asOf;
      if (!dateStr) return true;
      return isTradingDay(dateStr);
    });
  }
}
