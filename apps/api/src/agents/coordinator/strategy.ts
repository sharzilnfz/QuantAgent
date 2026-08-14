import type {
  DecisionLineageRecord,
  IndicatorSnapshot,
  NewsItem,
  PredictionMarketEvent,
  PriceBar,
  SignalType,
  Strategy,
} from "@committee/contracts";

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
}

/**
 * MultiAgentCoordinatorStrategy implements the Strategy interface for backtest simulations.
 * Reconciles Technical, Sentiment, and Polymarket specialist signals at each point-in-time decision step,
 * recording lineage and tracking probabilistic decisions.
 */
export class MultiAgentCoordinatorStrategy implements Strategy {
  readonly name: string;
  public readonly coordinator: MultiAgentCoordinator;
  public readonly lineageRecorder: DecisionLineageRecorder;
  private readonly news?: NewsItem[];
  private readonly predictionMarkets?: PredictionMarketEvent[];
  private readonly decisionSignals: DecisionSignal[] = [];

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

  async generateSignals(
    bars: PriceBar[],
    snapshots?: IndicatorSnapshot[],
  ): Promise<SignalType[]> {
    this.decisionSignals.length = 0;
    const signals: SignalType[] = [];

    const snapshotMap = new Map((snapshots ?? []).map((s) => [s.asOf, s]));

    for (let t = 0; t < bars.length; t++) {
      const currentBar = bars[t];
      if (!currentBar) continue;

      const decisionTs = currentBar.asOf;
      const pointInTimeBars = bars.slice(0, t + 1);
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
    }

    return signals;
  }
}
