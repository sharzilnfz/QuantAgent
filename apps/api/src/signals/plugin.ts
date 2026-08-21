import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  LiveSignalRadarItem,
  LiveSignalRadarResponse,
  type Direction,
  type IndicatorSnapshot,
  type PriceBar,
} from "@committee/contracts";
import { loadFixture } from "@committee/fixtures";
import { requireAuth } from "../auth/require-auth.js";
import { computeIndicatorSnapshots } from "../indicators/index.js";
import { MultiAgentCoordinator } from "../agents/coordinator/coordinator.js";
import { RiskGateEngine } from "../risk/engine.js";
import { getPortfolioState } from "../portfolio/service.js";

const RadarQuery = z.object({
  symbols: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(",").map((s) => s.trim().toUpperCase()) : ["AAPL", "NVDA", "SPY"],
    ),
});

const EvaluateBody = z.object({
  symbol: z.string().min(1).default("AAPL"),
  decisionTs: z.string().datetime().optional(),
  debateEnabled: z.boolean().default(true),
});

const DECISION_WINDOW = 20;

export async function signalsPlugin(app: FastifyInstance): Promise<void> {
  /**
   * GET /signals/radar
   * Returns real-time indicator readings, specialist stances, and consensus for symbols.
   */
  app.get("/signals/radar", { preHandler: requireAuth }, async (request, reply) => {
    const query = RadarQuery.safeParse(request.query ?? {});
    if (!query.success) {
      return reply.code(400).send({ error: "invalid_query", issues: query.error.issues });
    }

    const symbols = query.data.symbols;
    const items: LiveSignalRadarItem[] = [];

    for (const rawSym of symbols) {
      const sym = rawSym.toUpperCase();
      let fixture;
      try {
        fixture = loadFixture(sym);
      } catch {
        continue;
      }

      const bars = fixture.bars;
      if (bars.length === 0) continue;

      const currentBar = bars[bars.length - 1]!;
      const recentBars = bars.slice(-30);
      const snapshots = computeIndicatorSnapshots(bars);
      const currentIndicator = snapshots[snapshots.length - 1] ?? {
        symbol: sym,
        timeframe: currentBar.timeframe,
        ts: currentBar.ts,
        rsi: null,
        macd: null,
        macdSignal: null,
        bbUpper: null,
        bbLower: null,
        sma20: null,
        sma50: null,
        asOf: currentBar.asOf,
      };

      // Derive technical signal categorizations
      let rsiZone: "oversold" | "neutral" | "overbought" = "neutral";
      if (currentIndicator.rsi != null) {
        if (currentIndicator.rsi <= 30) rsiZone = "oversold";
        else if (currentIndicator.rsi >= 70) rsiZone = "overbought";
      }

      let macdCross: "bullish" | "bearish" | "neutral" = "neutral";
      if (currentIndicator.macd != null && currentIndicator.macdSignal != null) {
        if (currentIndicator.macd > currentIndicator.macdSignal) macdCross = "bullish";
        else if (currentIndicator.macd < currentIndicator.macdSignal) macdCross = "bearish";
      }

      let trend: "bullish" | "bearish" | "ranging" = "ranging";
      if (currentIndicator.sma20 != null && currentIndicator.sma50 != null) {
        if (currentIndicator.sma20 > currentIndicator.sma50 && currentBar.close > currentIndicator.sma20) {
          trend = "bullish";
        } else if (currentIndicator.sma20 < currentIndicator.sma50 && currentBar.close < currentIndicator.sma20) {
          trend = "bearish";
        }
      }

      // Run multi-agent coordinator on the latest bar state
      const coordinator = new MultiAgentCoordinator({
        deterministicOffline: true,
        debateEnabled: true,
        includePolymarket: (fixture.predictionMarkets?.length ?? 0) > 0,
      });

      const pointInTimeBars = bars.slice(-DECISION_WINDOW);
      const consensus = await coordinator.coordinate({
        symbol: sym,
        timeframe: currentBar.timeframe,
        decisionTs: currentBar.asOf,
        bars: pointInTimeBars,
        indicators: currentIndicator,
        news: fixture.news,
        fundamentals: fixture.fundamentals,
        predictionMarkets: fixture.predictionMarkets,
      });

      const latestNews = fixture.news && fixture.news.length > 0
        ? fixture.news[fixture.news.length - 1]?.headline
        : undefined;

      items.push({
        symbol: sym,
        currentBar,
        recentBars,
        indicators: currentIndicator,
        rsiZone,
        macdCross,
        trend,
        specialistVotes: consensus.specialistVotes,
        consensus,
        newsHeadline: latestNews,
        asOf: currentBar.asOf,
      });
    }

    const response = LiveSignalRadarResponse.parse({
      asOf: new Date().toISOString(),
      items,
    });

    return reply.send(response);
  });

  /**
   * POST /signals/evaluate
   * Executes an on-demand live multi-agent committee deliberation + risk gate check.
   */
  app.post("/signals/evaluate", { preHandler: requireAuth }, async (request, reply) => {
    const body = EvaluateBody.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    }

    const { symbol: rawSymbol, decisionTs, debateEnabled } = body.data;
    const sym = rawSymbol.toUpperCase();

    let fixture;
    try {
      fixture = loadFixture(sym);
    } catch {
      return reply.code(404).send({ error: "fixture_not_found", message: `Symbol ${sym} not found.` });
    }

    const bars = fixture.bars;
    if (bars.length === 0) {
      return reply.code(400).send({ error: "no_data", message: `No bars for symbol ${sym}.` });
    }

    const currentBar = bars[bars.length - 1]!;
    const asOf = decisionTs ?? currentBar.asOf;
    const snapshots = computeIndicatorSnapshots(bars);
    const indicators = snapshots[snapshots.length - 1] ?? null;

    const coordinator = new MultiAgentCoordinator({
      deterministicOffline: true,
      debateEnabled,
      includePolymarket: (fixture.predictionMarkets?.length ?? 0) > 0,
    });

    const consensus = await coordinator.coordinate({
      symbol: sym,
      timeframe: currentBar.timeframe,
      decisionTs: asOf,
      bars: bars.slice(-DECISION_WINDOW),
      indicators,
      news: fixture.news,
      fundamentals: fixture.fundamentals,
      predictionMarkets: fixture.predictionMarkets,
    });

    // Evaluate against deterministic Risk Gate
    const userId = request.user?.id ?? "00000000-0000-4000-8000-000000000000";
    const portfolio = await getPortfolioState(userId);
    const pointInTimePortfolio = {
      ...portfolio,
      asOf,
    };

    const riskGate = new RiskGateEngine();
    const riskAssessment = riskGate.assess({
      symbol: sym,
      direction: consensus.finalBias,
      confidence: consensus.finalConfidence,
      currentPrice: currentBar.close,
      portfolio: pointInTimePortfolio,
      decisionTs: asOf,
    });

    return reply.send({
      symbol: sym,
      asOf,
      currentBar,
      indicators,
      consensus,
      riskAssessment,
    });
  });
}
