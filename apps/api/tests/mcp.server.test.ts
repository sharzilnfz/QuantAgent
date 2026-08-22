import { describe, expect, it, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { QuantMcpServer } from "../src/mcp/server.js";
import { QUANT_MCP_TOOLS } from "../src/mcp/tools.js";

describe("QuantMcpServer — Protocol & Tools Execution", () => {
  let server: QuantMcpServer;

  beforeEach(() => {
    server = new QuantMcpServer();
  });

  it("handles 'initialize' handshake and returns capabilities", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    expect(res?.jsonrpc).toBe("2.0");
    expect(res?.id).toBe(1);
    expect((res?.result as any)?.serverInfo?.name).toBe("quant-agent-mcp-server");
  });

  it("handles 'ping' request", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: "ping-123",
      method: "ping",
    });

    expect(res?.id).toBe("ping-123");
    expect(res?.result).toEqual({});
  });

  it("lists all registered QuantAgent MCP tools on 'tools/list'", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    const tools = (res?.result as any)?.tools;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(QUANT_MCP_TOOLS.length);

    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("quant_query_market_data");
    expect(toolNames).toContain("quant_get_indicators");
    expect(toolNames).toContain("quant_run_backtest");
    expect(toolNames).toContain("quant_evaluate_multiagent");
    expect(toolNames).toContain("quant_request_trade_approval");
    expect(toolNames).toContain("quant_query_portfolio");
    expect(toolNames).toContain("quant_check_market_calendar");
  });

  it("executes 'quant_query_market_data' tool call", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "quant_query_market_data",
        arguments: {
          symbol: "AAPL",
          asOf: "2024-06-30T21:00:00.000Z",
          limit: 10,
        },
      },
    });

    const content = (res?.result as any)?.content;
    expect(content?.[0]?.type).toBe("text");
    const parsed = JSON.parse(content[0].text);
    expect(parsed.symbol).toBe("AAPL");
    expect(parsed.returnedBars.length).toBe(10);
  });

  it("executes 'quant_get_indicators' tool call", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "quant_get_indicators",
        arguments: {
          symbol: "AAPL",
          asOf: "2024-06-30T21:00:00.000Z",
        },
      },
    });

    const content = (res?.result as any)?.content;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.symbol).toBe("AAPL");
    expect(parsed.latestSnapshot?.rsi).toBeDefined();
    expect(parsed.latestSnapshot?.sma20).toBeDefined();
  });

  it("executes 'quant_run_backtest' tool call", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "quant_run_backtest",
        arguments: {
          symbol: "AAPL",
          strategy: "sma-rsi",
        },
      },
    });

    const content = (res?.result as any)?.content;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.symbol).toBe("AAPL");
    expect(parsed.metrics?.sharpeRatio).toBeDefined();
    expect(parsed.metrics?.totalReturn).toBeDefined();
  });

  it("executes 'quant_check_market_calendar' tool call", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "quant_check_market_calendar",
        arguments: {
          date: "2024-01-15", // MLK Day
        },
      },
    });

    const content = (res?.result as any)?.content;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.isMarketHoliday).toBe(true);
    expect(parsed.isTradingDay).toBe(false);
  });

  it("executes 'quant_request_trade_approval' tool call", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "quant_request_trade_approval",
        arguments: {
          symbol: "NVDA",
          direction: "bullish",
          targetQty: 25,
          estimatedPrice: 700.0,
          confidence: 0.92,
          rationale: "Accelerating AI chip demand",
        },
      },
    });

    const content = (res?.result as any)?.content;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.ok).toBe(true);
    expect(parsed.approval?.status).toBe("pending");
    expect(parsed.approval?.symbol).toBe("NVDA");
  });
});

describe("Fastify MCP Endpoints (POST /mcp and GET /mcp/tools)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("GET /mcp/tools returns the tools catalog", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/mcp/tools",
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(Array.isArray(json.tools)).toBe(true);
    expect(json.tools.length).toBe(QUANT_MCP_TOOLS.length);
  });

  it("POST /mcp processes JSON-RPC 2.0 requests over HTTP", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp",
      payload: {
        jsonrpc: "2.0",
        id: "http-1",
        method: "tools/call",
        params: {
          name: "quant_check_market_calendar",
          arguments: { date: "2024-01-16" },
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.id).toBe("http-1");
    const parsed = JSON.parse(json.result.content[0].text);
    expect(parsed.isTradingDay).toBe(true);
  });
});
