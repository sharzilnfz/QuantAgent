import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/require-auth.js";
import { config } from "../config.js";
import { runAgents } from "./runner.js";
import { TechnicalAgent } from "./technical/agent.js";
import { isLlmConfigured } from "./technical/llm-client.js";

/**
 * OWNER: M1 (specs 06/07) — Agent framework HTTP surface.
 *
 *   GET  /agents/latest?symbol=&timeframe=  latest validated agent outputs for a symbol
 *   POST /agents/run                        trigger a technical-agent run
 *
 * Both require auth. `@committee/db` is imported lazily inside the handlers so the
 * API still boots (and /health still answers) when Postgres is unavailable.
 */

const LatestQuery = z.object({
  symbol: z.string().min(1),
  timeframe: z.enum(["1Day", "1Hour"]).default("1Day"),
});

const RunBody = z.object({
  symbol: z.string().min(1),
  timeframe: z.enum(["1Day", "1Hour"]).default("1Day"),
  /** Defaults to now. Everything the run reads is bounded by this timestamp. */
  decisionTs: z.string().datetime().optional(),
});

export async function agentsPlugin(app: FastifyInstance): Promise<void> {
  app.get("/agents/latest", { preHandler: requireAuth }, async (request, reply) => {
    const query = LatestQuery.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "invalid_query", issues: query.error.issues });
    }

    try {
      const { db, agentRuns, agentOutputs } = await import("@committee/db");
      const { and, desc, eq } = await import("drizzle-orm");

      const runs = await db
        .select()
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.symbol, query.data.symbol),
            eq(agentRuns.timeframe, query.data.timeframe),
          ),
        )
        .orderBy(desc(agentRuns.decisionTs), desc(agentRuns.startedAt))
        .limit(1);

      const run = runs[0];
      if (!run) return reply.code(404).send({ error: "no_runs_for_symbol" });

      const outputs = await db
        .select()
        .from(agentOutputs)
        .where(eq(agentOutputs.runId, run.id));

      return reply.send({
        runId: run.id,
        symbol: run.symbol,
        timeframe: run.timeframe,
        decisionTs: run.decisionTs.toISOString(),
        status: run.status,
        outputs: outputs.map((row) => row.raw),
      });
    } catch (err) {
      request.log.error({ err }, "agents.latest failed");
      return reply.code(503).send({ error: "agent_store_unavailable" });
    }
  });

  app.post("/agents/run", { preHandler: requireAuth }, async (request, reply) => {
    const body = RunBody.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    }

    if (!isLlmConfigured()) {
      return reply.code(503).send({ error: "llm_not_configured" });
    }

    const decisionTs = body.data.decisionTs ?? new Date().toISOString();

    try {
      const { runId, outputs } = await runAgents(
        {
          symbol: body.data.symbol,
          timeframe: body.data.timeframe,
          decisionTs,
          bars: [],
          indicators: null,
        },
        [new TechnicalAgent()],
      );
      return reply.send({ runId, outputs });
    } catch (err) {
      request.log.error({ err }, "agents.run failed");
      return reply.code(503).send({ error: "agent_run_failed" });
    }
  });
}
