import { describe, expect, it } from "vitest";
import {
  isMarketHoliday,
  isEarlyClose,
  isTradingDay,
  isWeekend,
  getTradingHours,
  validateTradingTimestamp,
  MarketCalendarGuard,
  TemporalIntegrityViolation,
} from "../src/index.js";

describe("Market Calendar — US Equity Holiday & Schedule Verification", () => {
  it("accurately identifies US Equity market holidays across 2023–2025", () => {
    // 2023 Holidays
    expect(isMarketHoliday("2023-01-02")).toBe(true); // New Year's Day (Observed)
    expect(isMarketHoliday("2023-01-16")).toBe(true); // MLK Day
    expect(isMarketHoliday("2023-02-20")).toBe(true); // Presidents' Day
    expect(isMarketHoliday("2023-04-07")).toBe(true); // Good Friday
    expect(isMarketHoliday("2023-05-29")).toBe(true); // Memorial Day
    expect(isMarketHoliday("2023-06-19")).toBe(true); // Juneteenth
    expect(isMarketHoliday("2023-07-04")).toBe(true); // Independence Day
    expect(isMarketHoliday("2023-09-04")).toBe(true); // Labor Day
    expect(isMarketHoliday("2023-11-23")).toBe(true); // Thanksgiving Day
    expect(isMarketHoliday("2023-12-25")).toBe(true); // Christmas Day

    // 2024 Holidays
    expect(isMarketHoliday("2024-01-01")).toBe(true); // New Year's Day
    expect(isMarketHoliday("2024-01-15")).toBe(true); // MLK Day
    expect(isMarketHoliday("2024-02-19")).toBe(true); // Presidents' Day
    expect(isMarketHoliday("2024-03-29")).toBe(true); // Good Friday
    expect(isMarketHoliday("2024-05-27")).toBe(true); // Memorial Day
    expect(isMarketHoliday("2024-06-19")).toBe(true); // Juneteenth
    expect(isMarketHoliday("2024-07-04")).toBe(true); // Independence Day
    expect(isMarketHoliday("2024-09-02")).toBe(true); // Labor Day
    expect(isMarketHoliday("2024-11-28")).toBe(true); // Thanksgiving Day
    expect(isMarketHoliday("2024-12-25")).toBe(true); // Christmas Day

    // Regular trading day
    expect(isMarketHoliday("2024-01-16")).toBe(false);
    expect(isMarketHoliday("2024-05-28")).toBe(false);
  });

  it("accurately identifies 13:00 ET Early Close trading sessions", () => {
    expect(isEarlyClose("2023-07-03")).toBe(true); // Day before July 4th
    expect(isEarlyClose("2023-11-24")).toBe(true); // Black Friday
    expect(isEarlyClose("2024-07-03")).toBe(true); // Day before July 4th
    expect(isEarlyClose("2024-11-29")).toBe(true); // Black Friday
    expect(isEarlyClose("2024-12-24")).toBe(true); // Christmas Eve

    expect(isEarlyClose("2024-01-16")).toBe(false);
  });

  it("correctly identifies weekends and trading days", () => {
    // 2024-01-13 is Saturday, 2024-01-14 is Sunday
    expect(isWeekend("2024-01-13T14:30:00Z")).toBe(true);
    expect(isWeekend("2024-01-14T14:30:00Z")).toBe(true);
    expect(isWeekend("2024-01-15T14:30:00Z")).toBe(false); // Monday (Holiday, but not weekend)

    expect(isTradingDay("2024-01-13")).toBe(false); // Weekend
    expect(isTradingDay("2024-01-15")).toBe(false); // MLK Day Holiday
    expect(isTradingDay("2024-01-16")).toBe(true);  // Active Tuesday
  });

  it("computes exact trading hours for standard and early-close sessions", () => {
    const standard = getTradingHours("2024-01-16");
    expect(standard).not.toBeNull();
    expect(standard?.openTimeET).toBe("09:30:00");
    expect(standard?.closeTimeET).toBe("16:00:00");
    expect(standard?.isEarlyClose).toBe(false);

    const early = getTradingHours("2024-11-29");
    expect(early).not.toBeNull();
    expect(early?.openTimeET).toBe("09:30:00");
    expect(early?.closeTimeET).toBe("13:00:00");
    expect(early?.isEarlyClose).toBe(true);

    const holiday = getTradingHours("2024-11-28");
    expect(holiday).toBeNull();
  });

  it("validates trading timestamps and returns actionable rejection reasons", () => {
    const valid = validateTradingTimestamp("2024-02-15T15:00:00Z");
    expect(valid.isValid).toBe(true);

    const weekend = validateTradingTimestamp("2024-02-17T15:00:00Z");
    expect(weekend.isValid).toBe(false);
    expect(weekend.reason).toContain("weekend");

    const holiday = validateTradingTimestamp("2024-07-04T15:00:00Z");
    expect(holiday.isValid).toBe(false);
    expect(holiday.reason).toContain("Independence Day");
  });
});

describe("MarketCalendarGuard — Strict Enforcement & Filtering", () => {
  it("asserts trading day and throws TemporalIntegrityViolation on holidays/weekends", () => {
    expect(() => {
      MarketCalendarGuard.assertTradingDay("2024-01-16T15:00:00Z");
    }).not.toThrow();

    expect(() => {
      MarketCalendarGuard.assertTradingDay("2024-01-15T15:00:00Z", "order_execution");
    }).toThrow(TemporalIntegrityViolation);

    expect(() => {
      MarketCalendarGuard.assertTradingDay("2024-01-13T15:00:00Z", "portfolio_allocation");
    }).toThrow(TemporalIntegrityViolation);
  });

  it("filters a series of items to exclude non-trading dates", () => {
    const records = [
      { ts: "2024-01-12T14:30:00Z", label: "Friday Trade" },
      { ts: "2024-01-13T14:30:00Z", label: "Saturday Weekend" },
      { ts: "2024-01-14T14:30:00Z", label: "Sunday Weekend" },
      { ts: "2024-01-15T14:30:00Z", label: "MLK Holiday" },
      { ts: "2024-01-16T14:30:00Z", label: "Tuesday Trade" },
    ];

    const filtered = MarketCalendarGuard.filterTradingDays(records);
    expect(filtered.length).toBe(2);
    expect(filtered[0]?.label).toBe("Friday Trade");
    expect(filtered[1]?.label).toBe("Tuesday Trade");
  });
});
