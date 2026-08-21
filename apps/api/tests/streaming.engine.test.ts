import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { MarketStreamEngine } from "../src/streaming/engine.js";
import { MockMarketStreamClient } from "../src/streaming/alpaca-stream.js";
import { buildApp } from "../src/app.js";

describe("Market Data Streaming Engine & SSE Plugin", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("calculates incremental indicators on incoming stream bars", async () => {
    const mockClient = new MockMarketStreamClient(["AAPL"]);
    const engine = new MarketStreamEngine(mockClient);

    await engine.start();
    expect(engine.isRunning()).toBe(true);

    const history = engine.getBarHistory("AAPL");
    expect(history.length).toBeGreaterThan(0);

    const indicators = engine.getLatestIndicators("AAPL");
    expect(indicators).toBeDefined();
    expect(indicators?.rsi).toBeDefined();

    engine.stop();
    expect(engine.isRunning()).toBe(false);
  });

  it("serves recent rolling bars from GET /streaming/history", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/streaming/history?symbol=AAPL",
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.symbol).toBe("AAPL");
    expect(Array.isArray(json.bars)).toBe(true);
    expect(json.bars.length).toBeGreaterThan(0);
  });
});
