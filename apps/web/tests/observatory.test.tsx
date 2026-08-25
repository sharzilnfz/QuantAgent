import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, mockApi, signedInRoutes } from "./harness";
import { ExperimentSuiteResult, ExperimentManifest } from "@committee/contracts";

const mockBenchmarkManifest: ExperimentManifest = ExperimentManifest.parse({
  id: "c8e19e76-3e74-4b5b-8d18-208b0df91b32",
  createdAt: "2026-08-14T12:00:00.000Z",
  gitCommit: "a1b2c3d",
  datasetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  symbol: "AAPL",
  timeframe: "1Day",
  strategy: {
    name: "buy-and-hold",
    type: "baseline",
    description: "Passive 100% long buy-and-hold benchmark",
    parameters: {},
  },
  metrics: {
    initialCash: 100000,
    finalEquity: 115400,
    totalReturn: 0.154,
    annualizedReturn: 0.154,
    sharpeRatio: 1.25,
    sortinoRatio: 1.62,
    maxDrawdown: 0.112,
    profitFactor: 1.8,
    winRate: 0.58,
    totalTurnover: 100000,
    tradeCount: 1,
  },
  trades: [],
  equityCurve: [
    { ts: "2024-01-02T21:00:00.000Z", cash: 0, position: 1000, price: 100, equity: 100000, drawdown: 0 },
    { ts: "2024-01-03T21:00:00.000Z", cash: 0, position: 1000, price: 102, equity: 102000, drawdown: 0 },
    { ts: "2024-01-04T21:00:00.000Z", cash: 0, position: 1000, price: 101.5, equity: 101500, drawdown: 0.0049 },
    { ts: "2024-01-05T21:00:00.000Z", cash: 0, position: 1000, price: 115.4, equity: 115400, drawdown: 0 },
  ],
  tokenCost: 0,
  latencyMs: 0,
  fallbackRate: 0,
});

const mockSmaRsiManifest: ExperimentManifest = ExperimentManifest.parse({
  id: "d9f20e87-4f85-5c6c-9e29-319c1ef02c43",
  createdAt: "2026-08-14T12:00:00.000Z",
  gitCommit: "a1b2c3d",
  datasetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  symbol: "AAPL",
  timeframe: "1Day",
  strategy: {
    name: "sma-rsi",
    type: "baseline",
    description: "Deterministic SMA(20/50) + RSI(14) baseline",
    parameters: {},
  },
  metrics: {
    initialCash: 100000,
    finalEquity: 108200,
    totalReturn: 0.082,
    annualizedReturn: 0.082,
    sharpeRatio: 0.94,
    sortinoRatio: 1.15,
    maxDrawdown: 0.075,
    profitFactor: 1.4,
    winRate: 0.52,
    totalTurnover: 600000,
    tradeCount: 6,
  },
  benchmarkDelta: {
    totalReturn: -0.072,
    annualizedReturn: -0.072,
    sharpeRatio: -0.31,
    sortinoRatio: -0.47,
    maxDrawdown: -0.037,
    deltaTotalReturn: -0.072,
    deltaAnnualizedReturn: -0.072,
    deltaSharpeRatio: -0.31,
    deltaSortinoRatio: -0.47,
    deltaMaxDrawdown: -0.037,
  },
  trades: [],
  equityCurve: [
    { ts: "2024-01-02T21:00:00.000Z", cash: 100000, position: 0, price: 100, equity: 100000, drawdown: 0 },
    { ts: "2024-01-03T21:00:00.000Z", cash: 100500, position: 0, price: 102, equity: 100500, drawdown: 0 },
    { ts: "2024-01-04T21:00:00.000Z", cash: 0, position: 1024, price: 101.5, equity: 104000, drawdown: 0 },
    { ts: "2024-01-05T21:00:00.000Z", cash: 108200, position: 0, price: 115.4, equity: 108200, drawdown: 0 },
  ],
  tokenCost: 0,
  latencyMs: 0,
  fallbackRate: 0,
});

