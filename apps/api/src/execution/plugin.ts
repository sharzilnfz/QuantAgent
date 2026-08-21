import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PositionAllocation, RiskAssessment } from "@committee/contracts";

import { requireAuth } from "../auth/require-auth.js";
import { loadCredentials } from "../credentials/service.js";
import { AlpacaPaperClient, DeterministicMockAlpacaClient, type IAlpacaClient } from "./alpaca-client.js";
import { ExecutionRouter } from "./router.js";

const ExecuteOrderSchema = z.object({
  allocation: PositionAllocation,
  riskAssessment: RiskAssessment,
  decisionTs: z.string().datetime(),
});

// Shared mock client for demo/offline sessions when user has no stored credentials
const sharedMockClient = new DeterministicMockAlpacaClient();

export async function resolveAlpacaClient(userId: string): Promise<IAlpacaClient> {
  const creds = await loadCredentials(userId).catch(() => null);
  if (creds && creds.alpacaKey && creds.alpacaSecret) {
    return new AlpacaPaperClient({
      apiKey: creds.alpacaKey,
      apiSecret: creds.alpacaSecret,
    });
  }

  // Fallback to environment variables if provided
  const envKey = process.env.ALPACA_KEY;
  const envSecret = process.env.ALPACA_SECRET;
  if (envKey && envSecret) {
    return new AlpacaPaperClient({
      apiKey: envKey,
      apiSecret: envSecret,
    });
  }

  // Zero-cost offline fallback
  return sharedMockClient;
}

export async function executionPlugin(app: FastifyInstance): Promise<void> {
  app.post("/execution/order", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "unauthorized" });

    const parsed = ExecuteOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.errors,
      });
    }

    const client = await resolveAlpacaClient(request.user.id);
    const router = new ExecutionRouter({ client });
    const result = await router.execute(parsed.data);

    return reply.code(200).send(result);
  });

  app.get("/execution/orders", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "unauthorized" });

    const client = await resolveAlpacaClient(request.user.id);
    const orders = await client.listOrders();

    return reply.code(200).send(orders);
  });
}
