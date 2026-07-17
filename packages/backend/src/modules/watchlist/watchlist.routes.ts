import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../auth/auth.middleware.js";
import { db } from "../../db/client.js";
import { watchlistItems, assets } from "../../db/schema.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("watchlist-routes");
const router: Router = Router();

// All watchlist routes require authentication
router.use(requireAuth);

// ─── Validation ─────────────────────────────────────────────────────────────

const addSymbolSchema = z.object({
  symbol: z.string().min(1).max(20),
});

// ─── GET /api/watchlist ─────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  try {
    const items = await db
      .select({
        id: watchlistItems.id,
        symbol: watchlistItems.symbol,
        addedAt: watchlistItems.addedAt,
        name: assets.name,
        exchange: assets.exchange,
      })
      .from(watchlistItems)
      .innerJoin(assets, eq(watchlistItems.symbol, assets.symbol))
      .where(eq(watchlistItems.userId, req.user!.userId))
      .orderBy(watchlistItems.addedAt);

    res.json({ items });
  } catch (err) {
    logger.error({ err }, "Failed to fetch watchlist");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/watchlist ────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = addSymbolSchema.safeParse(req.body);
    if (!body.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: body.error.flatten() });
      return;
    }

    const { symbol } = body.data;

    // Verify asset exists
    const [asset] = await db
      .select()
      .from(assets)
      .where(eq(assets.symbol, symbol.toUpperCase()))
      .limit(1);

    if (!asset) {
      res.status(404).json({ error: `Asset "${symbol}" not found` });
      return;
    }

    const [item] = await db
      .insert(watchlistItems)
      .values({
        userId: req.user!.userId,
        symbol: asset.symbol,
      })
      .onConflictDoNothing()
      .returning();

    if (!item) {
      res.status(409).json({ error: `${symbol} is already in your watchlist` });
      return;
    }

    res.status(201).json({
      id: item.id,
      symbol: item.symbol,
      addedAt: item.addedAt,
    });
  } catch (err) {
    logger.error({ err }, "Failed to add to watchlist");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/watchlist/:id ───────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const deleted = await db
      .delete(watchlistItems)
      .where(
        and(
          eq(watchlistItems.id, id),
          eq(watchlistItems.userId, req.user!.userId)
        )
      )
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Watchlist item not found" });
      return;
    }

    res.json({ message: "Removed from watchlist" });
  } catch (err) {
    logger.error({ err }, "Failed to remove from watchlist");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as watchlistRouter };
