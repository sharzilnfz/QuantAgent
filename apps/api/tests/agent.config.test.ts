import { describe, expect, it, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { CommitteeSystemConfig, DEFAULT_COMMITTEE_CONFIG } from "@committee/contracts";

import { buildApp } from "../src/app.js";
import { AgentConfigService } from "../src/settings/service.js";

describe("Agent Configuration Service & Contracts", () => {
  let service: AgentConfigService;

  beforeEach(() => {
    service = new AgentConfigService();
  });

  it("returns contract-valid default configuration on boot", async () => {
    const config = await service.getConfig("user-1");
    expect(CommitteeSystemConfig.safeParse(config).success).toBe(true);
    expect(config.specialists.technical.enabled).toBe(true);
    expect(config.risk.maxPositionPct).toBe(20);
    expect(config.consensus.protocol).toBe("majority_fast_pass");
  });

  it("updates and persists partial configuration changes", async () => {
    const updated = await service.updateConfig(
      {
        risk: {
          ...DEFAULT_COMMITTEE_CONFIG.risk,
          maxPositionPct: 15,
          stopLossPct: 3.5,
        },
        specialists: {
          ...DEFAULT_COMMITTEE_CONFIG.specialists,
          polymarket: {
            enabled: false,
            weight: 0.5,
            modelTier: "cheap",
            temperature: 0.1,
          },
        },
      },
      "user-1",
    );

    expect(updated.risk.maxPositionPct).toBe(15);
    expect(updated.risk.stopLossPct).toBe(3.5);
    expect(updated.specialists.polymarket.enabled).toBe(false);

    const reloaded = await service.getConfig("user-1");
    expect(reloaded.risk.maxPositionPct).toBe(15);
    expect(reloaded.specialists.polymarket.enabled).toBe(false);
  });

  it("resets configuration back to system default baseline", async () => {
    await service.updateConfig(
      {
        risk: {
          ...DEFAULT_COMMITTEE_CONFIG.risk,
          maxPositionPct: 30,
        },
      },
      "user-1",
    );

    const reset = await service.resetConfig("user-1");
    expect(reset.risk.maxPositionPct).toBe(20);

    const active = await service.getConfig("user-1");
    expect(active.risk.maxPositionPct).toBe(20);
  });
});

describe("Agent Configuration Fastify HTTP Endpoints", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("GET /agents/config returns valid configuration", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/agents/config",
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(CommitteeSystemConfig.safeParse(json).success).toBe(true);
    expect(json.specialists).toHaveProperty("technical");
    expect(json.specialists).toHaveProperty("sentiment");
    expect(json.specialists).toHaveProperty("fundamental");
    expect(json.specialists).toHaveProperty("polymarket");
  });

  it("PUT /agents/config updates configuration", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/agents/config",
      payload: {
        risk: {
          ...DEFAULT_COMMITTEE_CONFIG.risk,
          maxPositionPct: 25,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().risk.maxPositionPct).toBe(25);
  });

  it("PUT /agents/config rejects out-of-bounds risk parameters", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/agents/config",
      payload: {
        risk: {
          maxPositionPct: 999, // Exceeds max 50%
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("POST /agents/config/reset restores system baseline", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/agents/config/reset",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().risk.maxPositionPct).toBe(20);
  });
});
