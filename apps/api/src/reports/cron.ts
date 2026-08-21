/**
 * OWNER: M2 (Quant) & M4 (Platform)
 * Scheduled market-close cron worker for automatic EOD reporting.
 */

import { type CronStatusResponse } from "@committee/contracts";
import { eodReportService } from "./service.js";

export class EodCronScheduler {
  private timer: NodeJS.Timeout | null = null;
  private active = false;
  private lastRunAt: string | undefined;
  private lastRunStatus: "ok" | "failed" | "idle" = "idle";
  private readonly cronSchedule = "0 16 * * 1-5 (16:00 ET Mon-Fri)";

  /**
   * Starts the background scheduler.
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    // Check periodically (every 60 seconds) if it is market close time
    this.timer = setInterval(() => {
      void this.checkAndExecute();
    }, 60_000);
  }

  /**
   * Stops the background scheduler.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.active = false;
  }

  /**
   * Checks if current time is within market close minute.
   */
  private async checkAndExecute(): Promise<void> {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    // Monday (1) to Friday (5)
    if (dayOfWeek === 0 || dayOfWeek === 6) return;

    // 16:00 ET is 20:00 UTC (during EDT) or 21:00 UTC (during EST)
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();

    if ((hour === 20 || hour === 21) && minute === 0) {
      await this.triggerManual();
    }
  }

  /**
   * Triggers an immediate EOD run (useful for testing and on-demand generation).
   */
  async triggerManual(
    userId: string = "00000000-0000-4000-8000-000000000000",
  ): Promise<{ ok: boolean; reportId?: string; error?: string }> {
    try {
      const report = await eodReportService.generateAndDispatch(userId, {
        notifyTelegram: true,
      });
      this.lastRunAt = new Date().toISOString();
      this.lastRunStatus = "ok";
      return { ok: true, reportId: report.id };
    } catch (err) {
      this.lastRunAt = new Date().toISOString();
      this.lastRunStatus = "failed";
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Returns scheduler status.
   */
  getStatus(): CronStatusResponse {
    // Calculate approximate next run time
    const nextRun = new Date();
    nextRun.setUTCHours(20, 0, 0, 0);
    if (nextRun.getTime() <= Date.now()) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    return {
      active: this.active,
      cronSchedule: this.cronSchedule,
      nextRun: nextRun.toISOString(),
      lastRunAt: this.lastRunAt,
      lastRunStatus: this.lastRunStatus,
    };
  }
}

export const eodCronScheduler = new EodCronScheduler();
