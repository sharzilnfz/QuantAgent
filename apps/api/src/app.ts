import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";

import { authPlugin } from "./auth/plugin.js";
import { credentialsPlugin } from "./credentials/plugin.js";
import { ingestPlugin } from "./ingest/plugin.js";
import { portfolioPlugin } from "./portfolio/plugin.js";
import { agentsPlugin } from "./agents/plugin.js";
import { experimentsPlugin } from "./experiments/plugin.js";
import { riskPlugin } from "./risk/plugin.js";
import { executionPlugin } from "./execution/plugin.js";
import { telegramPlugin } from "./telegram/plugin.js";
import { settingsPlugin } from "./settings/plugin.js";
import { reportsPlugin } from "./reports/plugin.js";
import { signalsPlugin } from "./signals/plugin.js";
import { streamingPlugin } from "./streaming/plugin.js";
import { daemonPlugin } from "./daemon/plugin.js";
import { mcpPlugin } from "./mcp/plugin.js";

/**
 * buildApp() constructs the Fastify instance and registers every domain plugin.
 *
 * OWNERSHIP: this file is the stable composition root. Do NOT add route logic
 * here — each domain owns its own plugin file (see imports above). Adding a new
 * domain = new plugin file + one register() line, reviewed as a shared change.
 *
 *   auth/credentials/portfolio/experiments/risk/execution/telegram/settings/reports/signals/streaming/daemon/mcp -> M4    ingest -> M2    agents -> M1
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      // Never log auth/credential bodies — see auth/credentials plugins for redaction.
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
  });

  await app.register(cookie);

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authPlugin);
  await app.register(credentialsPlugin);
  await app.register(ingestPlugin);
  await app.register(portfolioPlugin);
  await app.register(agentsPlugin);
  await app.register(experimentsPlugin);
  await app.register(riskPlugin);
  await app.register(executionPlugin);
  await app.register(telegramPlugin);
  await app.register(settingsPlugin);
  await app.register(reportsPlugin);
  await app.register(signalsPlugin);
  await app.register(streamingPlugin);
  await app.register(daemonPlugin);
  await app.register(mcpPlugin);

  return app;
}
