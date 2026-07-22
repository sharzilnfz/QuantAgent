import { describe, expect, it } from "vitest";

import type { AlpacaRawBar } from "../src/ingest/alpaca-client.js";
import { ingestPrices, normalizeBars, upsertBars } from "../src/ingest/prices.js";
import { InMemoryPriceBarStore } from "../src/ingest/store.js";

import dayFixture from "./fixtures/ingest-alpaca-1day.json" with { type: "json" };

const NOW = new Date("2024-06-01T00:00:00Z");
const dayBars = dayFixture.bars as unknown as AlpacaRawBar[];

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("upsertBars — idempotency", () => {
  it("re-ingesting the same window inserts nothing and skips everything", async () => {
    const store = new InMemoryPriceBarStore();
    const { bars } = normalizeBars(dayBars, "AAPL", "1Day", { now: NOW });

    const first = await upsertBars(bars, store);
    expect(first).toEqual({ inserted: 6, skipped: 0 });
    expect(store.rows.size).toBe(6);
    const snapshot = JSON.stringify([...store.rows.entries()].sort());

    const second = await upsertBars(bars, store);
    expect(second).toEqual({ inserted: 0, skipped: 6 });
    expect(store.rows.size).toBe(6); // row count unchanged
    expect(JSON.stringify([...store.rows.entries()].sort())).toBe(snapshot); // values identical
  });

  it("is a no-op on an empty batch", async () => {
    const store = new InMemoryPriceBarStore();
    expect(await upsertBars([], store)).toEqual({ inserted: 0, skipped: 0 });
  });

  it("keys on (symbol, timeframe, ts) — same ts, different symbol is a new row", async () => {
    const store = new InMemoryPriceBarStore();
    const aapl = normalizeBars(dayBars, "AAPL", "1Day", { now: NOW }).bars;
    const msft = normalizeBars(dayBars, "MSFT", "1Day", { now: NOW }).bars;
    const hourly = normalizeBars(dayBars, "AAPL", "1Hour", { now: NOW }).bars;

    await upsertBars(aapl, store);
    await upsertBars(msft, store);
    await upsertBars(hourly, store);
    expect(store.rows.size).toBe(aapl.length + msft.length + hourly.length);
  });
});

describe("ingestPrices — end to end against an in-memory store", () => {
  it("reports inserted/skipped across two identical runs", async () => {
    const store = new InMemoryPriceBarStore();
    const options = {
      store,
      now: NOW,
      apiKey: "k",
      apiSecret: "s",
      baseUrl: "https://data.example.test",
      fetchImpl: async () => jsonResponse(200, dayFixture),
    };
    const request = {
      symbols: ["AAPL", "MSFT"],
      from: "2024-03-01T00:00:00.000Z",
      to: "2024-03-15T00:00:00.000Z",
      timeframe: "1Day" as const,
    };

    const run1 = await ingestPrices(request, options);
    expect(run1.inserted).toBe(12);
    expect(run1.skipped).toBe(0);
    expect(run1.partial).toBe(false);
    expect(store.rows.size).toBe(12);

    const run2 = await ingestPrices(request, options);
    expect(run2.inserted).toBe(0);
    expect(run2.skipped).toBe(12);
    expect(store.rows.size).toBe(12);
  });

  it("isolates a failing symbol and still ingests the rest (partial failure)", async () => {
    const store = new InMemoryPriceBarStore();
    const result = await ingestPrices(
      {
        symbols: ["AAPL", "BOOM"],
        from: "2024-03-01T00:00:00.000Z",
        to: "2024-03-15T00:00:00.000Z",
        timeframe: "1Day",
      },
      {
        store,
        now: NOW,
        apiKey: "k",
        apiSecret: "s",
        baseUrl: "https://data.example.test",
        maxRetries: 0,
        sleep: async () => {},
        fetchImpl: async (url) =>
          url.includes("BOOM")
            ? jsonResponse(403, { message: "forbidden" })
            : jsonResponse(200, dayFixture),
      },
    );

    expect(result.partial).toBe(true);
    expect(result.inserted).toBe(6);
    expect(result.symbols.find((s) => s.symbol === "BOOM")?.error).toContain("403");
    expect(store.rows.size).toBe(6);
  });

  it("rejects an inverted date range", async () => {
    await expect(
      ingestPrices(
        {
          symbols: ["AAPL"],
          from: "2024-03-15T00:00:00.000Z",
          to: "2024-03-01T00:00:00.000Z",
          timeframe: "1Day",
        },
        { store: new InMemoryPriceBarStore() },
      ),
    ).rejects.toThrow(/is after/);
  });
});
