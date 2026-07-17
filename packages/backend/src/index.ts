import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// ─── Global middleware ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// ─── Health check ───────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Routes ─────────────────────────────────────────────────────────────────
import { authRouter } from "./modules/auth/auth.routes.js";
import { credentialsRouter } from "./modules/credentials/credentials.routes.js";
import { marketRouter } from "./modules/market/market.routes.js";
import { agentsRouter } from "./modules/agents/agents.routes.js";
import { portfolioRouter } from "./modules/portfolio/portfolio.routes.js";
import { watchlistRouter } from "./modules/watchlist/watchlist.routes.js";

app.use("/api/auth", authRouter);
app.use("/api/credentials", credentialsRouter);
app.use("/api", marketRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/portfolio", portfolioRouter);
app.use("/api/watchlist", watchlistRouter);

// ─── Start server ───────────────────────────────────────────────────────────
const port = config.BACKEND_PORT;

app.listen(port, () => {
  logger.info({ port }, `🚀 QuantAgent backend listening on port ${port}`);
});

export { app };
