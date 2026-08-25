import type {
  DecisionLineageRecord,
  FundamentalReport,
  IndicatorSnapshot,
  MultiAssetStrategy,
  NewsItem,
  PredictionMarketEvent,
  PriceBar,
  SignalType,
} from "@committee/contracts";

import { computeIndicatorSnapshots } from "../../indicators/index.js";
import {
  MultiAgentCoordinator,
  type CoordinatorOptions,
} from "./coordinator.js";
import { DecisionLineageRecorder } from "./lineage.js";

export interface MultiAssetCoordinatorStrategyOptions extends CoordinatorOptions {
  name?: string;
  newsBySymbol?: Record<string, NewsItem[]>;
  predictionMarkets?: PredictionMarketEvent[];
  fundamentalsBySymbol?: Record<string, FundamentalReport[]>;
  sizingMethod?: "equal_weight" | "conviction_weighted";
}

export interface MultiAssetRunTelemetry {
  tokenCost: number;
  medianLatencyMs: number;
  fallbackRate: number;
}

const DECISION_BAR_WINDOW = 20;

/**
 * MultiAssetCoordinatorStrategy implements MultiAssetStrategy for backtest simulations.
 * Coordinates multi-specialist committee decisions across all assets in a universe,
 * performing cross-asset conviction-weighted capital allocation while strictly enforcing point-in-time constraints.
 */
export class MultiAssetCoordinatorStrategy implements MultiAssetStrategy {
  readonly name: string;
  public readonly coordinator: MultiAgentCoordinator;
  public readonly lineageRecorder: DecisionLineageRecorder;
  private readonly newsBySymbol?: Record<string, NewsItem[]>;
  private readonly predictionMarkets?: PredictionMarketEvent[];
  private readonly fundamentalsBySymbol?: Record<string, FundamentalReport[]>;
  private readonly sizingMethod: "equal_weight" | "conviction_weighted";
  private readonly latenciesMs: number[] = [];
  private tokenCost = 0;
  private fallbackVotes = 0;
  private totalVotes = 0;

  constructor(options: MultiAssetCoordinatorStrategyOptions = {}) {
    const debateMode = options.debateEnabled ?? true;
    this.name =
      options.name ??
      `multi-asset-coordinator-${debateMode ? "debate-on" : "debate-off"}`;
    this.lineageRecorder = options.lineageRecorder ?? new DecisionLineageRecorder();
    this.coordinator = new MultiAgentCoordinator({
      ...options,
      lineageRecorder: this.lineageRecorder,
    });
    this.newsBySymbol = options.newsBySymbol;
    this.predictionMarkets = options.predictionMarkets;
    this.fundamentalsBySymbol = options.fundamentalsBySymbol;
    this.sizingMethod = options.sizingMethod ?? "conviction_weighted";
  }

  getLineageRecords(): DecisionLineageRecord[] {
    return this.lineageRecorder.getAll();
  }

  getTelemetry(): MultiAssetRunTelemetry {
    const sorted = [...this.latenciesMs].sort((a, b) => a - b);
    const median =
      sorted.length === 0
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

  async generateMultiAssetSignals(
    universeBars: Record<string, PriceBar[]>,
    snapshotsBySymbol?: Record<string, IndicatorSnapshot[]>,
  ): Promise<Record<string, SignalType>[]> {
    this.latenciesMs.length = 0;
    this.tokenCost = 0;
    this.fallbackVotes = 0;
    this.totalVotes = 0;

    const symbols = Object.keys(universeBars).sort();
    if (symbols.length === 0) return [];

    // Precompute snapshots and align bars per symbol
    const snapshotsMap: Record<string, Map<string, IndicatorSnapshot>> = {};
    const barsMap: Record<string, Map<string, PriceBar>> = {};
    const timestampSet = new Set<string>();

    for (const sym of symbols) {
      const bars = universeBars[sym] ?? [];
      const snaps = snapshotsBySymbol?.[sym] ?? computeIndicatorSnapshots(bars);
      snapshotsMap[sym] = new Map(snaps.map((s) => [s.asOf, s]));
      const bMap = new Map<string, PriceBar>();
      for (const b of bars) {
        timestampSet.add(b.ts);
        bMap.set(b.ts, b);
      }
      barsMap[sym] = bMap;
    }

    const sortedTimestamps = Array.from(timestampSet).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

    const signalMaps: Record<string, SignalType>[] = [];

    // Step through each timestamp in the universe
    for (let t = 0; t < sortedTimestamps.length; t++) {
      const ts = sortedTimestamps[t]!;
      const stances: Record<string, { bias: string; confidence: number }> = {};

      for (const sym of symbols) {
        const currentBar = barsMap[sym]?.get(ts);
        if (!currentBar) {
          stances[sym] = { bias: "neutral", confidence: 0 };
          continue;
        }

        const barsList = universeBars[sym] ?? [];
        const barIndex = barsList.findIndex((b) => b.ts === ts);
        const pointInTimeBars =
          barIndex >= 0
            ? barsList.slice(Math.max(0, barIndex + 1 - DECISION_BAR_WINDOW), barIndex + 1)
            : [currentBar];

        const decisionTs = currentBar.asOf;
        const snapshot = snapshotsMap[sym]?.get(decisionTs) ?? null;

        const consensus = await this.coordinator.coordinate({
          symbol: sym,
          timeframe: currentBar.timeframe,
          decisionTs,
          bars: pointInTimeBars,
          indicators: snapshot,
          news: this.newsBySymbol?.[sym],
          predictionMarkets: this.predictionMarkets,
          fundamentals: this.fundamentalsBySymbol?.[sym],
        });

        stances[sym] = {
          bias: consensus.finalBias,
          confidence: consensus.finalConfidence,
        };

        const meta = consensus.metadata as
          | { durationMs?: unknown; tokenCost?: unknown }
          | undefined;
        const durationMs = typeof meta?.durationMs === "number" ? meta.durationMs : 0;
        const cost = typeof meta?.tokenCost === "number" ? meta.tokenCost : 0;
        this.latenciesMs.push(durationMs);
        this.tokenCost += cost;

        for (const vote of Object.values(consensus.specialistVotes)) {
          this.totalVotes += 1;
          if (vote.confidence === 0 && vote.rationale.startsWith("no opinion")) {
            this.fallbackVotes += 1;
          }
        }
      }

      // Cross-Asset Allocation Logic
      const signalMap: Record<string, SignalType> = {};
      const bullishSymbols = symbols.filter((sym) => stances[sym]?.bias === "bullish");

      if (bullishSymbols.length === 0) {
        for (const sym of symbols) signalMap[sym] = 0.0;
      } else if (this.sizingMethod === "equal_weight") {
        const weight = 1.0 / bullishSymbols.length;
        for (const sym of symbols) {
          signalMap[sym] = stances[sym]?.bias === "bullish" ? weight : 0.0;
        }
      } else {
        // Conviction-Weighted allocation
        const totalConviction = bullishSymbols.reduce(
          (acc, sym) => acc + (stances[sym]?.confidence ?? 0.5),
          0,
        );

        for (const sym of symbols) {
          if (stances[sym]?.bias === "bullish" && totalConviction > 0) {
            const conf = stances[sym]?.confidence ?? 0.5;
            signalMap[sym] = conf / totalConviction;
          } else {
            signalMap[sym] = 0.0;
          }
        }
      }

      signalMaps.push(signalMap);
    }

    return signalMaps;
  }
}
