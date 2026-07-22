import { describe, expect, it } from "vitest";
import { PriceBar } from "@committee/contracts";

import { AlpacaClient, type AlpacaRawBar } from "../src/ingest/alpaca-client.js";
import { sessionCloseUtc } from "../src/ingest/as-of.js";
import { fetchBars, fetchBarsDetailed, normalizeBars } from "../src/ingest/prices.js";

import dayFixture from "./fixtures/ingest-alpaca-1day.json" with { type: "json" };
import hourFixture from "./fixtures/ingest-alpaca-1hour.json" with { type: "json" };

const NOW = new Date("2024-06-01T00:00:00Z");
const dayBars = dayFixture.bars as unknown as AlpacaRawBar[];
const hourBars = hourFixture.bars as unknown as AlpacaRawBar[];

/** Minimal Response-alike so we can drive AlpacaClient without a network. */
function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("normalizeBars — fixture-based normalization", () => {
  it("maps Alpaca's wire shape onto contract-valid PriceBars", () => {
    const { bars } = normalizeBars(dayBars, "AAPL", "1Day", { now: NOW });

    // 7 raw rows: 6 good, 1 with an unparseable timestamp.
    expect(bars).toHaveLength(6);
    for (const bar of bars) expect(() => PriceBar.parse(bar)).not.toThrow();

    expect(bars[0]).toEqual({
      symbol: "AAPL",
      timeframe: "1Day",
      ts: "2024-03-05T05:00:00.000Z",
      open: 170.76,
      high: 172.04,
      low: 169.62,
      close: 170.12,
      volume: 95132400,
      asOf: "2024-03-05T21:00:00.000Z",
    });
  });

  it("coerces string numerics to numbers", () => {
    const { bars } = normalizeBars(dayBars, "AAPL", "1Day", { now: NOW });
    const last = bars.at(-1)!;
    expect(last.ts).toBe("2024-03-12T04:00:00.000Z");
    expect(last.open).toBe(173.15);
    expect(last.volume).toBe(59544800);
    expect(typeof last.close).toBe("number");
  });

  it("counts malformed rows instead of silently emitting garbage", () => {
    const { malformed } = normalizeBars(dayBars, "AAPL", "1Day", { now: NOW });
    expect(malformed).toBe(1);
  });

  it("returns bars sorted ascending and deduped on ts", () => {
    const shuffled = [dayBars[3]!, dayBars[0]!, dayBars[0]!, dayBars[1]!];
    const { bars } = normalizeBars(shuffled, "AAPL", "1Day", { now: NOW });
    expect(bars.map((b) => b.ts)).toEqual([
      "2024-03-05T05:00:00.000Z",
      "2024-03-06T05:00:00.000Z",
      "2024-03-08T05:00:00.000Z",
    ]);
  });

  it("stamps 1Hour bars with the end of their hour", () => {
    const { bars } = normalizeBars(hourBars, "MSFT", "1Hour", { now: NOW });
    expect(bars.map((b) => b.asOf)).toEqual([
      "2024-03-05T15:00:00.000Z",
      "2024-03-05T16:00:00.000Z",
      "2024-03-05T17:00:00.000Z",
      "2024-03-05T21:00:00.000Z",
    ]);
  });
});

describe("POINT-IN-TIME invariants (spec 04 §7)", () => {
  it("no bar's as_of is earlier than its own session close", () => {
    const { bars } = normalizeBars(dayBars, "AAPL", "1Day", { now: NOW });
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      const close = sessionCloseUtc(new Date(bar.ts));
      expect(new Date(bar.asOf).getTime()).toBeGreaterThanOrEqual(close.getTime());
      // ...and never before the bar it describes.
      expect(new Date(bar.asOf).getTime()).toBeGreaterThan(new Date(bar.ts).getTime());
    }
  });

  it("no bar's as_of is in the future", () => {
    for (const tf of ["1Day", "1Hour"] as const) {
      const raw = tf === "1Day" ? dayBars : hourBars;
      const { bars } = normalizeBars(raw, "AAPL", tf, { now: NOW });
      for (const bar of bars) {
        expect(new Date(bar.asOf).getTime()).toBeLessThanOrEqual(NOW.getTime());
      }
    }
  });

  it("DROPS not-yet-final bars rather than clamping as_of to now", () => {
    // `now` sits mid-session on 2024-03-08 (14:00 EST), so that day's bar is
    // not final yet. Clamping its as_of to `now` would be the look-ahead bug.
    const midSession = new Date("2024-03-08T19:00:00Z");
    const { bars, dropped } = normalizeBars(dayBars, "AAPL", "1Day", { now: midSession });

    expect(dropped).toBe(3); // 03-08 (in progress) + 03-11 + 03-12 (future)
    expect(bars.map((b) => b.ts)).toEqual([
      "2024-03-05T05:00:00.000Z",
      "2024-03-06T05:00:00.000Z",
      "2024-03-07T05:00:00.000Z",
    ]);
    for (const bar of bars) {
      expect(new Date(bar.asOf).getTime()).toBeLessThanOrEqual(midSession.getTime());
    }
  });
});

describe("fetchBars — the seam", () => {
  it("fetches, normalizes and as_of-stamps in one call", async () => {
    const calls: string[] = [];
    const bars = await fetchBars("AAPL", "1Day", "2024-03-01", "2024-03-15", {
      now: NOW,
      fetchImpl: async (url) => {
        calls.push(url);
        return jsonResponse(200, dayFixture);
      },
      apiKey: "k",
      apiSecret: "s",
      baseUrl: "https://data.example.test",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/v2/stocks/AAPL/bars");
    expect(calls[0]).toContain("timeframe=1Day");
    expect(bars).toHaveLength(6);
    expect(bars[0]!.asOf).toBe("2024-03-05T21:00:00.000Z");
  });

  it("follows next_page_token", async () => {
    let call = 0;
    const client = new AlpacaClient({
      apiKey: "k",
      apiSecret: "s",
      baseUrl: "https://data.example.test",
      fetchImpl: async () => {
        call += 1;
        return call === 1
          ? jsonResponse(200, { bars: dayBars.slice(0, 3), next_page_token: "abc" })
          : jsonResponse(200, { bars: dayBars.slice(3), next_page_token: null });
      },
    });
    const detailed = await fetchBarsDetailed("AAPL", "1Day", "2024-03-01", "2024-03-15", {
      client,
      now: NOW,
    });
    expect(call).toBe(2);
    expect(detailed.bars).toHaveLength(6);
  });

  it("tolerates an empty response", async () => {
    const bars = await fetchBars("ZZZZ", "1Day", "2024-03-01", "2024-03-15", {
      now: NOW,
      apiKey: "k",
      apiSecret: "s",
      baseUrl: "https://data.example.test",
      fetchImpl: async () => jsonResponse(200, { bars: null, next_page_token: null }),
    });
    expect(bars).toEqual([]);
  });
});
