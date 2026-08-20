import type {
  DecisionLineageRecord,
  IndicatorSnapshot,
  NewsItem,
  PredictionMarketEvent,
  FundamentalReport,
  PriceBar,
  SignalType,
  Strategy,
} from "@committee/contracts";

import { computeIndicatorSnapshots } from "../../indicators/index.js";
import type { DecisionSignal } from "../../backtest/metrics.js";
import {
  MultiAgentCoordinator,
  type CoordinatorOptions,
} from "./coordinator.js";
import { DecisionLineageRecorder } from "./lineage.js";

export interface MultiAgentCoordinatorStrategyOptions extends CoordinatorOptions {
  name?: string;
  news?: NewsItem[];
  predictionMarkets?: PredictionMarketEvent[];
  fundamentals?: FundamentalReport[];
}

/** Aggregate run telemetry surfaced on the experiment manifest. */
export interface CoordinatorRunTelemetry {
  tokenCost: number;
  medianLatencyMs: number;
  fallbackRate: number;
}

/** Bar-window size handed to specialists and recorded per lineage decision.
 *  The agents only reason over recent context, and an unbounded cumulative
 *  slice would make each manifest O(n²) in bars (~30 MB for one year). */
const DECISION_BAR_WINDOW = 20;

/**
 * MultiAgentCoordinatorStrategy implements the Strategy interface for backtest simulations.
 * Reconciles Technical, Sentiment, Fundamental, and Polymarket specialist signals at each point-in-time decision step,
 * recording lineage and tracking probabilistic decisions.
 */
export class MultiAgentCoordinatorStrategy implements Strategy {
  readonly name: string;
  public readonly coordinator: MultiAgentCoordinator;
  public readonly lineageRecorder: DecisionLineageRecorder;
  private readonly news?: NewsItem[];
  private readonly predictionMarkets?: PredictionMarketEvent[];
  private readonly fundamentals?: FundamentalReport[];
  private readonly decisionSignals: DecisionSignal[] = [];
  private readonly latenciesMs: number[] = [];
  private tokenCost = 0;
  private fallbackVotes = 0;
  private totalVotes = 0;

  constructor(options: MultiAgentCoordinatorStrategyOptions = {}) {
    const debateMode = options.debateEnabled ?? true;
    this.name =
      options.name ??
      `multi-agent-coordinator-${debateMode ? "debate-on" : "debate-off"}`;
    this.lineageRecorder = options.lineageRecorder ?? new DecisionLineageRecorder();
    this.coordinator = new MultiAgentCoordinator({
      ...options,
      lineageRecorder: this.lineageRecorder,
    });
    this.news = options.news;
    this.predictionMarkets = options.predictionMarkets;
    this.fundamentals = options.fundamentals;
  }

  /**
   * Return recorded decision signals containing directional stances and confidences.
   */
  getDecisions(): DecisionSignal[] {
    return [...this.decisionSignals];
  }

  /**
   * Return recorded point-in-time decision lineage provenance audit records.
   */
  getLineageRecords(): DecisionLineageRecord[] {
    return this.lineageRecorder.getAll();
  }

  /**
   * Aggregate operational telemetry for the run: cumulative token cost, median
   * decision latency, and the fraction of specialist votes that degraded to a
   * NO_OPINION fallback. Consumed by `runExperiment` for the manifest HUD fields.
   */
  getTelemetry(): CoordinatorRunTelemetry {
    const sorted = [...this.latenciesMs].sort((a, b) => a - b);
    const median = sorted.length === 0
      ? 0
      : sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]!
        : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;

    return {
      tokenCost: Math.round(this.tokenCost * 1e6) / 1e6,
      medianLatencyMs: Math.round(median * 1000) / 1000,
      fallbackRate:
        this.totalVotes === 0
          ? 0
          : Math.round((this.fallbackVotes / this.totalVotes) * 10000) / 10000,
    };
  }

  async generateSignals(
    bars: PriceBar[],
    snapshots?: IndicatorSnapshot[],
  ): Promise<SignalType[]> {
    this.decisionSignals.length = 0;
    this.latenciesMs.length = 0;
    this.tokenCost = 0;
    this.fallbackVotes = 0;
    this.totalVotes = 0;
    const signals: SignalType[] = [];

    // Same contract as SmaRsiStrategy: the simulator does not precompute
    // snapshots, so derive them deterministically from the bar window. Without
    // this, the Technical specialist would see `indicators: null` at every
    // decision point and silently degrade to NO_OPINION.
    const effectiveSnapshots =
      snapshots && snapshots.length === bars.length
        ? snapshots
        : computeIndicatorSnapshots(bars);

    const snapshotMap = new Map(effectiveSnapshots.map((s) => [s.asOf, s]));

    for (let t = 0; t < bars.length; t++) {
      const currentBar = bars[t];
      if (!currentBar) continue;

      const decisionTs = currentBar.asOf;
      // Bounded point-in-time window: the most recent DECISION_BAR_WINDOW bars
      // with asOf <= decisionTs. Every agent reads only this tail, so lineage
      // records stay O(window) instead of O(t).
      const pointInTimeBars = bars.slice(
        Math.max(0, t + 1 - DECISION_BAR_WINDOW),
        t + 1,
      );
      const snapshot = snapshotMap.get(decisionTs) ?? null;

      // Coordinate decision at bar T (point-in-time filtering handled by TemporalGuard inside agents)
      const consensus = await this.coordinator.coordinate({
        symbol: currentBar.symbol,
        timeframe: currentBar.timeframe,
        decisionTs,
        bars: pointInTimeBars,
        indicators: snapshot,
        news: this.news,
        predictionMarkets: this.predictionMarkets,
        fundamentals: this.fundamentals,
      });

      // Map final directional bias to portfolio weight signal:
      // bullish -> 1.0 (long)
      // bearish -> 0.0 (flat/cash) or -1.0
      // neutral -> 0.0 (flat/cash)
      let signalWeight = 0.0;
      if (consensus.finalBias === "bullish") {
        signalWeight = 1.0;
      } else if (consensus.finalBias === "bearish") {
        signalWeight = 0.0; // In long-only evaluation regime
      } else {
        signalWeight = 0.0;
      }

      signals.push(signalWeight);

      this.decisionSignals.push({
        signal: signalWeight,
        confidence: consensus.finalConfidence,
      });

      const meta = consensus.metadata as
        | { durationMs?: unknown; tokenCost?: unknown }
        | undefined;
      const durationMs = typeof meta?.durationMs === "number" ? meta.durationMs : 0;
      const tokenCost = typeof meta?.tokenCost === "number" ? meta.tokenCost : 0;

      this.latenciesMs.push(durationMs);
      this.tokenCost += tokenCost;
      for (const vote of Object.values(consensus.specialistVotes)) {
        this.totalVotes += 1;
        if (vote.confidence === 0 && vote.rationale.startsWith("no opinion")) {
          this.fallbackVotes += 1;
        }
      }
    }

    return signals;
  }
}
