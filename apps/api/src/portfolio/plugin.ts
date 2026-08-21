import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  Direction,
  PortfolioState,
  RiskAssessment,
  SizingMethod,
  AllocationConfig,
} from "@committee/contracts";

import { requireAuth } from "../auth/require-auth.js";
import { getPortfolioHistory, getPortfolioState, getWatchlist } from "./service.js";
import { PositionAllocatorEngine } from "./allocator.js";

/**
 * OWNER: M4 (spec 08 §3/§4 read endpoints) — portfolio & watchlist reads.
 *
 * Registers: GET /portfolio -> PortfolioState, GET /portfolio/history ->
 * Pick<PortfolioState, "asOf" | "equity">[], GET /watchlist -> { symbol }[].
 * All require a session via the shared `requireAuth` preHandler.
 *
 * `GET /portfolio` and `GET /portfolio/history` currently return documented
 * Sprint-1 placeholder data (see ./service.ts) — contract-valid, and
 * deliberately empty rather than fabricated.
 */
export async function portfolioPlugin(app: FastifyInstance): Promise<void> {
  app.get("/portfolio", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "unauthorized" });

    const state = await getPortfolioState(request.user.id);
    return reply.code(200).send(state);
  });

  app.get("/portfolio/history", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "unauthorized" });

    const history = await getPortfolioHistory(request.user.id);
    return reply.code(200).send(history);
  });

  app.get("/watchlist", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "unauthorized" });

    const items = await getWatchlist(request.user.id);
    return reply.code(200).send(items);
  });

  app.post("/portfolio/allocate", async (request, reply) => {
    const AllocateSchema = z.object({
      symbol: z.string(),
      direction: Direction,
      confidence: z.number().min(0).max(1),
      estimatedPrice: z.number().positive(),
      portfolio: PortfolioState,
      riskAssessment: RiskAssessment,
      assetVolatility: z.number().positive().optional(),
      sizingMethod: SizingMethod.optional(),
      decisionTs: z.string().datetime(),
      config: AllocationConfig.partial().optional(),
    });

    const parsed = AllocateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.errors,
      });
    }

    const { config, ...params } = parsed.data;
    const allocator = new PositionAllocatorEngine({ config });
    const allocation = allocator.allocate(params);

    return reply.code(200).send(allocation);
  });
}
