import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, mockApi, signedInRoutes } from "./harness";
import type { DaemonStatus, LiveSignalRadarResponse } from "@committee/contracts";

const mockDaemonStatus: DaemonStatus = {
  state: "idle",
  uptimeSeconds: 120,
  lastCycleAt: "2026-08-22T02:00:00.000Z",
  nextCycleAt: "2026-08-22T02:01:00.000Z",
  totalCycles: 5,
  successfulCycles: 5,
  failedCycles: 0,
  config: {
    enabled: false,
    intervalSeconds: 60,
    symbols: ["AAPL", "NVDA", "SPY"],
    dryRun: true,
    autoExecute: false,
    debateEnabled: true,
    minConfidence: 0.6,
  },
  lastCycleResult: {
    id: "cycle-001",
    startedAt: "2026-08-22T02:00:00.000Z",
    completedAt: "2026-08-22T02:00:01.000Z",
    durationMs: 950,
    symbolsEvaluated: ["AAPL", "NVDA", "SPY"],
    results: [
      {
        symbol: "AAPL",
        decisionTs: "2024-06-28T20:00:00.000Z",
        consensus: {
          lineageId: "l1",
          consensusReached: true,
          mode: "consensus_short_circuit",
          finalBias: "bullish",
          finalConfidence: 0.8,
          specialistVotes: {},
        },
        riskAssessment: {
          assessmentId: "r1",
          symbol: "AAPL",
          direction: "bullish",
          asOf: "2024-06-28T20:00:00.000Z",
          status: "APPROVED",
          executionAllowed: true,
          evaluatedRules: [],
          violations: [],
          adjustedConstraints: {},
          evaluatedAt: "2024-06-28T20:00:00.000Z",
        },
        actionTaken: "dry_run_recorded",
      },
    ],
  },
};

const mockRadarResponse: LiveSignalRadarResponse = {
  asOf: "2026-08-22T02:00:00.000Z",
  items: [
    {
      symbol: "AAPL",
      currentBar: {
        symbol: "AAPL",
        timeframe: "1Day",
        ts: "2024-06-28T20:00:00.000Z",
        open: 210.5,
        high: 212.8,
        low: 209.2,
        close: 210.62,
        volume: 48500000,
        asOf: "2024-06-28T20:00:00.000Z",
      },
      recentBars: [],
      indicators: {
        symbol: "AAPL",
        timeframe: "1Day",
        ts: "2024-06-28T20:00:00.000Z",
        rsi: 62.4,
        macd: 2.15,
        macdSignal: 1.82,
        bbUpper: 218.4,
        bbLower: 198.6,
        sma20: 205.1,
        sma50: 195.4,
        asOf: "2024-06-28T20:00:00.000Z",
      },
      rsiZone: "neutral",
      macdCross: "bullish",
      trend: "bullish",
      specialistVotes: {},
      consensus: {
        lineageId: "l1",
        consensusReached: true,
        mode: "consensus_short_circuit",
        finalBias: "bullish",
        finalConfidence: 0.8,
        specialistVotes: {},
      },
      asOf: "2024-06-28T20:00:00.000Z",
    },
  ],
};

describe("Autonomous Trading Daemon UI & Controls", () => {
  beforeEach(() => {
    mockApi({
      ...signedInRoutes(),
      "/daemon/status": { status: 200, body: mockDaemonStatus },
      "/daemon/start": {
        status: 200,
        body: { ...mockDaemonStatus, state: "running", config: { ...mockDaemonStatus.config, enabled: true } },
      },
      "/daemon/stop": {
        status: 200,
        body: { ...mockDaemonStatus, state: "paused", config: { ...mockDaemonStatus.config, enabled: false } },
      },
      "/daemon/run-cycle": {
        status: 200,
        body: mockDaemonStatus.lastCycleResult,
      },
      "/daemon/config": {
        status: 200,
        body: { ...mockDaemonStatus.config, dryRun: false },
      },
      "/signals/radar": { status: 200, body: mockRadarResponse },
    });
  });

  it("renders Autonomous Trading Daemon card and status indicators", async () => {
    renderApp("/signals");

    await waitFor(() => {
      expect(screen.getByText("Autonomous Trading Daemon (L4/L6)")).toBeInTheDocument();
    });

    expect(screen.getByText(/idle/i)).toBeInTheDocument();
    expect(screen.getByText(/Dry-Run Simulation/i)).toBeInTheDocument();
    expect(screen.getByText(/Every 60s/i)).toBeInTheDocument();
    expect(screen.getByText(/5/i)).toBeInTheDocument();
  });

  it("triggers start daemon and toggles button label", async () => {
    const user = userEvent.setup();
    renderApp("/signals");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start Daemon/i })).toBeInTheDocument();
    });

    const startBtn = screen.getByRole("button", { name: /Start Daemon/i });
    await user.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Daemon started/i)).toBeInTheDocument();
    });
  });

  it("triggers on-demand cycle execution", async () => {
    const user = userEvent.setup();
    renderApp("/signals");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Run Cycle Now/i })).toBeInTheDocument();
    });

    const runBtn = screen.getByRole("button", { name: /Run Cycle Now/i });
    await user.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cycle completed successfully/i)).toBeInTheDocument();
    });
  });
});
