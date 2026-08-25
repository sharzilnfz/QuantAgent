import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, mockApi, signedInRoutes } from "./harness";
import type { LiveSignalRadarResponse } from "@committee/contracts";

const mockRadarResponse: LiveSignalRadarResponse = {
  asOf: "2026-08-14T20:00:00.000Z",
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
      recentBars: [
        {
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
      ],
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
      specialistVotes: {
        technical: {
          agent: "technical",
          direction: "bullish",
          confidence: 0.75,
          rationale: "RSI 62.4 in bullish territory and positive MACD expansion above SMA20.",
          evidence: { rsi: 62.4, sma20: 205.1 },
        },
        sentiment: {
          agent: "sentiment",
          direction: "bullish",
          confidence: 0.68,
          rationale: "Strong positive institutional sentiment on WWDC AI announcements.",
          evidence: { headlineCount: 4 },
        },
        fundamental: {
          agent: "fundamental",
          direction: "bullish",
          confidence: 0.72,
          rationale: "High operating margins and positive free cash flow expansion.",
          evidence: { revenueGrowthYoY: 0.08 },
        },
        polymarket: {
          agent: "polymarket",
          direction: "neutral",
          confidence: 0.5,
          rationale: "Macro rate expectations steady with no imminent FOMC rate surprises.",
          evidence: { cutProbability: 0.65 },
        },
      },
      consensus: {
        lineageId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        consensusReached: true,
        mode: "consensus_short_circuit",
        finalBias: "bullish",
        finalConfidence: 0.75,
        specialistVotes: {
          technical: {
            agent: "technical",
            direction: "bullish",
            confidence: 0.75,
            rationale: "RSI 62.4 in bullish territory.",
            evidence: {},
          },
        },
        metadata: {
          runId: "run-001",
          durationMs: 42,
          tokenCost: 0,
        },
      },
      newsHeadline: "Apple Unveils On-Device AI Features at WWDC Keynote",
      asOf: "2024-06-28T20:00:00.000Z",
    },
    {
      symbol: "NVDA",
      currentBar: {
        symbol: "NVDA",
        timeframe: "1Day",
        ts: "2024-06-28T20:00:00.000Z",
        open: 124.0,
        high: 127.5,
        low: 123.1,
        close: 126.2,
        volume: 92000000,
        asOf: "2024-06-28T20:00:00.000Z",
      },
      recentBars: [],
      indicators: {
        symbol: "NVDA",
        timeframe: "1Day",
        ts: "2024-06-28T20:00:00.000Z",
        rsi: 71.5,
        macd: 3.4,
        macdSignal: 3.1,
        bbUpper: 132.0,
        bbLower: 110.0,
        sma20: 120.0,
        sma50: 105.0,
        asOf: "2024-06-28T20:00:00.000Z",
      },
      rsiZone: "overbought",
      macdCross: "bullish",
      trend: "bullish",
      specialistVotes: {},
      consensus: {
        lineageId: "b2c3d4e5-f6a7-8901-bcde-f23456789012",
        consensusReached: true,
        mode: "consensus_short_circuit",
        finalBias: "bullish",
        finalConfidence: 0.8,
        specialistVotes: {},
      },
      newsHeadline: "Nvidia Data Center Demand Continues Accelerating",
      asOf: "2024-06-28T20:00:00.000Z",
    },
  ],
};

describe("Signals Page & Technical Indicator Radar", () => {
  beforeEach(() => {
    mockApi({
      ...signedInRoutes(),
      "/signals/radar": { status: 200, body: mockRadarResponse },
      "/signals/evaluate": {
        status: 200,
        body: {
          symbol: "AAPL",
          consensus: { finalBias: "bullish", finalConfidence: 0.8 },
        },
      },
    });
  });

  it("renders Live Signals header, indicator gauges, and specialist stance matrix", async () => {
    renderApp("/signals");

    await waitFor(() => {
      expect(screen.getByText("Live Signals & Indicator Radar")).toBeInTheDocument();
    });

    // Technical indicator gauges
    expect(screen.getAllByText(/Wilder RSI/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/MACD/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Bollinger Bands/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Trend Alignment/i)[0]).toBeInTheDocument();

    // RSI value
    expect(screen.getAllByText(/62.4/)[0]).toBeInTheDocument();

    // Specialist cards
    expect(screen.getAllByText(/technical/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/sentiment/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/fundamental/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/polymarket/i)[0]).toBeInTheDocument();

    // Consensus resolution
    expect(screen.getByText("L3 Multi-Agent Coordinator Consensus")).toBeInTheDocument();
    expect(screen.getByText(/Consensus Fast-Pass/i)).toBeInTheDocument();

    // News snapshot
    expect(
      screen.getByText(/Apple Unveils On-Device AI Features at WWDC Keynote/i),
    ).toBeInTheDocument();
  });

  it("provides accessible WCAG table-view twin for raw indicator values", async () => {
    renderApp("/signals");

    await waitFor(() => {
      expect(screen.getByText(/Accessible Table View: Raw Indicator & Price Bar Values/i)).toBeInTheDocument();
    });

    const summary = screen.getByText(/Accessible Table View: Raw Indicator & Price Bar Values/i);
    expect(summary).toBeInTheDocument();
  });

  it("toggles symbol when selecting another asset pill", async () => {
    const user = userEvent.setup();
    renderApp("/signals");

    await waitFor(() => {
      expect(screen.getByText("AAPL")).toBeInTheDocument();
    });

    const nvdaButton = screen.getByRole("button", { name: /NVDA/i });
    await user.click(nvdaButton);

    await waitFor(() => {
      // NVDA RSI is 71.5
      expect(screen.getByText("71.5")).toBeInTheDocument();
      expect(screen.getByText(/Nvidia Data Center Demand/i)).toBeInTheDocument();
    });
  });
});
