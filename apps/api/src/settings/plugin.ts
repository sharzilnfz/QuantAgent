/**
 * OWNER: M4 — Platform / Risk Lead
 * Fastify plugin for agent configuration and threshold tuning endpoints.
 */

import type { FastifyInstance } from "fastify";
import { CommitteeSystemConfig } from "@committee/contracts";
import { agentConfigService } from "./service.js";

export async function settingsPlugin(app: FastifyInstance): Promise<void> {
  /**
   * Fetch active committee configuration.
   */
  app.get("/agents/config", async (request) => {
    const userId = (request.user as { id?: string } | undefined)?.id;
    return agentConfigService.getConfig(userId);
  });

  app.get("/settings/config", async (request) => {
    const userId = (request.user as { id?: string } | undefined)?.id;
    return agentConfigService.getConfig(userId);
  });

  /**
   * Update active committee configuration.
   */
  app.put("/agents/config", async (request, reply) => {
    const parsed = CommitteeSystemConfig.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_config_payload",
        issues: parsed.error.issues,
      });
    }

    const userId = (request.user as { id?: string } | undefined)?.id;
    try {
      const updated = await agentConfigService.updateConfig(parsed.data, userId);
      return reply.code(200).send(updated);
    } catch (err) {
      return reply.code(400).send({
        error: "config_validation_failed",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  /**
   * Reset configuration to system baseline defaults.
   */
  app.post("/agents/config/reset", async (request) => {
    const userId = (request.user as { id?: string } | undefined)?.id;
    return agentConfigService.resetConfig(userId);
  });
}
