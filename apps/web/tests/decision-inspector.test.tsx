import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DecisionInspector } from "../src/components/lineage/DecisionInspector";
import {
  DecisionLineageRecord,
  ExperimentManifest,
} from "@committee/contracts";

const mockLineageRecord1: DecisionLineageRecord = DecisionLineageRecord.parse({
  id: "8c3b2e7a-1f8d-4b5a-9e12-34567890abcd",
  decisionTs: "2024-01-03T21:00:00.000Z",
  symbol: "AAPL",
  inputBars: [
    {
      symbol: "AAPL",
      timeframe: "1Day",
      ts: "2024-01-02T21:00:00.000Z",
      asOf: "2024-01-02T21:00:00.000Z",
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1200000,
    },
    {
      symbol: "AAPL",
      timeframe: "1Day",
      ts: "2024-01-03T21:00:00.000Z",
      asOf: "2024-01-03T21:00:00.000Z",
      open: 100.5,
      high: 103,
      low: 100,
      close: 102.5,
      volume: 1500000,
    },
  ],
  indicators: {
    ts: "2024-01-03T21:00:00.000Z",
    asOf: "2024-01-03T21:00:00.000Z",
    symbol: "AAPL",
    timeframe: "1Day",
    rsi: 64.5,
    sma20: 101.2,
    sma50: 98.4,
    macd: 1.25,
    macdSignal: 0.95,
    bbUpper: 104.0,
    bbLower: 98.0,
  },
  news: [
    {
      id: "news-001",
      symbols: ["AAPL"],
      publishedAt: "2024-01-03T14:30:00.000Z",
      asOf: "2024-01-03T14:30:00.000Z",
      headline: "Apple Unveils New Hardware Lineup With Upgraded Chips",
      summary: "Analysts expect strong demand and higher average selling prices.",
      source: "Benzinga",
    },
  ],
  specialistPrompts: {
    technical: "System prompt: Technical analysis specialist.\nUser prompt: Analyze AAPL at 2024-01-03T21:00:00.000Z with RSI 64.5 and MACD 1.25.",
    sentiment: "System prompt: Sentiment analysis specialist.\nUser prompt: Evaluate news sentiment for AAPL with 1 news item.",
  },
  specialistCompletions: {
    technical: {
      agent: "technical",
      direction: "bullish",
      confidence: 0.8,
      rationale: "RSI is in positive momentum band and MACD histogram is expanding.",
      evidence: { rsi: 64.5, macd: 1.25 },
    },
    sentiment: {
      agent: "sentiment",
      direction: "bullish",
      confidence: 0.75,
      rationale: "Product launch announcement and bullish analyst revisions.",
      evidence: { headlineCount: 1 },
    },
  },
  consensusResult: {
    lineageId: "8c3b2e7a-1f8d-4b5a-9e12-34567890abcd",
    consensusReached: true,
    mode: "consensus_short_circuit",
    finalBias: "bullish",
    finalConfidence: 0.775,
    specialistVotes: {
      technical: {
        agent: "technical",
        direction: "bullish",
        confidence: 0.8,
        rationale: "RSI is in positive momentum band and MACD histogram is expanding.",
        evidence: { rsi: 64.5, macd: 1.25 },
      },
      sentiment: {
        agent: "sentiment",
        direction: "bullish",
        confidence: 0.75,
        rationale: "Product launch announcement and bullish analyst revisions.",
        evidence: { headlineCount: 1 },
      },
    },
  },
  executionFill: {
    ts: "2024-01-03T21:00:00.000Z",
    price: 102.5,
    fromPosition: 0,
    toPosition: 975,
    shares: 975,
    value: 99937.5,
    fee: 1.0,
  },
  tokenCost: 0.002,
  latencyMs: 14,
});

