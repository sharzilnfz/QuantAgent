import { randomUUID } from "node:crypto";
import {
  type DaemonStatus,
  type DaemonConfig,
  type DaemonCycleResult,
  type DaemonState,
  type OrderResult,
  type PositionAllocation,
  type RiskAssessment,
} from "@committee/contracts";
import { loadFixture } from "@committee/fixtures";
import { MultiAgentCoordinator } from "../agents/coordinator/coordinator.js";
import { computeIndicatorSnapshots } from "../indicators/index.js";
import { RiskGateEngine } from "../risk/engine.js";
import { getPortfolioState } from "../portfolio/service.js";
import { ExecutionRouter } from "../execution/router.js";
import { AlpacaPaperClient, DeterministicMockAlpacaClient } from "../execution/alpaca-client.js";
import { config } from "../config.js";

const DECISION_WINDOW = 20;

export class TradingDaemonService {
  private state: DaemonState = "idle";
  private startedAt: number | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private lastCycleResult?: DaemonCycleResult;
  private totalCycles = 0;
  private successfulCycles = 0;
  private failedCycles = 0;
  private lastCycleAt: string | null = null;
  private nextCycleAt: string | null = null;

  private daemonConfig: DaemonConfig = {
    enabled: false,
    intervalSeconds: 60,
    symbols: ["AAPL", "NVDA", "SPY"],
    dryRun: true,
    autoExecute: false,
    debateEnabled: true,
    minConfidence: 0.6,
  };

  private executionRouter: ExecutionRouter;

  constructor(customRouter?: ExecutionRouter) {
    if (customRouter) {
      this.executionRouter = customRouter;
    } else {
      const alpacaClient =
        config.ALPACA_KEY && config.ALPACA_SECRET
          ? new AlpacaPaperClient({
              apiKey: config.ALPACA_KEY,
              apiSecret: config.ALPACA_SECRET,
            })
          : new DeterministicMockAlpacaClient();

      this.executionRouter = new ExecutionRouter({
        client: alpacaClient,
      });
    }
  }

  getStatus(): DaemonStatus {
    const uptimeSeconds = this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;

    return {
      state: this.state,
      uptimeSeconds,
      lastCycleAt: this.lastCycleAt,
      nextCycleAt: this.nextCycleAt,
      totalCycles: this.totalCycles,
      successfulCycles: this.successfulCycles,
      failedCycles: this.failedCycles,
      config: this.daemonConfig,
      lastCycleResult: this.lastCycleResult,
    };
  }

  updateConfig(partial: Partial<DaemonConfig>): DaemonConfig {
    this.daemonConfig = {
      ...this.daemonConfig,
      ...partial,
    };

    if (this.state === "running" && partial.intervalSeconds) {
      // Restart interval timer with new frequency
      this.stop();
      this.start();
    }

    return this.daemonConfig;
  }

  start(): DaemonStatus {
    if (this.state === "running") return this.getStatus();

    this.state = "running";
    this.startedAt = Date.now();
    this.daemonConfig.enabled = true;

    // Schedule next cycle
    this.scheduleNextCycle();

    return this.getStatus();
  }

