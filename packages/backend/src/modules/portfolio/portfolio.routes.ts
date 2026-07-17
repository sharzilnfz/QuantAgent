import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getDecryptedAlpacaCredentials } from "../credentials/credentials.service.js";
import { createAlpacaClient } from "../../lib/alpaca.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("portfolio-routes");
const router: Router = Router();

// All portfolio routes require authentication
router.use(requireAuth);

// ─── GET /api/portfolio ─────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  try {
    const creds = await getDecryptedAlpacaCredentials(req.user!.userId);
    if (!creds) {
      res
        .status(400)
        .json({ error: "Alpaca credentials not configured. Please save your API keys first." });
      return;
    }

    const client = createAlpacaClient(creds);

    const [account, positions] = await Promise.all([
      client.getAccount(),
      client.getPositions(),
    ]);

    res.json({
      cash: parseFloat(account.cash),
      equity: parseFloat(account.equity),
      buyingPower: parseFloat(account.buying_power),
      portfolioValue: parseFloat(account.portfolio_value),
      positions: positions.map((p) => ({
        symbol: p.symbol,
        qty: parseFloat(p.qty),
        avgEntryPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        marketValue: parseFloat(p.market_value),
        unrealizedPl: parseFloat(p.unrealized_pl),
        unrealizedPlPct: parseFloat(p.unrealized_plpc),
        side: p.side,
      })),
      pnl: positions.reduce(
        (sum, p) => sum + parseFloat(p.unrealized_pl),
        0
      ),
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch portfolio");
    const message =
      err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export { router as portfolioRouter };