const mockDebateOnManifest: ExperimentManifest = ExperimentManifest.parse({
  id: "e0a31f98-5a96-6d7d-af3a-42ad2f013d54",
  createdAt: "2026-08-14T12:00:00.000Z",
  gitCommit: "a1b2c3d",
  datasetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  symbol: "AAPL",
  timeframe: "1Day",
  strategy: {
    name: "multi-agent-debate-on",
    type: "multi-agent",
    description: "Multi-agent committee with conditional debate synthesis",
    parameters: { debateEnabled: true },
  },
  metrics: {
    initialCash: 100000,
    finalEquity: 122800,
    totalReturn: 0.228,
    annualizedReturn: 0.228,
    sharpeRatio: 1.88,
    sortinoRatio: 2.45,
    maxDrawdown: 0.058,
    profitFactor: 2.3,
    winRate: 0.67,
    totalTurnover: 850000,
    tradeCount: 9,
  },
  benchmarkDelta: {
    totalReturn: 0.074,
    annualizedReturn: 0.074,
    sharpeRatio: 0.63,
    sortinoRatio: 0.83,
    maxDrawdown: -0.054,
    deltaTotalReturn: 0.074,
    deltaAnnualizedReturn: 0.074,
    deltaSharpeRatio: 0.63,
    deltaSortinoRatio: 0.83,
    deltaMaxDrawdown: -0.054,
  },
  decisionMetrics: {
    directionalAccuracy: 0.78,
    brierScore: 0.142,
    abstentionQuality: 0.85,
    activeBarCount: 180,
    neutralBarCount: 72,
  },
  trades: [],
  equityCurve: [
    { ts: "2024-01-02T21:00:00.000Z", cash: 100000, position: 0, price: 100, equity: 100000, drawdown: 0 },
    { ts: "2024-01-03T21:00:00.000Z", cash: 0, position: 1014, price: 102, equity: 103500, drawdown: 0 },
    { ts: "2024-01-04T21:00:00.000Z", cash: 0, position: 1093, price: 101.5, equity: 111000, drawdown: 0 },
    { ts: "2024-01-05T21:00:00.000Z", cash: 122800, position: 0, price: 115.4, equity: 122800, drawdown: 0 },
  ],
  tokenCost: 0,
  latencyMs: 12,
  fallbackRate: 0,
});

const mockDebateOffManifest: ExperimentManifest = ExperimentManifest.parse({
  id: "f1b42a09-6b07-7e8e-b04b-53be30124e65",
  createdAt: "2026-08-14T12:00:00.000Z",
  gitCommit: "a1b2c3d",
  datasetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  symbol: "AAPL",
  timeframe: "1Day",
  strategy: {
    name: "multi-agent-debate-off",
    type: "multi-agent-ablation",
    description: "Multi-agent committee with neutral ablation fallback",
    parameters: { debateEnabled: false },
  },
  metrics: {
    initialCash: 100000,
    finalEquity: 116500,
    totalReturn: 0.165,
    annualizedReturn: 0.165,
    sharpeRatio: 1.34,
    sortinoRatio: 1.76,
    maxDrawdown: 0.082,
    profitFactor: 1.7,
    winRate: 0.56,
    totalTurnover: 500000,
    tradeCount: 5,
  },
  benchmarkDelta: {
    totalReturn: 0.011,
    annualizedReturn: 0.011,
    sharpeRatio: 0.09,
    sortinoRatio: 0.14,
    maxDrawdown: -0.03,
    deltaTotalReturn: 0.011,
    deltaAnnualizedReturn: 0.011,
    deltaSharpeRatio: 0.09,
    deltaSortinoRatio: 0.14,
    deltaMaxDrawdown: -0.03,
  },
  decisionMetrics: {
    directionalAccuracy: 0.64,
    brierScore: 0.21,
    abstentionQuality: 0.72,
    activeBarCount: 120,
    neutralBarCount: 132,
  },
  trades: [],
  equityCurve: [
    { ts: "2024-01-02T21:00:00.000Z", cash: 100000, position: 0, price: 100, equity: 100000, drawdown: 0 },
    { ts: "2024-01-03T21:00:00.000Z", cash: 101800, position: 0, price: 102, equity: 101800, drawdown: 0 },
    { ts: "2024-01-04T21:00:00.000Z", cash: 0, position: 1059, price: 101.5, equity: 107500, drawdown: 0 },
    { ts: "2024-01-05T21:00:00.000Z", cash: 116500, position: 0, price: 115.4, equity: 116500, drawdown: 0 },
  ],
  tokenCost: 0,
  latencyMs: 8,
  fallbackRate: 0,
});