const mockLineageRecord2: DecisionLineageRecord = DecisionLineageRecord.parse({
  id: "9d4c3f8b-2e9a-5c6b-0f23-45678901bcde",
  decisionTs: "2024-01-04T21:00:00.000Z",
  symbol: "AAPL",
  inputBars: [
    {
      symbol: "AAPL",
      timeframe: "1Day",
      ts: "2024-01-04T21:00:00.000Z",
      asOf: "2024-01-04T21:00:00.000Z",
      open: 102.5,
      high: 102.8,
      low: 99.8,
      close: 100.2,
      volume: 1800000,
    },
  ],
  indicators: {
    ts: "2024-01-04T21:00:00.000Z",
    asOf: "2024-01-04T21:00:00.000Z",
    symbol: "AAPL",
    timeframe: "1Day",
    rsi: 48.2,
    sma20: 101.0,
    sma50: 98.6,
    macd: 0.85,
    macdSignal: 0.92,
    bbUpper: 104.0,
    bbLower: 98.0,
  },
  news: [],
  specialistPrompts: {
    technical: "System prompt: Technical analysis specialist.\nUser prompt: Analyze AAPL at 2024-01-04T21:00:00.000Z.",
    sentiment: "System prompt: Sentiment analysis specialist.\nUser prompt: Evaluate news sentiment for AAPL.",
    debateSynthesizer: "System prompt: Multi-agent debate synthesizer.\nUser prompt: Reconcile specialist disagreement between Technical (bearish) and Sentiment (bullish).",
  },
  specialistCompletions: {
    technical: {
      agent: "technical",
      direction: "bearish",
      confidence: 0.65,
      rationale: "MACD crossed below signal line and RSI dropped below 50.",
      evidence: { rsi: 48.2, macdHistogram: -0.07 },
    },
    sentiment: {
      agent: "sentiment",
      direction: "bullish",
      confidence: 0.6,
      rationale: "Macro tailwinds persist.",
      evidence: {},
    },
    debateSynthesizer: {
      direction: "neutral",
      confidence: 0.5,
      rationale: "Technical deterioration outweighs sentiment narrative in the near term; recommend flat stance.",
      dissentingView: "Sentiment specialist argued product refresh cycle remains strong.",
      primaryDriver: "technical",
    },
  },
  consensusResult: {
    lineageId: "9d4c3f8b-2e9a-5c6b-0f23-45678901bcde",
    consensusReached: false,
    mode: "debate_synthesis",
    finalBias: "neutral",
    finalConfidence: 0.5,
    specialistVotes: {
      technical: {
        agent: "technical",
        direction: "bearish",
        confidence: 0.65,
        rationale: "MACD crossed below signal line and RSI dropped below 50.",
        evidence: { rsi: 48.2, macdHistogram: -0.07 },
      },
      sentiment: {
        agent: "sentiment",
        direction: "bullish",
        confidence: 0.6,
        rationale: "Macro tailwinds persist.",
        evidence: {},
      },
    },
    synthesis: {
      direction: "neutral",
      confidence: 0.5,
      rationale: "Technical deterioration outweighs sentiment narrative in the near term; recommend flat stance.",
      dissentingView: "Sentiment specialist argued product refresh cycle remains strong.",
      primaryDriver: "technical",
      tokenCost: 0.003,
      latencyMs: 18,
    },
  },
  tokenCost: 0.005,
  latencyMs: 22,
});

const mockManifest: ExperimentManifest = ExperimentManifest.parse({
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
    tradeCount: 2,
  },
  trades: [
    mockLineageRecord1.executionFill!,
  ],
  equityCurve: [
    { ts: "2024-01-02T21:00:00.000Z", cash: 100000, position: 0, price: 100, equity: 100000, drawdown: 0 },
    { ts: "2024-01-03T21:00:00.000Z", cash: 62.5, position: 975, price: 102.5, equity: 100000, drawdown: 0 },
    { ts: "2024-01-04T21:00:00.000Z", cash: 62.5, position: 975, price: 100.2, equity: 97757.5, drawdown: 0.0224 },
  ],
  lineageRecords: [mockLineageRecord1, mockLineageRecord2],
  tokenCost: 0.007,
  latencyMs: 18,
  fallbackRate: 0,
});

