import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  executeAgent,
  registerAgent,
  listAgents,
} from "./framework.js";
import { TechnicalAgent } from "./technical.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("agent-routes");
const router: Router = Router();

// ─── Register agents on module load ─────────────────────────────────────────
registerAgent(new TechnicalAgent());

// All agent routes require authentication
router.use(requireAuth);

// ─── Validation ─────────────────────────────────────────────────────────────

const runAgentSchema = z.object({
  symbol: z.string().min(1),
  decisionAsOf: z.string().datetime({ offset: true }).optional(),
});

// ─── GET /api/agents — list registered agents ───────────────────────────────

router.get("/", (_req: Request, res: Response) => {
  res.json({ agents: listAgents() });
});

// ─── POST /api/agents/technical/run ─────────────────────────────────────────

router.post("/technical/run", async (req: Request, res: Response) => {
  try {
    const body = runAgentSchema.safeParse(req.body);
    if (!body.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: body.error.flatten() });
      return;
    }

    const { symbol } = body.data;
    const decisionAsOf =
      body.data.decisionAsOf ?? new Date().toISOString();

    const output = await executeAgent(
      "technical",
      {
        symbol,
        timeframe: "1D",
        decisionAsOf,
        features: {},
      },
      { userId: req.user!.userId }
    );

    res.json(output);
  } catch (err) {
    logger.error({ err }, "Technical agent run failed");
    const message =
      err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export { router as agentsRouter };
