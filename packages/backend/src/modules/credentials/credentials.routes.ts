import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  storeAlpacaCredentials,
  getAlpacaCredentialStatus,
} from "./credentials.service.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("credentials-routes");
const router: Router = Router();

// All credentials routes require authentication
router.use(requireAuth);

// ─── Validation ─────────────────────────────────────────────────────────────

const alpacaCredentialsSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  apiSecret: z.string().min(1, "API secret is required"),
  isPaper: z.boolean().default(true),
});

// ─── PUT /api/credentials/alpaca ────────────────────────────────────────────

router.put("/alpaca", async (req: Request, res: Response) => {
  try {
    const body = alpacaCredentialsSchema.safeParse(req.body);
    if (!body.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: body.error.flatten() });
      return;
    }

    const { apiKey, apiSecret, isPaper } = body.data;

    await storeAlpacaCredentials(req.user!.userId, apiKey, apiSecret, isPaper);

    res.json({ message: "Alpaca credentials saved", isPaper });
  } catch (err) {
    logger.error({ err }, "Failed to store Alpaca credentials");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/credentials/alpaca/status ─────────────────────────────────────

router.get("/alpaca/status", async (req: Request, res: Response) => {
  try {
    const status = await getAlpacaCredentialStatus(req.user!.userId);
    res.json(status);
  } catch (err) {
    logger.error({ err }, "Failed to check credential status");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as credentialsRouter };
