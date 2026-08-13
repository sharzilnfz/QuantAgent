import { describe, expect, it } from "vitest";

import {
  AlpacaClient,
  AlpacaHttpError,
  chunkRange,
  isRetryableStatus,
  parseRetryAfter,
  ResilientHttpClient,
} from "../src/ingest/alpaca-client.js";
import { MarketDataIngestor } from "../src/ingest/market-data-ingestor.js";
import { InMemoryPriceBarStore } from "../src/ingest/store.js";

import dayFixture from "./fixtures/ingest-alpaca-1day.json" with { type: "json" };

const NOW = new Date("2024-06-01T00:00:00Z");

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("rate limiting & backoff", () => {
  it("classifies retryable statuses", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it("parses Retry-After as seconds and as an HTTP date", () => {
    expect(parseRetryAfter("3")).toBe(3000);
    const now = Date.parse("2024-03-05T00:00:00Z");
    expect(parseRetryAfter("Tue, 05 Mar 2024 00:00:10 GMT", now)).toBe(10_000);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("garbage")).toBeNull();
  });

  it("ResilientHttpClient retries 429 and returns response", async () => {
    const slept: number[] = [];
    let attempts = 0;
    const client = new ResilientHttpClient({
      baseDelayMs: 10,
      random: () => 0,
      sleep: async (ms) => {
        slept.push(ms);
      },
      fetchImpl: async () => {
        attempts += 1;
        return attempts === 1
          ? jsonResponse(429, { message: "rate limit" }, { "retry-after": "2" })
          : jsonResponse(200, dayFixture);
      },
    });

    const data = await client.getJson("https://data.example.test", {});
    expect(attempts).toBe(2);
    expect(slept).toEqual([2000]);
    expect(data).toEqual(dayFixture);
  });

  it("429 then 200 succeeds via MarketDataIngestor backoff path, without duplicating", async () => {
    const store = new InMemoryPriceBarStore();
    const slept: number[] = [];
    let attempts = 0;

    const result = await MarketDataIngestor.ingest(
      {
        symbols: ["AAPL"],
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
        baseDelayMs: 10,
        random: () => 0,
        sleep: async (ms) => {
          slept.push(ms);
        },
        fetchImpl: async () => {
          attempts += 1;
          return attempts === 1
            ? jsonResponse(429, { message: "rate limit" }, { "retry-after": "2" })
            : jsonResponse(200, dayFixture);
        },
      },
    );

    expect(attempts).toBe(2);
    expect(slept).toEqual([2000]); // honoured Retry-After
    expect(result.inserted).toBe(6);
    expect(store.rows.size).toBe(6); // the retry did not double-write
  });

  it("backs off exponentially through repeated 5xx, then gives up cleanly", async () => {
    const slept: number[] = [];
    const client = new AlpacaClient({
      apiKey: "k",
      apiSecret: "s",
      baseUrl: "https://data.example.test",
      maxRetries: 3,
      baseDelayMs: 100,
      random: () => 1,
      sleep: async (ms) => {
        slept.push(ms);
      },
      fetchImpl: async () => jsonResponse(503, { message: "boom" }),
    });

    await expect(
      client.getBars("AAPL", "1Day", new Date("2024-03-01"), new Date("2024-03-15")),
    ).rejects.toBeInstanceOf(AlpacaHttpError);

    expect(slept).toEqual([100, 200, 400]); // full-jitter upper bound = 2^n * base
  });

  it("does not retry a non-retryable 4xx", async () => {
    let attempts = 0;
    const client = new AlpacaClient({
      apiKey: "k",
      apiSecret: "s",
      baseUrl: "https://data.example.test",
      sleep: async () => {},
      fetchImpl: async () => {
        attempts += 1;
        return jsonResponse(401, { message: "unauthorized" });
      },
    });

    await expect(
      client.getBars("AAPL", "1Day", new Date("2024-03-01"), new Date("2024-03-15")),
    ).rejects.toThrow(/401/);
    expect(attempts).toBe(1);
  });

  it("retries transient network errors", async () => {
    let attempts = 0;
    const client = new AlpacaClient({
      apiKey: "k",
      apiSecret: "s",
      baseUrl: "https://data.example.test",
      baseDelayMs: 1,
      sleep: async () => {},
      fetchImpl: async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("ECONNRESET");
        return jsonResponse(200, dayFixture);
      },
    });

    const bars = await client.getBars(
      "AAPL",
      "1Day",
      new Date("2024-03-01"),
      new Date("2024-03-15"),
    );
    expect(attempts).toBe(3);
    expect(bars).toHaveLength(7);
  });
});

describe("chunkRange — backpressure on long backfills", () => {
  it("returns a single chunk for a short window", () => {
    const chunks = chunkRange(new Date("2024-03-01"), new Date("2024-03-15"), "1Day");
    expect(chunks).toHaveLength(1);
  });

  it("splits multi-year hourly backfills", () => {
    const chunks = chunkRange(new Date("2020-01-01"), new Date("2024-01-01"), "1Hour");
    expect(chunks.length).toBeGreaterThan(10);
    // Contiguous, non-overlapping, fully covering.
    expect(chunks[0]!.from.toISOString()).toBe(new Date("2020-01-01").toISOString());
    expect(chunks.at(-1)!.to.toISOString()).toBe(new Date("2024-01-01").toISOString());
    for (let i = 1; i < chunks.length; i += 1) {
      expect(chunks[i]!.from.getTime()).toBe(chunks[i - 1]!.to.getTime() + 1);
    }
  });

  it("returns nothing for an inverted range", () => {
    expect(chunkRange(new Date("2024-03-15"), new Date("2024-03-01"), "1Day")).toEqual([]);
  });
});