describe("Decision Lineage DAG Inspector & Telemetry HUD", () => {
  it("renders drawer header, telemetry HUD cards, and status badges", () => {
    const onClose = vi.fn();
    render(
      <DecisionInspector
        isOpen={true}
        onClose={onClose}
        manifest={mockManifest}
        initialDecisionTs={mockLineageRecord1.decisionTs}
      />,
    );

    expect(screen.getByRole("heading", { name: /Decision Provenance Inspector/i })).toBeInTheDocument();
    expect(screen.getByText(/Lineage DAG/i)).toBeInTheDocument();
    expect(screen.getByText(/multi-agent-debate-on/i)).toBeInTheDocument();

    // Telemetry HUD cards
    expect(screen.getByText(/Cost \/ 100 Decisions/i)).toBeInTheDocument();
    expect(screen.getByText(/Median Latency/i)).toBeInTheDocument();
    expect(screen.getByText(/Fallback \/ Error Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Debate Reconciliations/i)).toBeInTheDocument();

    // Consensus status for Bar 1 (Short-Circuit)
    expect(screen.getByText(/⚡ Short-Circuit \(\$0.00\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/bullish/i).length).toBeGreaterThan(0);
  });

  it("navigates through decision bars using stepper buttons", async () => {
    const user = userEvent.setup();
    render(
      <DecisionInspector
        isOpen={true}
        onClose={vi.fn()}
        manifest={mockManifest}
        initialDecisionTs={mockLineageRecord1.decisionTs}
      />,
    );

    expect(screen.getByText("Bar 1 of 2")).toBeInTheDocument();

    // Click Next Bar
    const nextBtn = screen.getByRole("button", { name: /Next Bar →/i });
    await user.click(nextBtn);

    // Bar 2 is active (Debate Synthesized, neutral bias)
    expect(screen.getByText("Bar 2 of 2")).toBeInTheDocument();
    expect(screen.getByText(/💬 Debate Synthesized/i)).toBeInTheDocument();
    expect(screen.getAllByText(/neutral/i).length).toBeGreaterThan(0);

    // Click Prev Bar
    const prevBtn = screen.getByRole("button", { name: /← Prev Bar/i });
    await user.click(prevBtn);

    expect(screen.getByText("Bar 1 of 2")).toBeInTheDocument();
  });

  it("displays Historical Inputs (OHLCV bars, indicators, news <= T)", async () => {
    const user = userEvent.setup();
    render(
      <DecisionInspector
        isOpen={true}
        onClose={vi.fn()}
        manifest={mockManifest}
        initialDecisionTs={mockLineageRecord1.decisionTs}
      />,
    );

    // Inputs tab is active by default
    expect(screen.getByText(/OHLCV Bar Window/i)).toBeInTheDocument();
    expect(screen.getByText(/Wilder RSI \(14\)/i)).toBeInTheDocument();
    expect(screen.getByText("64.50")).toBeInTheDocument(); // RSI
    expect(screen.getByText("$101.20")).toBeInTheDocument(); // SMA 20

    // Benzinga News headline
    expect(screen.getByText(/Apple Unveils New Hardware Lineup/i)).toBeInTheDocument();
    expect(screen.getByText(/Benzinga News Stream/i)).toBeInTheDocument();
  });

  it("displays Specialist Votes and Debate Synthesis in Debate tab", async () => {
    const user = userEvent.setup();
    render(
      <DecisionInspector
        isOpen={true}
        onClose={vi.fn()}
        manifest={mockManifest}
        initialDecisionTs={mockLineageRecord2.decisionTs}
      />,
    );

    // Switch to Tab 2: Multi-Agent Debate
    const debateTab = screen.getByRole("button", { name: /2\. Multi-Agent Debate/i });
    await user.click(debateTab);

    // Specialist cards
    expect(screen.getByText(/technical Specialist/i)).toBeInTheDocument();
    expect(screen.getAllByText(/sentiment Specialist/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/MACD crossed below signal line/i)).toBeInTheDocument();

    // Debate Synthesis card
    expect(screen.getByText(/Single-Pass Debate Synthesis/i)).toBeInTheDocument();
    expect(screen.getByText(/Driver: technical/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical deterioration outweighs sentiment narrative/i)).toBeInTheDocument();
    expect(screen.getByText(/Sentiment specialist argued product refresh cycle remains strong/i)).toBeInTheDocument();
  });

  it("displays exact Prompts and raw completions with copy capability in Prompts tab", async () => {
    const user = userEvent.setup();
    render(
      <DecisionInspector
        isOpen={true}
        onClose={vi.fn()}
        manifest={mockManifest}
        initialDecisionTs={mockLineageRecord1.decisionTs}
      />,
    );

    // Switch to Tab 3: Prompts & LLM Completions
    const promptsTab = screen.getByRole("button", { name: /3\. Prompts & LLM Completions/i });
    await user.click(promptsTab);

    expect(screen.getByText(/Exact Rendered User & System Prompt Text/i)).toBeInTheDocument();
    expect(screen.getByText(/System prompt: Technical analysis specialist/i)).toBeInTheDocument();
    expect(screen.getByText(/Raw LLM Completion String & Zod Parsed Schema Contract/i)).toBeInTheDocument();
    expect(screen.getByText(/✓ Validated @committee\/contracts/i)).toBeInTheDocument();

    // Switch agent target to sentiment
    const sentimentTargetBtn = screen.getByRole("button", { name: /^sentiment$/i });
    await user.click(sentimentTargetBtn);
    expect(screen.getByText(/System prompt: Sentiment analysis specialist/i)).toBeInTheDocument();
  });

  it("displays Execution Fill details in Execution tab", async () => {
    const user = userEvent.setup();
    render(
      <DecisionInspector
        isOpen={true}
        onClose={vi.fn()}
        manifest={mockManifest}
        initialDecisionTs={mockLineageRecord1.decisionTs}
      />,
    );

    // Switch to Tab 4: Execution Fill
    const execTab = screen.getByRole("button", { name: /4\. Execution Fill/i });
    await user.click(execTab);

    expect(screen.getByText(/Simulated Portfolio Order & Execution Fill/i)).toBeInTheDocument();
    expect(screen.getByText("$102.50")).toBeInTheDocument(); // Fill Price
    expect(screen.getByText("975.00")).toBeInTheDocument(); // Shares
    expect(screen.getByText("$99,937.50")).toBeInTheDocument(); // Total Value
    expect(screen.getByText(/Position Shift:/i)).toBeInTheDocument();
  });

  it("handles close via close button or Escape key", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DecisionInspector
        isOpen={true}
        onClose={onClose}
        manifest={mockManifest}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: /Close Inspector/i });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
