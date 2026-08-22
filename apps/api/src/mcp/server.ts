import * as readline from "node:readline";
import { TelegramBotService } from "../telegram/service.js";
import { QUANT_MCP_TOOLS, executeMcpTool } from "./tools.js";
import {
  JsonRpcRequest,
  type JsonRpcResponse,
  type McpCallToolResult,
} from "./types.js";

export interface McpServerOptions {
  telegramService?: TelegramBotService;
}

export class QuantMcpServer {
  private readonly telegramService?: TelegramBotService;
  private isInitialized = false;

  constructor(options: McpServerOptions = {}) {
    this.telegramService = options.telegramService;
  }

  /**
   * Dispatches an incoming JSON-RPC 2.0 request and returns a structured response.
   */
  async handleMessage(rawMessage: unknown): Promise<JsonRpcResponse | null> {
    const parseResult = JsonRpcRequest.safeParse(rawMessage);
    if (!parseResult.success) {
      return {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error: Invalid JSON-RPC 2.0 request payload.",
        },
      };
    }

    const { id, method, params } = parseResult.data;

    // Handle notifications (no id)
    if (id === undefined && method === "notifications/initialized") {
      this.isInitialized = true;
      return null;
    }

    switch (method) {
      case "initialize": {
        this.isInitialized = true;
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "quant-agent-mcp-server",
              version: "1.0.0",
            },
          },
        };
      }

      case "ping": {
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          result: {},
        };
      }

      case "tools/list": {
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          result: {
            tools: QUANT_MCP_TOOLS,
          },
        };
      }

      case "tools/call": {
        const toolName = String(params?.name || "");
        const toolArgs = (params?.arguments as Record<string, unknown>) || {};

        const result: McpCallToolResult = await executeMcpTool(
          toolName,
          toolArgs,
          this.telegramService,
        );

        return {
          jsonrpc: "2.0",
          id: id ?? null,
          result,
        };
      }

      default: {
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
      }
    }
  }

  /**
   * Starts line-delimited JSON-RPC stdio transport for IDE/CLI agent integration.
   */
  startStdio(): void {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on("line", async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const parsed = JSON.parse(trimmed);
        const response = await this.handleMessage(parsed);
        if (response) {
          process.stdout.write(`${JSON.stringify(response)}\n`);
        }
      } catch (err) {
        const errorResponse: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: `JSON Parse error: ${String(err)}`,
          },
        };
        process.stdout.write(`${JSON.stringify(errorResponse)}\n`);
      }
    });

    process.stderr.write("🚀 QuantAgent MCP Server running on Stdio transport.\n");
  }
}
