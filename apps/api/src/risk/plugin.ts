import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Direction, PortfolioState, RiskConfig } from "@committee/contracts";
import { RiskGateEngine } from "./engine.js";

const AssessRequestSchema = z.object({
  symbol: z.string(),
  direction: Direction,
  confidence: z.number().min(0).max(1),
  currentPrice: z.number().positive(),
  portfolio: PortfolioState,
  portfolioHistory: z.array(z.object({ asOf: z.string().datetime(), equity: z.number() })).optional(),
  assetVolatility: z.number().positive().optional(),
  decisionTs: z.string().datetime(),
  config: RiskConfig.partial().optional(),
});

export async function riskPlugin(app: FastifyInstance): Promise<void> {
  app.post("/risk/assess", async (request, reply) => {
    const parseResult = AssessRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parseResult.error.errors,
      });
    }

    const { config, ...params } = parseResult.data;
    const engine = new RiskGateEngine({ config });
    const assessment = engine.assess(params);

    return reply.code(200).send(assessment);
  });
}
