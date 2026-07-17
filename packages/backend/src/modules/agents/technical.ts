import type { AgentInput, AgentOutput } from "@quantagent/shared";
import { BaseAgent } from "./framework.js";
import { latestIndicatorAsOf } from "../../lib/pointInTime.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("technical-agent");

/**
 * Deterministic, rule-based technical analyst agent.
 *
 * Maps indicator values to bias + confidence using explicit rules.
 * No LLM on the critical path — rationale is a deterministic template
 * that names the exact features used (facts-first principle).
 *
 * Rules:
 * - RSI < 30 → bullish signal (+1)
 * - RSI > 70 → bearish signal (-1)
 * - MACD histogram > 0 → bullish signal (+1)
 * - MACD histogram < 0 → bearish signal (-1)
 * - Close > SMA → bullish signal (+1)
 * - Close < SMA → bearish signal (-1)
 * - Close < BB lower → bullish (oversold, +1)
 * - Close > BB upper → bearish (overbought, -1)
 *
 * bias = sign(sum of signals)
 * confidence = |sum| / max_possible_signals
 */
export class TechnicalAgent extends BaseAgent {
  readonly name = "technical";

  async analyze(input: AgentInput): Promise<AgentOutput> {
    const { symbol, timeframe, decisionAsOf, features: inputFeatures } = input;
    const decisionTime = new Date(decisionAsOf);

    // Fetch the latest indicator snapshot available at decision time
    const snapshot = await latestIndicatorAsOf(symbol, timeframe, decisionTime);

    if (!snapshot) {
      throw new Error(
        `No indicator snapshot found for ${symbol}/${timeframe} at ${decisionAsOf}`
      );
    }

    const values = snapshot.values as Record<string, number | null>;

    // Extract feature values (use input features as overrides, then snapshot)
    const rsi = inputFeatures.rsi ?? values.rsi ?? null;
    const macdHist = inputFeatures.macd_hist ?? values.macd_hist ?? null;
    const sma = inputFeatures.sma ?? values.sma ?? null;
    const ema = inputFeatures.ema ?? values.ema ?? null;
    const bbUpper = inputFeatures.bb_upper ?? values.bb_upper ?? null;
    const bbLower = inputFeatures.bb_lower ?? values.bb_lower ?? null;
    const close = inputFeatures.close ?? values.close ?? null;

    // ─── Rule evaluation ──────────────────────────────────────────────────
    let signalSum = 0;
    let signalCount = 0;
    const reasons: string[] = [];
    const usedFeatures: Record<string, number> = {};

    // RSI
    if (rsi !== null) {
      usedFeatures.rsi = rsi;
      if (rsi < 30) {
        signalSum += 1;
        reasons.push(`RSI=${rsi.toFixed(1)} < 30 (oversold → bullish)`);
      } else if (rsi > 70) {
        signalSum -= 1;
        reasons.push(`RSI=${rsi.toFixed(1)} > 70 (overbought → bearish)`);
      } else {
        reasons.push(`RSI=${rsi.toFixed(1)} neutral (30–70)`);
      }
      signalCount++;
    }

    // MACD histogram
    if (macdHist !== null) {
      usedFeatures.macd_hist = macdHist;
      if (macdHist > 0) {
        signalSum += 1;
        reasons.push(`MACD histogram=${macdHist.toFixed(4)} > 0 (bullish momentum)`);
      } else if (macdHist < 0) {
        signalSum -= 1;
        reasons.push(`MACD histogram=${macdHist.toFixed(4)} < 0 (bearish momentum)`);
      } else {
        reasons.push(`MACD histogram=0 (neutral)`);
      }
      signalCount++;
    }

    // Close vs SMA
    if (close !== null && sma !== null) {
      usedFeatures.close = close;
      usedFeatures.sma = sma;
      if (close > sma) {
        signalSum += 1;
        reasons.push(
          `Close=${close.toFixed(2)} > SMA=${sma.toFixed(2)} (above trend → bullish)`
        );
      } else {
        signalSum -= 1;
        reasons.push(
          `Close=${close.toFixed(2)} < SMA=${sma.toFixed(2)} (below trend → bearish)`
        );
      }
      signalCount++;
    }

    // Close vs Bollinger Bands
    if (close !== null && bbLower !== null && bbUpper !== null) {
      usedFeatures.bb_upper = bbUpper;
      usedFeatures.bb_lower = bbLower;
      if (close < bbLower) {
        signalSum += 1;
        reasons.push(
          `Close=${close.toFixed(2)} < BB_lower=${bbLower.toFixed(2)} (oversold → bullish)`
        );
      } else if (close > bbUpper) {
        signalSum -= 1;
        reasons.push(
          `Close=${close.toFixed(2)} > BB_upper=${bbUpper.toFixed(2)} (overbought → bearish)`
        );
      } else {
        reasons.push(`Close within Bollinger Bands (neutral)`);
      }
      signalCount++;
    }

    // EMA tracking
    if (ema !== null) {
      usedFeatures.ema = ema;
    }

    // ─── Compute bias + confidence ────────────────────────────────────────
    const maxSignals = Math.max(signalCount, 1);
    const confidence = Math.min(Math.abs(signalSum) / maxSignals, 1);
    const bias =
      signalSum > 0 ? "bullish" : signalSum < 0 ? "bearish" : "neutral";

    const rationale = reasons.length > 0
      ? reasons.join("; ") + "."
      : "Insufficient indicator data for analysis.";

    logger.info(
      { symbol, bias, confidence, signalSum, signalCount },
      "Technical analysis complete"
    );

    return {
      agentName: this.name,
      symbol,
      bias,
      confidence: Number(confidence.toFixed(4)),
      rationale,
      features: usedFeatures,
      asOf: decisionAsOf,
      schemaVersion: "1.0.0",
    };
  }
}
