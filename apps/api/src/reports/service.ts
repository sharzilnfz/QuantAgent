/**
 * OWNER: M2 (Quant) & M4 (Platform)
 * End-of-Day (EOD) summary computation, archival, and automated dispatch.
 */

import { randomUUID } from "node:crypto";
import {
  type EodReportRecord,
  EodReportRecord as EodReportRecordSchema,
} from "@committee/contracts";

import { getPortfolioState, getPortfolioHistory } from "../portfolio/service.js";
import { telegramBotService } from "../telegram/service.js";

export class EodReportService {
  private history = new Map<string, EodReportRecord[]>();

  /**
   * Computes an End-of-Day snapshot for a user.
   */
  async generateReport(
    userId: string = "00000000-0000-4000-8000-000000000000",
    options?: { asOf?: string },
  ): Promise<EodReportRecord> {
    const asOf = options?.asOf ?? new Date().toISOString();
    const portfolio = await getPortfolioState(userId);
    const historyPoints = await getPortfolioHistory(userId);

    // Calculate day change vs previous snapshot if available
    let dayChange = 0;
    let dayChangePercent = 0;
    if (historyPoints.length >= 2) {
      const prev = historyPoints[historyPoints.length - 2]?.equity ?? portfolio.equity;
      dayChange = portfolio.equity - prev;
      dayChangePercent = prev > 0 ? (dayChange / prev) * 100 : 0;
    } else if (portfolio.positions.length > 0) {
      dayChange = portfolio.positions.reduce((acc, p) => acc + (p.unrealizedPl ?? 0), 0);
      const startingCapital = portfolio.equity - dayChange;
      dayChangePercent = startingCapital > 0 ? (dayChange / startingCapital) * 100 : 0;
    }

    const topPositions = portfolio.positions.map((p) => ({
      symbol: p.symbol,
      qty: p.qty,
      marketValue: p.marketValue,
      unrealizedPl: p.unrealizedPl,
    }));

    const record: EodReportRecord = {
      id: randomUUID(),
      asOf,
      createdAt: new Date().toISOString(),
      portfolioEquity: portfolio.equity,
      cash: portfolio.cash,
      dayChange,
      dayChangePercent,
      benchmarkSymbol: "SPY",
      benchmarkReturnPercent: 0.15, // Synthetic/fixture default
      executedTradesCount: portfolio.positions.length,
      topPositions,
      dispatchedTelegram: false,
    };

    return EodReportRecordSchema.parse(record);
  }

  /**
   * Generates and dispatches the EOD report via Telegram, persisting the snapshot record.
   */
  async generateAndDispatch(
    userId: string = "00000000-0000-4000-8000-000000000000",
    options?: { asOf?: string; notifyTelegram?: boolean; chatId?: string | number },
  ): Promise<EodReportRecord> {
    const report = await this.generateReport(userId, options);
    const notifyTelegram = options?.notifyTelegram ?? true;

    let dispatched = false;
    if (notifyTelegram) {
      const tgRes = await telegramBotService.notifyEodDigest(
        {
          asOf: report.asOf,
          portfolioEquity: report.portfolioEquity,
          cash: report.cash,
          dayChange: report.dayChange,
          dayChangePercent: report.dayChangePercent,
          executedTradesCount: report.executedTradesCount,
          topPositions: report.topPositions,
        },
        options?.chatId,
      );
      dispatched = tgRes.ok;
    }

    const persisted: EodReportRecord = {
      ...report,
      dispatchedTelegram: dispatched,
    };

    const userRecords = this.history.get(userId) ?? [];
    userRecords.unshift(persisted);
    this.history.set(userId, userRecords);

    return persisted;
  }

  /**
   * Retrieves the most recent EOD snapshot.
   */
  async getLatestReport(
    userId: string = "00000000-0000-4000-8000-000000000000",
  ): Promise<EodReportRecord> {
    const userRecords = this.history.get(userId) ?? [];
    if (userRecords.length > 0 && userRecords[0]) {
      return userRecords[0];
    }
    // Generate on demand if no prior run exists
    return this.generateAndDispatch(userId, { notifyTelegram: false });
  }

  /**
   * Retrieves historical EOD reports for longitudinal performance review.
   */
  async getReportHistory(
    userId: string = "00000000-0000-4000-8000-000000000000",
  ): Promise<EodReportRecord[]> {
    return this.history.get(userId) ?? [];
  }
}

export const eodReportService = new EodReportService();
