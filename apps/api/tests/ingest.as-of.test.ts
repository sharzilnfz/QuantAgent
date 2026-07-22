import { describe, expect, it } from "vitest";

import {
  MARKET_TIMEZONE,
  SESSION_CLOSE_HOUR_ET,
  computeAsOf,
  sessionCloseUtc,
} from "../src/ingest/as-of.js";

/**
 * The `as_of` rule is the crux of spec 04. These tests pin it exactly:
 *
 *   1Day  → 16:00 America/New_York on the bar's own session date
 *   1Hour → ts + 1 hour
 *
 * An `as_of` that is too EARLY is a look-ahead bug. These assertions are the
 * tripwire; loosening them requires a spec change, not a test edit.
 */

/** Independent oracle: format an instant in market-local time. */
function inMarketTime(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

describe("computeAsOf — 1Day", () => {
  it("uses the session close, not the bar's ts (which is the open)", () => {
    const ts = new Date("2024-03-05T05:00:00Z"); // EST session open
    const asOf = computeAsOf(ts, "1Day");
    expect(asOf.toISOString()).toBe("2024-03-05T21:00:00.000Z"); // 16:00 EST
    expect(asOf.getTime()).toBeGreaterThan(ts.getTime());
  });

  it("resolves DST correctly: EDT sessions close an hour earlier in UTC", () => {
    // 2024 US DST began Sun Mar 10. Mar 11 is EDT.
    expect(computeAsOf(new Date("2024-03-08T05:00:00Z"), "1Day").toISOString()).toBe(
      "2024-03-08T21:00:00.000Z",
    );
    expect(computeAsOf(new Date("2024-03-11T04:00:00Z"), "1Day").toISOString()).toBe(
      "2024-03-11T20:00:00.000Z",
    );
  });

  it("always lands on 16:00 market-local time, whatever the season", () => {
    const samples = [
      "2024-01-16T05:00:00Z",
      "2024-03-11T04:00:00Z",
      "2024-07-01T04:00:00Z",
      "2024-11-04T05:00:00Z",
      "2024-12-31T05:00:00Z",
    ];
    for (const iso of samples) {
      const local = inMarketTime(sessionCloseUtc(new Date(iso)));
      expect(local.endsWith(`${SESSION_CLOSE_HOUR_ET}:00`)).toBe(true);
    }
  });

  it("keeps as_of on the same market date as the bar", () => {
    const ts = new Date("2024-07-01T04:00:00Z");
    const asOf = computeAsOf(ts, "1Day");
    expect(inMarketTime(asOf).slice(0, 10)).toBe(inMarketTime(ts).slice(0, 10));
  });
});

describe("computeAsOf — 1Hour", () => {
  it("is the end of the bar's own hour", () => {
    expect(computeAsOf(new Date("2024-03-05T14:00:00Z"), "1Hour").toISOString()).toBe(
      "2024-03-05T15:00:00.000Z",
    );
    expect(computeAsOf(new Date("2024-03-05T20:00:00Z"), "1Hour").toISOString()).toBe(
      "2024-03-05T21:00:00.000Z",
    );
  });

  it("is never earlier than the bar it describes", () => {
    for (let h = 0; h < 24; h += 1) {
      const ts = new Date(Date.UTC(2024, 5, 12, h));
      expect(computeAsOf(ts, "1Hour").getTime()).toBeGreaterThan(ts.getTime());
    }
  });
});
