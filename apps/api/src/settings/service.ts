/**
 * OWNER: M4 — Platform / Risk Lead
 * Agent and Committee configuration service with in-memory persistence and default fallback.
 */

import {
  type CommitteeSystemConfig,
  CommitteeSystemConfig as CommitteeSystemConfigSchema,
  DEFAULT_COMMITTEE_CONFIG,
} from "@committee/contracts";

export class AgentConfigService {
  private userConfigs = new Map<string, CommitteeSystemConfig>();

  /**
   * Retrieves active configuration for a user, or defaults to baseline.
   */
  async getConfig(userId?: string): Promise<CommitteeSystemConfig> {
    if (userId && this.userConfigs.has(userId)) {
      return this.userConfigs.get(userId)!;
    }
    return {
      ...DEFAULT_COMMITTEE_CONFIG,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Updates configuration for a user.
   */
  async updateConfig(
    newConfig: Partial<CommitteeSystemConfig>,
    userId?: string,
  ): Promise<CommitteeSystemConfig> {
    const current = await this.getConfig(userId);
    const merged = {
      ...current,
      ...newConfig,
      specialists: {
        ...current.specialists,
        ...(newConfig.specialists ?? {}),
      },
      risk: {
        ...current.risk,
        ...(newConfig.risk ?? {}),
      },
      consensus: {
        ...current.consensus,
        ...(newConfig.consensus ?? {}),
      },
      telegram: {
        ...current.telegram,
        ...(newConfig.telegram ?? {}),
      },
      updatedAt: new Date().toISOString(),
    };

    const validated = CommitteeSystemConfigSchema.parse(merged);
    const targetUser = userId ?? "default-user";
    this.userConfigs.set(targetUser, validated);
    return validated;
  }

  /**
   * Resets configuration back to system default.
   */
  async resetConfig(userId?: string): Promise<CommitteeSystemConfig> {
    const targetUser = userId ?? "default-user";
    const reset = {
      ...DEFAULT_COMMITTEE_CONFIG,
      updatedAt: new Date().toISOString(),
    };
    this.userConfigs.set(targetUser, reset);
    return reset;
  }
}

export const agentConfigService = new AgentConfigService();
