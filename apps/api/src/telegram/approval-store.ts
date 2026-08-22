/**
 * OWNER: M4 — Platform / Risk Lead
 * Thread-safe in-memory store and state machine for pending trade approvals.
 */

import { type PendingTradeApproval, type TradeApprovalStatus } from "@committee/contracts";

export class PendingTradeApprovalStore {
  private readonly approvals = new Map<string, PendingTradeApproval>();

  /**
   * Inserts a new pending approval into the store.
   */
  add(approval: PendingTradeApproval): PendingTradeApproval {
    this.approvals.set(approval.approvalId, { ...approval });
    return this.get(approval.approvalId)!;
  }

  /**
   * Retrieves an approval by full UUID or unique prefix (e.g. first 8 characters).
   */
  get(approvalIdOrPrefix: string): PendingTradeApproval | undefined {
    this.expireStale();

    const normalized = approvalIdOrPrefix.trim().toLowerCase();
    if (this.approvals.has(normalized)) {
      return this.approvals.get(normalized);
    }

    // Prefix search
    for (const [id, item] of this.approvals.entries()) {
      if (id.toLowerCase().startsWith(normalized)) {
        return item;
      }
    }

    return undefined;
  }

  /**
   * Lists all approvals, optionally filtered by status.
   */
  list(status?: TradeApprovalStatus): PendingTradeApproval[] {
    this.expireStale();
    const all = Array.from(this.approvals.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (status) {
      return all.filter((a) => a.status === status);
    }
    return all;
  }

  /**
   * Resolves a pending trade approval with terminal status.
   */
  resolve(
    approvalIdOrPrefix: string,
    resolution: {
      status: "approved" | "rejected" | "expired";
      resolvedBy: string;
      resolutionReason?: string;
      executionId?: string;
    },
  ): PendingTradeApproval {
    const existing = this.get(approvalIdOrPrefix);
    if (!existing) {
      throw new Error(`Pending approval "${approvalIdOrPrefix}" not found.`);
    }

    if (existing.status !== "pending") {
      throw new Error(
        `Approval "${existing.approvalId}" is already resolved (status: ${existing.status}).`,
      );
    }

    const updated: PendingTradeApproval = {
      ...existing,
      status: resolution.status,
      resolvedBy: resolution.resolvedBy,
      resolvedAt: new Date().toISOString(),
      resolutionReason: resolution.resolutionReason,
      executionId: resolution.executionId,
    };

    this.approvals.set(existing.approvalId, updated);
    return updated;
  }

  /**
   * Automatically marks expired pending approvals whose expiresAt timestamp is in the past.
   */
  expireStale(now: Date = new Date()): number {
    let expiredCount = 0;
    const nowMs = now.getTime();

    for (const [id, item] of this.approvals.entries()) {
      if (item.status === "pending" && new Date(item.expiresAt).getTime() <= nowMs) {
        this.approvals.set(id, {
          ...item,
          status: "expired",
          resolvedBy: "System (TTL Expired)",
          resolvedAt: new Date(nowMs).toISOString(),
          resolutionReason: "Approval window timed out before receiving confirmation.",
        });
        expiredCount += 1;
      }
    }

    return expiredCount;
  }

  /**
   * Clears the store (useful for tests).
   */
  clear(): void {
    this.approvals.clear();
  }
}

// Global shared singleton instance for the API service
export const pendingTradeApprovalStore = new PendingTradeApprovalStore();