const mockPolymarketManifest: ExperimentManifest = ExperimentManifest.parse({
  id: "a2c53b10-7c18-8f9f-c15c-64cf41235f76",
  createdAt: "2026-08-14T12:00:00.000Z",
  gitCommit: "a1b2c3d",
  datasetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  symbol: "AAPL",
  timeframe: "1Day",
  strategy: {
    name: "multi-agent-polymarket",
    type: "multi-agent-macro",
    description: "Technical + Sentiment + Polymarket Macro Odds Committee",
    parameters: { includePolymarket: true, debateEnabled: true },
  },
  metrics: {
    initialCash: 100000,
    finalEquity: 126400,
    totalReturn: 0.264,
    annualizedReturn: 0.264,
    sharpeRatio: 2.12,
    sortinoRatio: 2.78,
    maxDrawdown: 0.049,
    profitFactor: 2.6,
    winRate: 0.71,
    totalTurnover: 890000,
    tradeCount: 10,
  },
  benchmarkDelta: {
    totalReturn: 0.11,
    annualizedReturn: 0.11,
    sharpeRatio: 0.87,
    sortinoRatio: 1.16,
    maxDrawdown: -0.063,
    deltaTotalReturn: 0.11,
    deltaAnnualizedReturn: 0.11,
    deltaSharpeRatio: 0.87,
    deltaSortinoRatio: 1.16,
    deltaMaxDrawdown: -0.063,
  },
  decisionMetrics: {
    directionalAccuracy: 0.82,
    brierScore: 0.118,
    abstentionQuality: 0.88,
    activeBarCount: 190,
    neutralBarCount: 62,
  },
  trades: [],
  equityCurve: [
    { ts: "2024-01-02T21:00:00.000Z", cash: 100000, position: 0, price: 100, equity: 100000, drawdown: 0 },
    { ts: "2024-01-03T21:00:00.000Z", cash: 0, position: 1014, price: 102, equity: 104200, drawdown: 0 },
    { ts: "2024-01-04T21:00:00.000Z", cash: 0, position: 1093, price: 101.5, equity: 112800, drawdown: 0 },
    { ts: "2024-01-05T21:00:00.000Z", cash: 126400, position: 0, price: 115.4, equity: 126400, drawdown: 0 },
  ],
  tokenCost: 0,
  latencyMs: 15,
  fallbackRate: 0,
});

const mockSuiteResult: ExperimentSuiteResult = ExperimentSuiteResult.parse({
  id: "suite-01HZX",
  suiteId: "suite-01HZX",
  symbol: "AAPL",
  datasetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  gitCommit: "a1b2c3d",
  createdAt: "2026-08-14T12:00:00.000Z",
  benchmark: mockBenchmarkManifest,
  experiments: [
    mockBenchmarkManifest,
    mockSmaRsiManifest,
    mockDebateOnManifest,
    mockDebateOffManifest,
    mockPolymarketManifest,
  ],
  totalDurationMs: 142.5,
  totalCost: 0,
});

