import type { FastifyInstance } from "fastify";

import { requireAuth } from "../auth/require-auth.js";
import { getPortfolioState, getWatchlist } from "./service.js";

/**
 * OWNER: M4 (spec 08 §3/§4 read endpoints) — portfolio & watchlist reads.
 *
 * Registers: GET /portfolio -> PortfolioState, GET /watchlist -> { symbol }[].
 * Both require a session via the shared `requireAuth` preHandler.
 *
 * `GET /portfolio` currently returns a documented Sprint-1 placeholder snapshot
 * (see ./service.ts) — contract-valid, and deliberately empty rather than
 * fabricated. `GET /agents/latest` is M1's route, not this plugin's.
 */
export async function portfolioPlugin(app: FastifyInstance): Promise<void> {
  app.get("/portfolio", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "unauthorized" });

    const state = await getPortfolioState(request.user.id);
    return reply.code(200).send(state);
  });

  app.get("/watchlist", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "unauthorized" });

    const items = await getWatchlist(request.user.id);
    return reply.code(200).send(items);
  });
}
