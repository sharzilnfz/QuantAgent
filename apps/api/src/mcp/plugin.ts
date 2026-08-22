import type { FastifyPluginAsync } from "fastify";
import { QuantMcpServer } from "./server.js";
import { QUANT_MCP_TOOLS } from "./tools.js";

export const mcpPlugin: FastifyPluginAsync = async (app) => {
  const mcpServer = new QuantMcpServer();

  /**
   * Discovery endpoint for MCP tools catalog.
   */
  app.get("/mcp/tools", async (_req, reply) => {
    return reply.send({
      tools: QUANT_MCP_TOOLS,
    });
  });

  /**
   * JSON-RPC 2.0 HTTP endpoint for Model Context Protocol callers.
   */
  app.post("/mcp", async (req, reply) => {
    const response = await mcpServer.handleMessage(req.body);
    if (!response) {
      return reply.status(204).send();
    }
    return reply.status(200).send(response);
  });
};
