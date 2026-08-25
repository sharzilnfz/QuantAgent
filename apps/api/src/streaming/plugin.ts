import type { FastifyPluginAsync } from "fastify";
import { getStreamEngine } from "./engine.js";
import type { MarketStreamMessage } from "@committee/contracts";

export const streamingPlugin: FastifyPluginAsync = async (app) => {
  const engine = getStreamEngine();

  // Ensure streaming engine starts with the server in non-test environments
  if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
    void engine.start().catch((err) => {
      app.log.warn({ err }, "Failed to initialize market streaming engine at startup");
    });
  }

  /**
   * SSE Endpoint: `GET /streaming/market-data`
   * Streams real-time tick/bar events and recalculated indicator snapshots.
   */
  app.get("/streaming/market-data", (request, reply) => {
    const rawSymbols = (request.query as { symbols?: string })?.symbols;
    const symbols = rawSymbols ? rawSymbols.split(",").map((s) => s.trim().toUpperCase()) : ["AAPL", "NVDA", "SPY"];

    engine.subscribe(symbols);

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.flushHeaders();

    // Send initial heartbeat
    const initialHeartbeat: MarketStreamMessage = {
      type: "heartbeat",
      symbol: "SYSTEM",
      price: 0,
      volume: 0,
      timestamp: new Date().toISOString(),
    };
    reply.raw.write(`data: ${JSON.stringify(initialHeartbeat)}\n\n`);

    const onData = (msg: MarketStreamMessage) => {
      if (symbols.includes(msg.symbol.toUpperCase()) || msg.symbol === "SYSTEM") {
        reply.raw.write(`data: ${JSON.stringify(msg)}\n\n`);
      }
    };

    engine.on("data", onData);

    // Keep alive ping every 15s
    const keepAliveTimer = setInterval(() => {
      reply.raw.write(`: ping\n\n`);
    }, 15000);

    request.raw.on("close", () => {
      clearInterval(keepAliveTimer);
      engine.off("data", onData);
    });
  });

  /**
   * REST Endpoint: `GET /streaming/history`
   * Returns recent stream rolling bars for a given symbol.
   */
  app.get("/streaming/history", async (request, reply) => {
    const symbol = ((request.query as { symbol?: string })?.symbol ?? "AAPL").toUpperCase();
    const bars = engine.getBarHistory(symbol);
    const indicators = engine.getLatestIndicators(symbol);

    return reply.send({
      symbol,
      bars,
      indicators,
    });
  });
};
