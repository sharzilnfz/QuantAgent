/**
 * CONTRACT-EXACT fixtures.
 *
 * The backend is not up yet, so the app is developed against these. Each one is
 * pushed through the real Zod schema from `@committee/contracts` at module load,
 * so a fixture that drifts from the contract fails the suite at import time
 * rather than quietly letting the UI be built against a shape the API will
 * never send. Swapping the mock for the live endpoints is then a no-op.
 */
import { AgentOutput, PortfolioState } from "@committee/contracts";
import type { PortfolioPoint } from "../src/lib/api";

export const mockUser = { id: "usr_01HZX", email: "analyst@committee.test" };

export const mockPortfolio = PortfolioState.parse({
  cash: 24180.42,
  equity: 138402.19,
  positions: [
    { symbol: "AAPL", qty: 120, marketValue: 21744, unrealizedPl: 1312.55 },
    { symbol: "MSFT", qty: 40, marketValue: 16902.8, unrealizedPl: -487.2 },
  ],
  asOf: "2026-07-21T20:00:00.000Z",
});

/**
 * The aggregate P&L the API *may* also send (see CONTRACT GAPS in api.ts).
 * Deliberately NOT the sum of the positions above — if the UI ever computed the
 * total itself instead of rendering this field, the assertion would catch it.
 */
export const mockAggregateUnrealizedPl = 902.4;

export const mockPortfolioResponse = {
  ...mockPortfolio,
  unrealizedPl: mockAggregateUnrealizedPl,
};

export const mockHistory: PortfolioPoint[] = [
  { asOf: "2026-07-17T20:00:00.000Z", equity: 131004.11 },
  { asOf: "2026-07-18T20:00:00.000Z", equity: 133920.06 },
  { asOf: "2026-07-19T20:00:00.000Z", equity: 129776.5 },
  { asOf: "2026-07-20T20:00:00.000Z", equity: 135610.77 },
  { asOf: "2026-07-21T20:00:00.000Z", equity: 138402.19 },
];

export const mockWatchlist = [{ symbol: "AAPL" }, { symbol: "MSFT" }];

export const mockRationale =
  "RSI at 61.4 is elevated but short of overbought, and MACD crossed above its signal line " +
  "three sessions ago. Price is holding above both the 20- and 50-day moving averages, which " +
  "keeps the intermediate trend intact.";

export const mockAgentOutput = AgentOutput.parse({
  agent: "technical",
  direction: "bullish",
  confidence: 0.72,
  rationale: mockRationale,
  evidence: {
    rsi: 61.42,
    macd: 1.87,
    macdSignal: 1.44,
    sma20: 178.31,
    aboveSma50: true,
  },
});

export const mockBearishOutput = AgentOutput.parse({
  agent: "technical",
  direction: "bearish",
  confidence: 0.31,
  rationale: "Price closed below the lower Bollinger band on rising volume.",
  evidence: { rsi: 27.8 },
});

export const mockNeutralOutput = AgentOutput.parse({
  agent: "technical",
  direction: "neutral",
  confidence: 0.5,
  rationale: "Indicators disagree; no directional edge.",
  evidence: {},
});
