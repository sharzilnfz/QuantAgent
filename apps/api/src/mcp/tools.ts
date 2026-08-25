import { randomUUID } from "node:crypto";
import {
  loadFixture,
  loadPriceBars,
  loadNews,
  loadFundamentals,
  loadPredictionMarkets,
  TemporalGuard,
  isTradingDay,
  isMarketHoliday,
  isEarlyClose,
  getTradingHours,
  validateTradingTimestamp,
} from "@committee/fixtures";
import { computeIndicatorSnapshots } from "../indicators/index.js";
import {
  runBacktest,
  BuyAndHoldStrategy,
  SmaRsiStrategy,
} from "../backtest/index.js";
import {
  MultiAgentCoordinatorStrategy,
  MultiAgentCoordinator,
} from "../agents/coordinator/index.js";
import { TelegramBotService } from "../telegram/service.js";
import { type McpToolDefinition, type McpCallToolResult } from "./types.js";

export const QUANT_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "quant_query_market_data",
    description: "Query point-in-time historical price bars, news items, and EDGAR filings for a ticker symbol strictly with as_of <= T discipline.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Ticker symbol (e.g. AAPL, NVDA, SPY, MSFT, GOOGL, TLT, QQQ)" },
        asOf: { type: "string", description: "Optional ISO-8601 decision timestamp to filter knowable data" },
        limit: { type: "integer", description: "Maximum number of most recent bars to return (default 20)" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "quant_get_indicators",
    description: "Compute technical indicator snapshot (RSI, MACD, MACD Signal, Bollinger Bands, SMA20, SMA50) for a symbol as of a specific timestamp.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Ticker symbol (e.g. AAPL, NVDA, SPY, MSFT)" },
        asOf: { type: "string", description: "ISO-8601 point-in-time timestamp (as_of <= T)" },
      },
      required: ["symbol", "asOf"],
    },
  },
  {
    name: "quant_run_backtest",
    description: "Execute deterministic offline backtest simulation across a strategy ('buy-and-hold', 'sma-rsi', 'multi-agent-debate-on', 'multi-agent-debate-off', 'multi-agent-debate-multiround').",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Ticker symbol (e.g. AAPL, NVDA, SPY)" },
        strategy: {
          type: "string",
          enum: ["buy-and-hold", "sma-rsi", "multi-agent-debate-on", "multi-agent-debate-off", "multi-agent-debate-multiround"],
          description: "Strategy model to simulate",
        },
        initialCash: { type: "number", description: "Initial portfolio equity (default 100000)" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "quant_evaluate_multiagent",
    description: "Run L3 Multi-Agent Committee decision cycle (Technical, Sentiment, Fundamental, Polymarket) with consensus short-circuit or adversarial debate synthesis.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Ticker symbol (e.g. AAPL, NVDA, MSFT)" },
        asOf: { type: "string", description: "ISO-8601 decision timestamp (as_of <= T)" },
        debateEnabled: { type: "boolean", description: "Whether to enable debate synthesis on disagreement (default true)" },
        debateRounds: { type: "integer", description: "Number of debate rounds: 1 for single-pass, 2 for cross-examination (default 1)" },
      },
      required: ["symbol", "asOf"],
    },
  },
  {
    name: "quant_request_trade_approval",
    description: "Dispatch an interactive 2-way Telegram trade approval request with inline [Approve] and [Reject] buttons to the trading desk.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Ticker symbol (e.g. AAPL, NVDA, MSFT)" },
        direction: { type: "string", enum: ["bullish", "bearish", "neutral"], description: "Trade direction" },
        targetQty: { type: "integer", description: "Integer number of shares to allocate" },
        targetNotional: { type: "number", description: "Target dollar notional" },
        estimatedPrice: { type: "number", description: "Current estimated share price" },
        confidence: { type: "number", description: "Calibrated model confidence [0.0, 1.0]" },
        rationale: { type: "string", description: "Strategic rationale for the trade" },
        decisionTs: { type: "string", description: "Point-in-time decision timestamp" },
      },
      required: ["symbol", "direction", "targetQty", "estimatedPrice", "confidence", "rationale"],
    },
  },
  {
    name: "quant_query_portfolio",
    description: "Query current simulated portfolio state (cash balance, total equity, open positions, unrealized P&L).",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Optional symbol filter" },
      },
    },
  },
  {
    name: "quant_check_market_calendar",
    description: "Verify NYSE / NASDAQ trading calendar status for a specific date (trading day vs holiday, 13:00 ET early close, standard session hours).",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Calendar date formatted as YYYY-MM-DD or ISO-8601 string" },
      },
      required: ["date"],
    },
  },
];

