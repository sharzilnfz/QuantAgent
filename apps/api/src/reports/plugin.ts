/**
 * OWNER: M2 (Quant) & M4 (Platform)
 * Fastify plugin for EOD summary reports and cron worker control.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eodReportService } from "./service.js";
import { eodCronScheduler } from "./cron.js";

const TriggerBody = z.object({
  notifyTelegram: z.boolean().default(true),
  chatId: z.union([z.string(), z.number()]).optional(),
  asOf: z.string().datetime().optional(),
});

export async function reportsPlugin(app: FastifyInstance): Promise<void> {
  /**
   * Automatically start cron scheduler on server ready and clean up on close.
   */
  app.addHook("onReady", async () => {
    eodCronScheduler.start();
  });

  app.addHook("onClose", async () => {
    eodCronScheduler.stop();
  });

  /**
   * Fetch the latest EOD snapshot report.
   */
  app.get("/reports/eod/latest", async (request) => {
    const userId = (request.user as { id?: string } | undefined)?.id;
    return eodReportService.getLatestReport(userId);
  });

  /**
   * Fetch historical archived EOD snapshots.
   */
  app.get("/reports/eod/history", async (request) => {
    const userId = (request.user as { id?: string } | undefined)?.id;
    return eodReportService.getReportHistory(userId);
  });

  /**
   * Manually trigger an EOD summary calculation and dispatch.
   */
  app.post("/reports/eod/trigger", async (request, reply) => {
    const parsed = TriggerBody.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_trigger_body",
        issues: parsed.error.issues,
      });
    }

    const userId = (request.user as { id?: string } | undefined)?.id;
    const report = await eodReportService.generateAndDispatch(userId, {
      asOf: parsed.data.asOf,
      notifyTelegram: parsed.data.notifyTelegram,
      chatId: parsed.data.chatId,
    });

    return reply.code(200).send(report);
  });

  /**
   * Fetch EOD cron scheduler health & status.
   */
  app.get("/reports/cron/status", async () => {
    return eodCronScheduler.getStatus();
  });
}