describe("Observatory Tearsheet & Equity Curves View", () => {
  beforeEach(() => {
    mockApi(
      signedInRoutes({
        "/experiments/suite?symbol=AAPL": {
          status: 200,
          body: mockSuiteResult,
        },
      }),
    );
  });

  it("renders Observatory header, telemetry HUD chips, and comparison tearsheet", async () => {
    renderApp("/observatory");

    // Page title and mode badge
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /Evaluation Observatory/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/Ablation Lab/i)).toBeInTheDocument();

    // Wait for suite query to resolve
    await waitFor(() => {
      expect(screen.getByText(/Offline Replay \(Zero Credential\)/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/SHA256:/i)).toBeInTheDocument();
    expect(screen.getByText(/Git:/i)).toBeInTheDocument();
    expect(screen.getByText(/142.5ms/i)).toBeInTheDocument();

    // Strategy options in selector & table
    expect(screen.getAllByText(/Buy & Hold \(Benchmark\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SMA\(20\/50\) \+ RSI\(14\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Multi-Agent \(Debate ON\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Multi-Agent \(Debate OFF \/ Ablation\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Technical \+ Sentiment \+ Polymarket/i).length).toBeGreaterThan(0);

    // Only fixture-backed datasets are offered; MSFT has no frozen fixture (404s)
    expect(screen.getByRole("button", { name: "SPY" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "MSFT" })).not.toBeInTheDocument();

    // Tearsheet metrics rendering
    expect(screen.getAllByText("15.40%").length).toBeGreaterThan(0); // Benchmark Total Return / Annualized
    expect(screen.getAllByText("22.80%").length).toBeGreaterThan(0); // Debate ON Total Return / Annualized
    expect(screen.getAllByText("+7.40%").length).toBeGreaterThan(0); // Debate ON delta vs B&H
    expect(screen.getByText("+0.63")).toBeInTheDocument(); // Debate ON delta Sharpe
    expect(screen.getByText("0.142")).toBeInTheDocument(); // Debate ON Brier score
  });

  it("provides accessible WCAG table-view twin for the multi-series equity chart", async () => {
    renderApp("/observatory");

    await waitFor(() => {
      expect(screen.getByText(/View comparison dataset as table/i)).toBeInTheDocument();
    });

    // Expand the table-view details
    const summary = screen.getByText(/View comparison dataset as table/i);
    await userEvent.click(summary);

    // Verify tabular data points are rendered
    expect(screen.getAllByText("$100,000.00").length).toBeGreaterThan(0);
    expect(screen.getByText("$122,800.00")).toBeInTheDocument();
  });

  it("toggles strategy visibility when clicking on strategy selection chips", async () => {
    renderApp("/observatory");

    await waitFor(() => {
      expect(screen.getByText(/Active Strategy Overlay \(5\/5\)/i)).toBeInTheDocument();
    });

    // Toggle off SMA/RSI using the control overlay chip
    const smaControlChips = screen.getAllByRole("button", { name: /SMA\(20\/50\) \+ RSI\(14\)/i });
    await userEvent.click(smaControlChips[0]!);

    // Count updates to 4/5
    expect(screen.getByText(/Active Strategy Overlay \(4\/5\)/i)).toBeInTheDocument();
  });

  it("applies ablation quick presets (Macro Ablation, Debate vs Ablation, Baselines Only)", async () => {
    renderApp("/observatory");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Macro Ablation/i })).toBeInTheDocument();
    });

    // Click Macro Ablation preset (B&H + Debate ON + Debate OFF + Polymarket = 4/5)
    await userEvent.click(screen.getByRole("button", { name: /Macro Ablation/i }));
    expect(screen.getByText(/Active Strategy Overlay \(4\/5\)/i)).toBeInTheDocument();

    // Click Debate vs Ablation preset (B&H + Debate ON + Debate OFF = 3/5)
    await userEvent.click(screen.getByRole("button", { name: /Debate vs Ablation/i }));
    expect(screen.getByText(/Active Strategy Overlay \(3\/5\)/i)).toBeInTheDocument();

    // Click Baselines Only preset (B&H + SMA-RSI = 2/5)
    await userEvent.click(screen.getByRole("button", { name: /Baselines Only/i }));
    expect(screen.getByText(/Active Strategy Overlay \(2\/5\)/i)).toBeInTheDocument();

    // Click All Strategies preset (5/5)
    await userEvent.click(screen.getByRole("button", { name: /All Strategies/i }));
    expect(screen.getByText(/Active Strategy Overlay \(5\/5\)/i)).toBeInTheDocument();
  });

  it("toggles Variance Sweep harness with spend telemetry chip, labeling honestly by spend", async () => {
    mockApi(
      signedInRoutes({
        "/experiments/suite?symbol=AAPL": {
          status: 200,
          body: mockSuiteResult,
        },
        "/experiments/variance-sweep": {
          status: 200,
          body: {
            id: "b455580a-9d22-48a6-be5e-fc56efab8394",
            symbol: "AAPL",
            createdAt: "2026-08-14T12:00:00.000Z",
            runsCount: 3,
            windowSize: 25,
            totalCost: 0.145,
            budgetLimit: 5.0,
            budgetExceeded: false,
            runs: [],
            metricStats: {
              totalReturn: { mean: 0.12, variance: 0.0001, stdDev: 0.01, min: 0.11, max: 0.13 },
              annualizedReturn: { mean: 0.12, variance: 0.0001, stdDev: 0.01, min: 0.11, max: 0.13 },
              sharpeRatio: { mean: 1.5, variance: 0.01, stdDev: 0.1, min: 1.4, max: 1.6 },
              maxDrawdown: { mean: 0.04, variance: 0.0001, stdDev: 0.01, min: 0.03, max: 0.05 },
            },
            equityBands: [
              { asOf: "2024-01-02T21:00:00.000Z", meanEquity: 100000, stdDev: 0, upperBand: 100000, lowerBand: 100000, minEquity: 100000, maxEquity: 100000 },
              { asOf: "2024-01-03T21:00:00.000Z", meanEquity: 104000, stdDev: 500, upperBand: 104500, lowerBand: 103500, minEquity: 103500, maxEquity: 104500 },
            ],
          },
        },
      }),
    );

    renderApp("/observatory");

    // Honest default: with no paid sweep result loaded, the toggle reads
    // deterministic — a $0.00 API run must never be labeled "Live"
    const sweepBtn = await screen.findByRole("button", { name: /Deterministic Sweep/i });
    await userEvent.click(sweepBtn);

    // Mocked sweep spent $0.145 > 0, so labels upgrade to Live
    await waitFor(() => {
      expect(screen.getByText(/Live Evaluation Variance Sweep/i)).toBeInTheDocument();
      expect(screen.getByText(/Sweep Spend:/i)).toBeInTheDocument();
      expect(screen.getByText(/\$0.145/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Live Sweep/i })).toBeInTheDocument();
  });

  it("labels the sweep deterministic with no pulse when totalCost is $0.00", async () => {
    mockApi(
      signedInRoutes({
        "/experiments/suite?symbol=AAPL": {
          status: 200,
          body: mockSuiteResult,
        },
        "/experiments/variance-sweep": {
          status: 200,
          body: {
            id: "c566691b-0e33-59b7-cf6f-0d67fabc94a5",
            symbol: "AAPL",
            createdAt: "2026-08-14T12:00:00.000Z",
            runsCount: 3,
            windowSize: 25,
            totalCost: 0,
            budgetLimit: 5.0,
            budgetExceeded: false,
            runs: [],
            metricStats: {
              totalReturn: { mean: 0.12, variance: 0.0001, stdDev: 0.01, min: 0.11, max: 0.13 },
              annualizedReturn: { mean: 0.12, variance: 0.0001, stdDev: 0.01, min: 0.11, max: 0.13 },
              sharpeRatio: { mean: 1.5, variance: 0.01, stdDev: 0.1, min: 1.4, max: 1.6 },
              maxDrawdown: { mean: 0.04, variance: 0.0001, stdDev: 0.01, min: 0.03, max: 0.05 },
            },
            equityBands: [
              { asOf: "2024-01-02T21:00:00.000Z", meanEquity: 100000, stdDev: 0, upperBand: 100000, lowerBand: 100000, minEquity: 100000, maxEquity: 100000 },
            ],
          },
        },
      }),
    );

    renderApp("/observatory");

    const sweepBtn = await screen.findByRole("button", { name: /Deterministic Sweep/i });
    await userEvent.click(sweepBtn);

    await waitFor(() => {
      expect(screen.getByText(/Deterministic Evaluation Variance Sweep/i)).toBeInTheDocument();
      expect(screen.getByText(/Sweep Spend:/i)).toBeInTheDocument();
      expect(screen.getByText(/\$0\.000/i)).toBeInTheDocument();
    });
    // Button keeps the deterministic label; no "Live" copy anywhere
    expect(screen.getByRole("button", { name: /Deterministic Sweep/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Live Sweep/i })).not.toBeInTheDocument();
  });

  it("switches chart modes between Equity Curve and Drawdown profile", async () => {
    renderApp("/observatory");

    await waitFor(() => {
      expect(screen.getByText(/Comparative Equity Trajectory/i)).toBeInTheDocument();
    });

    // Toggle to Drawdown (%)
    const ddToggle = screen.getByRole("button", { name: /^Drawdown \(%\)$/i });
    await userEvent.click(ddToggle);

    expect(screen.getByText(/Underwater Drawdown Profile \(%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Peak-to-trough historical drawdowns/i)).toBeInTheDocument();
  });

  it("opens Decision Lineage Inspector upon clicking Audit Lineage in tearsheet", async () => {
    renderApp("/observatory");

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Audit Lineage/i }).length).toBeGreaterThan(0);
    });

    // First row is Buy & Hold — a deterministic baseline with no lineage
    const auditButtons = screen.getAllByRole("button", { name: /Audit Lineage/i });
    await userEvent.click(auditButtons[0]!);

    // Drawer opens with an honest empty state: baselines make no per-decision
    // LLM calls, so no lineage is fabricated client-side
    expect(screen.getByRole("heading", { name: /Decision Provenance Inspector/i })).toBeInTheDocument();
    expect(screen.getByText(/No decision lineage recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/is a deterministic baseline/i)).toBeInTheDocument();
  });

  it("handles API errors gracefully and offers retry affordance", async () => {
    mockApi(
      signedInRoutes({
        "/experiments/suite?symbol=AAPL": {
          status: 500,
          body: { message: "Internal fixture replay failure" },
        },
      }),
    );

    renderApp("/observatory");

    await waitFor(() => {
      expect(screen.getByText(/Failed to load experiment suite replay/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Retry Evaluation Run/i })).toBeInTheDocument();
  });
});
