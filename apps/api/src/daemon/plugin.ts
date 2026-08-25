import type { FastifyPluginAsync } from "fastify";
import { getTradingDaemon } from "./service.js";
import { DaemonConfig } from "@committee/contracts";
import { requireAuth } from "../auth/require-auth.js";

export const daemonPlugin: FastifyPluginAsync = async (app) => {
  const daemon = getTradingDaemon();

  // All daemon routes require authentication
  app.addHook("preHandler", requireAuth);

  /** `GET /daemon/status` -> DaemonStatus */
  app.get("/daemon/status", async (_request, reply) => {
    return reply.send(daemon.getStatus());
  });

  /** `POST /daemon/start` -> DaemonStatus */
  app.post("/daemon/start", async (_request, reply) => {
    return reply.send(daemon.start());
  });

  /** `POST /daemon/stop` -> DaemonStatus */
  app.post("/daemon/stop", async (_request, reply) => {
    return reply.send(daemon.stop());
  });

  /** `POST /daemon/run-cycle` -> DaemonCycleResult */
  app.post("/daemon/run-cycle", async (request, reply) => {
    const userId = request.user?.id ?? "00000000-0000-4000-8000-000000000000";
    const result = await daemon.executeCycle(userId);
    return reply.send(result);
  });

  /** `POST /daemon/config` -> DaemonConfig */
  app.post("/daemon/config", async (request, reply) => {
    const parsed = DaemonConfig.partial().safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_config", issues: parsed.error.issues });
    }
    const updated = daemon.updateConfig(parsed.data);
    return reply.send(updated);
  });
};