  stop(): DaemonStatus {
    if (this.intervalTimer) {
      clearTimeout(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.state = "paused";
    this.daemonConfig.enabled = false;
    this.nextCycleAt = null;

    return this.getStatus();
  }

  private scheduleNextCycle() {
    if (this.intervalTimer) clearTimeout(this.intervalTimer);
    if (this.state !== "running") return;

    const ms = this.daemonConfig.intervalSeconds * 1000;
    this.nextCycleAt = new Date(Date.now() + ms).toISOString();

    this.intervalTimer = setTimeout(() => {
      void this.executeCycle().finally(() => {
        if (this.state === "running") {
          this.scheduleNextCycle();
        }
      });
    }, ms);
  }

  async executeCycle(userId = "00000000-0000-4000-8000-000000000000"): Promise<DaemonCycleResult> {
    const cycleId = randomUUID();
    const startTime = Date.now();
    const startedAt = new Date(startTime).toISOString();
    const cycleResults: DaemonCycleResult["results"] = [];

    this.totalCycles++;

    try {
      const symbols = this.daemonConfig.symbols;

      for (const rawSym of symbols) {
        const sym = rawSym.toUpperCase();
        try {
          const fixture = loadFixture(sym);
          const bars = fixture.bars;
          if (bars.length === 0) continue;

          const currentBar = bars[bars.length - 1]!;
          const asOf = currentBar.asOf;
          const snapshots = computeIndicatorSnapshots(bars);
          const indicators = snapshots[snapshots.length - 1] ?? null;

          // 1. Run Multi-Agent Coordinator Deliberation
          const coordinator = new MultiAgentCoordinator({
            deterministicOffline: true,
            debateEnabled: this.daemonConfig.debateEnabled,
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

          // 2. Deterministic Risk Gate Assessment
          const portfolio = await getPortfolioState(userId);
          const pointInTimePortfolio = { ...portfolio, asOf };

          const riskGate = new RiskGateEngine();
          const riskAssessment = riskGate.assess({
            symbol: sym,
            direction: consensus.finalBias,
            confidence: consensus.finalConfidence,
            currentPrice: currentBar.close,
            portfolio: pointInTimePortfolio,
            decisionTs: asOf,
          });

          // 3. Execution Router Assessment
          let orderResult: OrderResult | undefined = undefined;
          let actionTaken: DaemonCycleResult["results"][0]["actionTaken"] = "neutral_abstain";

          if (consensus.finalBias === "neutral") {
            actionTaken = "neutral_abstain";
          } else if (riskAssessment.status === "REJECTED" || !riskAssessment.executionAllowed) {
            actionTaken = "rejected_by_risk";
          } else if (this.daemonConfig.dryRun || !this.daemonConfig.autoExecute) {
            actionTaken = "dry_run_recorded";
            const qty = Math.max(1, Math.floor(5000 / currentBar.close));
            orderResult = {
              orderId: `mock-dryrun-${randomUUID().slice(0, 8)}`,
              clientOrderId: `dryrun-client-${randomUUID().slice(0, 8)}`,
              symbol: sym,
              qty,
              side: consensus.finalBias === "bullish" ? "buy" : "sell",
              type: "market",
              timeInForce: "day",
              status: "filled",
              filledQty: qty,
              filledAvgPrice: currentBar.close,
              submittedAt: asOf,
              filledAt: asOf,
            };
          } else {
            // Live execution via ExecutionRouter
            const qty = Math.max(1, Math.floor(5000 / currentBar.close));
            const allocation: PositionAllocation = {
              allocationId: randomUUID(),
              symbol: sym,
              direction: consensus.finalBias,
              targetWeight: 0.1,
              targetQty: qty,
              targetNotional: 5000,
              estimatedPrice: currentBar.close,
              sizingMethod: "fixed_percentage",
              sizingParameters: {},
              rationale: `Autonomous daemon cycle allocation for ${sym}`,
              asOf,
              allocatedAt: asOf,
            };

            const routeResult = await this.executionRouter.execute({
              allocation,
              riskAssessment,
              decisionTs: asOf,
            });

            orderResult = routeResult.order;
            actionTaken = "executed";
          }

          cycleResults.push({
            symbol: sym,
            decisionTs: asOf,
            consensus,
            riskAssessment,
            orderResult,
            actionTaken,
          });
        } catch (symErr) {
          // Failure isolation per symbol
          const errStr = symErr instanceof Error ? symErr.message : String(symErr);
          const fallbackConsensus = {
            lineageId: randomUUID(),
            consensusReached: false,
            mode: "ablation_neutral_fallback" as const,
            finalBias: "neutral" as const,
            finalConfidence: 0.0,
            specialistVotes: {},
          };
          const fallbackRisk: RiskAssessment = {
            assessmentId: randomUUID(),
            symbol: sym,
            direction: "neutral",
            asOf: new Date().toISOString(),
            status: "REJECTED",
            executionAllowed: false,
            evaluatedRules: [],
            violations: [
              {
                ruleId: "SystemErrorGuard",
                name: "SystemErrorGuard",
                message: `Symbol evaluation error: ${errStr}`,
                passed: false,
                severity: "BLOCKING",
              },
            ],
            adjustedConstraints: {},
            evaluatedAt: new Date().toISOString(),
          };

          cycleResults.push({
            symbol: sym,
            decisionTs: new Date().toISOString(),
            consensus: fallbackConsensus,
            riskAssessment: fallbackRisk,
            actionTaken: "error",
            error: errStr,
          });
        }
      }

      this.successfulCycles++;
    } catch {
      this.failedCycles++;
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    this.lastCycleAt = completedAt;
    this.lastCycleResult = {
      id: cycleId,
      startedAt,
      completedAt,
      durationMs,
      symbolsEvaluated: this.daemonConfig.symbols,
      results: cycleResults,
    };

    return this.lastCycleResult;
  }
}

let daemonInstance: TradingDaemonService | null = null;

export function getTradingDaemon(): TradingDaemonService {
  if (!daemonInstance) {
    daemonInstance = new TradingDaemonService();
  }
  return daemonInstance;
}
