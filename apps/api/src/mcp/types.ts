import { z } from "zod";

/**
 * Standard MCP Tool Definition.
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Standard MCP Call Tool Result payload.
 */
export interface McpCallToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

/**
 * JSON-RPC 2.0 Request Schema.
 */
export const JsonRpcRequest = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequest>;

/**
 * JSON-RPC 2.0 Response.
 */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
