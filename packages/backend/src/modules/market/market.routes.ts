import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  ingestBars,
  getStoredBars,
  getStoredIndicators,
  assetExists,
} from "./market.service.js";
import { computeAndStoreIndicators } from "../../lib/quantClient.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("market-routes");
const router: Router = Router();

// All market routes require authentication
router.use(requireAuth);

// ─── POST /api/ingest/:symbol ───────────────────────────────────────────────

router.post("/ingest/:symbol", async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    const timeframe = (req.query.timeframe as string) ?? "1D";

    // Verify asset exists
    const exists = await assetExists(symbol);
    if (!exists) {
      res.status(404).json({ error: `Asset ${symbol} not found in watchlist` });
      return;
    }

    // Step 1: Ingest bars from Alpaca
    const ingestionResult = await ingestBars(
      req.user!.userId,
      symbol,
      timeframe
    );

    // Step 2: Compute and store indicators via quant service
    let indicatorResult = null;
    try {
      indicatorResult = await computeAndStoreIndicators(symbol, timeframe);
    } catch (err) {
      logger.warn({ err, symbol }, "Indicator computation failed (non-fatal)");
    }

    res.json({
      message: "Ingestion complete",
      bars: ingestionResult,
      indicators: indicatorResult,
    });
  } catch (err) {
    logger.error({ err }, "Ingestion failed");
    const message =
      err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ─── GET /api/assets/:symbol/bars ───────────────────────────────────────────

router.get("/assets/:symbol/bars", async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    const timeframe = (req.query.timeframe as string) ?? "1D";

    const bars = await getStoredBars(symbol, timeframe);
    res.json({ symbol, timeframe, count: bars.length, bars });
  } catch (err) {
    logger.error({ err }, "Failed to fetch bars");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/assets/:symbol/indicators ─────────────────────────────────────

router.get(
  "/assets/:symbol/indicators",
  async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol as string;
      const timeframe = (req.query.timeframe as string) ?? "1D";

      const indicators = await getStoredIndicators(symbol, timeframe);
      res.json({ symbol, timeframe, count: indicators.length, indicators });
    } catch (err) {
      logger.error({ err }, "Failed to fetch indicators");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export { router as marketRouter };