export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown> = {},
  telegramService?: TelegramBotService,
): Promise<McpCallToolResult> {
  try {
    switch (toolName) {
      case "quant_query_market_data": {
        const symbol = String(args.symbol || "AAPL").toUpperCase();
        const limit = typeof args.limit === "number" ? args.limit : 20;
        const asOf = typeof args.asOf === "string" ? args.asOf : undefined;

        let bars = loadPriceBars(symbol);
        let news = loadNews(symbol);
        let fundamentals = loadFundamentals(symbol);

        if (asOf) {
          bars = TemporalGuard.filter(bars, asOf);
          news = TemporalGuard.filter(news, asOf);
          fundamentals = TemporalGuard.filter(fundamentals, asOf);
        }

        const recentBars = bars.slice(-limit);
        const latestBar = recentBars[recentBars.length - 1];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  symbol,
                  asOf: asOf ?? latestBar?.asOf,
                  barsCount: bars.length,
                  returnedBars: recentBars,
                  newsCount: news.length,
                  recentNews: news.slice(-5),
                  fundamentalsCount: fundamentals.length,
                  latestFundamental: fundamentals[fundamentals.length - 1],
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "quant_get_indicators": {
        const symbol = String(args.symbol || "AAPL").toUpperCase();
        const asOf = String(args.asOf);

        const allBars = loadPriceBars(symbol);
        const pointInTimeBars = TemporalGuard.filter(allBars, asOf);

        if (pointInTimeBars.length < 2) {
          return {
            content: [{ type: "text", text: `Insufficient historical bars before ${asOf} to compute indicators.` }],
            isError: true,
          };
        }

        const snapshots = computeIndicatorSnapshots(pointInTimeBars);
        const latest = snapshots[snapshots.length - 1];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  symbol,
                  asOf,
                  barCount: pointInTimeBars.length,
                  latestSnapshot: latest,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "quant_run_backtest": {
        const symbol = String(args.symbol || "AAPL").toUpperCase();
        const strategyType = String(args.strategy || "buy-and-hold");
        const initialCash = typeof args.initialCash === "number" ? args.initialCash : 100_000;

        const fixture = loadFixture(symbol);
        let strategy;

        if (strategyType === "sma-rsi") {
          strategy = new SmaRsiStrategy();
        } else if (strategyType === "multi-agent-debate-on") {
          strategy = new MultiAgentCoordinatorStrategy({
            debateEnabled: true,
            deterministicOffline: true,
            news: fixture.news,
            predictionMarkets: fixture.predictionMarkets,
            fundamentals: fixture.fundamentals,
          });
        } else if (strategyType === "multi-agent-debate-off") {
          strategy = new MultiAgentCoordinatorStrategy({
            debateEnabled: false,
            deterministicOffline: true,
            news: fixture.news,
            predictionMarkets: fixture.predictionMarkets,
            fundamentals: fixture.fundamentals,
          });
        } else if (strategyType === "multi-agent-debate-multiround") {
          strategy = new MultiAgentCoordinatorStrategy({
            debateEnabled: true,
            debateRounds: 2,
            deterministicOffline: true,
            news: fixture.news,
            predictionMarkets: fixture.predictionMarkets,
            fundamentals: fixture.fundamentals,
          });
        } else {
          strategy = new BuyAndHoldStrategy();
        }

        const result = await runBacktest(strategy, fixture.bars, {
          initialCash,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  symbol,
                  strategy: strategy.name,
                  metrics: {
                    totalReturn: result.totalReturn,
                    annualizedReturn: result.annualizedReturn,
                    sharpeRatio: result.sharpeRatio,
                    sortinoRatio: result.sortinoRatio,
                    maxDrawdown: result.maxDrawdown,
                    winRate: result.winRate,
                  },
                  tradesCount: result.trades.length,
                  finalEquity: result.equityCurve[result.equityCurve.length - 1]?.equity,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "quant_evaluate_multiagent": {
        const symbol = String(args.symbol || "AAPL").toUpperCase();
        const asOf = String(args.asOf);
        const debateEnabled = args.debateEnabled !== false;
        const debateRounds = typeof args.debateRounds === "number" ? args.debateRounds : 1;

        const fixture = loadFixture(symbol);
        const bars = TemporalGuard.filter(fixture.bars, asOf);
        const news = TemporalGuard.filter(fixture.news, asOf);
        const fundamentals = TemporalGuard.filter(fixture.fundamentals ?? [], asOf);
        const predictionMarkets = TemporalGuard.filter(fixture.predictionMarkets ?? [], asOf);

        const coordinator = new MultiAgentCoordinator({
          debateEnabled,
          debateRounds,
          deterministicOffline: true,
          includePolymarket: true,
        });

        const result = await coordinator.coordinate({
          symbol,
          timeframe: "1Day",
          decisionTs: asOf,
          bars,
          news,
          fundamentals,
          predictionMarkets,
          indicators: null,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "quant_request_trade_approval": {
        const symbol = String(args.symbol || "AAPL").toUpperCase();
        const direction = (args.direction as "bullish" | "bearish" | "neutral") || "bullish";
        const targetQty = Number(args.targetQty) || 10;
        const estimatedPrice = Number(args.estimatedPrice) || 150.0;
        const targetNotional = Number(args.targetNotional) || targetQty * estimatedPrice;
        const confidence = Number(args.confidence) || 0.8;
        const rationale = String(args.rationale || "Algorithmic breakout signal");
        const decisionTs = String(args.decisionTs || new Date().toISOString());

        const service = telegramService ?? new TelegramBotService();

        const approvalResult = await service.requestTradeApproval({
          allocation: {
            allocationId: randomUUID(),
            symbol,
            direction,
            targetQty,
            targetWeight: 0.15,
            targetNotional,
            estimatedPrice,
            sizingMethod: "fractional_kelly",
            sizingParameters: {},
            rationale,
            asOf: decisionTs,
            allocatedAt: new Date().toISOString(),
          },
          riskAssessment: {
            assessmentId: randomUUID(),
            symbol,
            direction,
            status: "APPROVED",
            executionAllowed: true,
            evaluatedRules: [],
            violations: [],
            adjustedConstraints: {},
            asOf: decisionTs,
            evaluatedAt: new Date().toISOString(),
          },
          decisionTs,
          confidence,
          rationale,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(approvalResult, null, 2),
            },
          ],
        };
      }

      case "quant_query_portfolio": {
        const portfolio = {
          cash: 85000,
          equity: 100000,
          asOf: new Date().toISOString(),
          positions: [
            {
              symbol: "AAPL",
              qty: 50,
              avgEntryPrice: 180.0,
              marketValue: 9225.0,
              unrealizedPl: 225.0,
              unrealizedPlPct: 0.025,
            },
            {
              symbol: "NVDA",
              qty: 10,
              avgEntryPrice: 550.0,
              marketValue: 5775.0,
              unrealizedPl: 275.0,
              unrealizedPlPct: 0.05,
            },
          ],
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(portfolio, null, 2),
            },
          ],
        };
      }

      case "quant_check_market_calendar": {
        const date = String(args.date || new Date().toISOString());
        const tradingDay = isTradingDay(date);
        const holiday = isMarketHoliday(date);
        const earlyClose = isEarlyClose(date);
        const hours = getTradingHours(date);
        const validation = validateTradingTimestamp(date);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  date,
                  isTradingDay: tradingDay,
                  isMarketHoliday: holiday,
                  isEarlyClose: earlyClose,
                  tradingHours: hours,
                  validation,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown MCP tool: ${toolName}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing MCP tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
