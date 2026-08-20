import { describe, it, expect } from "vitest";
import {
  AgentInput,
  AgentOutput,
  type FundamentalReport,
} from "@committee/contracts";
import {
  FundamentalAgent,
  classifyFundamentals,
} from "../src/agents/fundamental/index.js";
import { ScriptedLlmClient } from "../src/agents/technical/llm-client.js";

describe("Fundamental Analyst Specialist (SEC EDGAR XBRL)", () => {
  const sampleBullishReport: FundamentalReport = {
    id: "aapl-10q-2024-q1",
    symbol: "AAPL",
    cik: "0000320193",
    form: "10-Q",
    fiscalYear: 2024,
    fiscalPeriod: "Q1",
    periodEndDate: "2023-12-30",
    filedAt: "2024-02-02T18:00:00.000Z",
    asOf: "2024-02-02T21:00:00.000Z",
    revenue: 119575000000,
    grossProfit: 54855000000,
    operatingIncome: 40373000000,
    netIncome: 33916000000,
    eps: 2.18,
    totalAssets: 353514000000,
    totalLiabilities: 279414000000,
    stockholdersEquity: 74100000000,
    operatingCashFlow: 39895000000,
    capitalExpenditures: 2385000000,
    freeCashFlow: 37510000000,
    grossMargin: 0.4588,
    operatingMargin: 0.3376,
    netMargin: 0.2836,
    debtToEquity: 3.7708,
    currentRatio: 1.0726,
    revenueGrowthYoY: 0.085,
  };

  const sampleBearishReport: FundamentalReport = {
    id: "distressed-10q-2024-q1",
    symbol: "DIST",
    form: "10-Q",
    fiscalYear: 2024,
    fiscalPeriod: "Q1",
    periodEndDate: "2023-12-30",
    filedAt: "2024-02-02T18:00:00.000Z",
    asOf: "2024-02-02T21:00:00.000Z",
    revenue: 500000000,
    grossProfit: 50000000,
    operatingIncome: -80000000,
    netIncome: -120000000,
    eps: -1.5,
    totalAssets: 1000000000,
    totalLiabilities: 950000000,
    stockholdersEquity: 50000000,
    operatingCashFlow: -60000000,
    capitalExpenditures: 15000000,
    freeCashFlow: -75000000,
    grossMargin: 0.10,
    operatingMargin: -0.16,
    netMargin: -0.24,
    debtToEquity: 19.0,
    currentRatio: 0.65,
    revenueGrowthYoY: -0.25,
  };

  describe("classifyFundamentals (Deterministic Ratios)", () => {
    it("classifies strong operating margin, positive FCF, and YoY revenue growth as bullish", () => {
      const result = classifyFundamentals([sampleBullishReport]);
      expect(result.direction).toBe("bullish");
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.evidence.operatingMargin).toBe(0.338);
      expect(result.evidence.revenueGrowthYoY).toBe(0.085);
    });

    it("classifies negative operating income, negative FCF, and surging leverage as bearish", () => {
      const result = classifyFundamentals([sampleBearishReport]);
      expect(result.direction).toBe("bearish");
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.evidence.freeCashFlowBillion).toBe(-0.07);
      expect(result.evidence.debtToEquity).toBe(19.0);
    });

    it("defaults to neutral stance with zero confidence when no reports are present", () => {
      const result = classifyFundamentals([]);
      expect(result.direction).toBe("neutral");
      expect(result.confidence).toBe(0);
    });
  });

  describe("FundamentalAgent Execution & Anti-Hallucination", () => {
    const baseInput: AgentInput = {
      runId: "11111111-1111-1111-1111-111111111111",
      symbol: "AAPL",
      timeframe: "1Day",
      decisionTs: "2024-02-15T21:00:00.000Z",
      bars: [],
      indicators: null,
      fundamentals: [sampleBullishReport],
    };

    it("executes deterministically offline with valid AgentOutput schema", async () => {
      const agent = new FundamentalAgent({ deterministicOffline: true });
      const output = await agent.analyze(baseInput);

      expect(output.agent).toBe("fundamental");
      expect(output.direction).toBe("bullish");
      expect(output.confidence).toBeGreaterThan(0.6);
      expect(output.evidence.symbol).toBe("AAPL");
      expect(output.evidence.statementsConsidered).toBe(1);
    });

    it("enforces Facts vs Narration Law: computed evidence strictly overwrites model hallucinations", async () => {
      const scriptedLlm = new ScriptedLlmClient([
        {
          agent: "fundamental",
          direction: "bullish",
          confidence: 0.88,
          rationale: "Strong corporate earnings and revenue acceleration.",
          evidence: {
            operatingMargin: 0.99, // Hallucinated number
            freeCashFlowBillion: 999.0, // Hallucinated number
          },
        },
      ]);

      const agent = new FundamentalAgent({ llm: scriptedLlm });
      const output = await agent.analyze(baseInput);

      expect(output.direction).toBe("bullish");
      // Ground truth ratio (0.338) MUST overwrite hallucinated (0.99)
      expect(output.evidence.operatingMargin).toBe(0.338);
      // Ground truth FCF ($37.51B) MUST overwrite hallucinated ($999B)
      expect(output.evidence.freeCashFlowBillion).toBe(37.51);
    });

    it("strictly isolates future fundamental reports (asOf > decisionTs)", async () => {
      const futureReport: FundamentalReport = {
        ...sampleBullishReport,
        id: "future-report",
        asOf: "2024-05-01T21:00:00.000Z",
      };

      const inputWithFuture: AgentInput = {
        ...baseInput,
        decisionTs: "2024-01-01T00:00:00.000Z", // Prior to filing
        fundamentals: [futureReport],
      };

      const agent = new FundamentalAgent({ deterministicOffline: true });
      const output = await agent.analyze(inputWithFuture);

      expect(output.direction).toBe("neutral");
      expect(output.confidence).toBe(0);
      expect(output.evidence.statementsConsidered).toBe(0);
    });
  });
});
