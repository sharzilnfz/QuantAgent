import type { Direction } from "@committee/contracts";

/**
 * Spec 07 §5 — THE FACTS SIDE OF "FACTS VS NARRATION".
 *
 * Everything in this file is deterministic TypeScript. No LLM is involved, and no
 * LLM output can influence it. The mechanical read computed here is what gets
 * handed to the model; the model's job is to *weigh and explain* it, never to
 * compute or restate a number.
 *
 * This is a pure function of its inputs — same facts in, same read out, forever.
 * That is what makes the technical agent auditable and replayable.
 */

/**
 * The already-computed indicator values the agent reasons over. `close` comes from
 * the latest point-in-time price bar; the rest from the indicator snapshot.
 * Any field may be null when its lookback window was not yet satisfied.
 */
export interface IndicatorFacts {
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  sma20: number | null;
  sma50: number | null;
  close: number | null;
}

/** One deterministic rule that fired, with the direction and weight it contributes. */
export interface MechanicalSignal {
  /** Stable rule id, e.g. `rsi_oversold`, `macd_bull_cross`. */
  rule: string;
  direction: Exclude<Direction, "neutral">;
  /** Relative importance of this rule in the blend, (0,1]. */
  weight: number;
}

export interface MechanicalRead {
  /** The mechanical bias before the LLM sees anything. */
  direction: Direction;
  /** Signal strength in [0,1] — |score| scaled by how many indicators were available. */
  strength: number;
  /** Signed blend of the fired rules, in [-1,1]. Positive = bullish. */
  score: number;
  /** Fraction of the maximum possible rule weight that was actually computable, [0,1]. */
  coverage: number;
  signals: MechanicalSignal[];
  /** Joined rule ids, e.g. `rsi_oversold+macd_bull_cross`. `none` when nothing fired. */
  rule: string;
  /**
   * The COMPUTED evidence map. These key/values are authoritative: whatever the
   * model narrates, these are what land in `AgentOutput.evidence`.
   */
  evidence: Record<string, number | string | boolean>;
}

/** Total weight of every rule that *could* fire, used to compute coverage. */
const MAX_WEIGHT = 1.0 + 0.8 + 0.7 + 0.5 + 0.4;

/** |score| below this is treated as no meaningful mechanical bias. */
const NEUTRAL_BAND = 0.15;

/**
 * Derive the mechanical read from computed indicators.
 *
 * Rules (all mean-reversion / trend heuristics, all deterministic):
 *   - RSI zone            weight 1.0  — <30 oversold (bullish), >70 overbought (bearish);
 *                                        30-40 / 60-70 lean at 40% weight.
 *   - MACD cross sign     weight 0.8  — macd above signal = bullish, below = bearish.
 *   - Close vs Bollinger  weight 0.7  — below lower band = bullish (mean reversion),
 *                                        above upper band = bearish.
 *   - SMA20 vs SMA50      weight 0.5  — trend regime.
 *   - Close vs SMA20      weight 0.4  — short-term trend position.
 *
 * score = sum(signed weight) / sum(fired weight), clamped to [-1,1].
 * strength = |score| * coverage — a strong read on one indicator out of five is
 * deliberately less confident than the same read on all five.
 */
export function classify(facts: IndicatorFacts): MechanicalRead {
  const signals: MechanicalSignal[] = [];
  let signed = 0;
  let fired = 0;

  const add = (rule: string, direction: Exclude<Direction, "neutral">, weight: number) => {
    signals.push({ rule, direction, weight });
    signed += direction === "bullish" ? weight : -weight;
    fired += weight;
  };

  // --- RSI zone -------------------------------------------------------------
  if (facts.rsi !== null) {
    if (facts.rsi < 30) add("rsi_oversold", "bullish", 1.0);
    else if (facts.rsi < 40) add("rsi_lean_oversold", "bullish", 0.4);
    else if (facts.rsi > 70) add("rsi_overbought", "bearish", 1.0);
    else if (facts.rsi > 60) add("rsi_lean_overbought", "bearish", 0.4);
    else fired += 1.0; // RSI was available and read neutral — counts toward coverage.
  }

  // --- MACD cross sign ------------------------------------------------------
  if (facts.macd !== null && facts.macdSignal !== null) {
    if (facts.macd > facts.macdSignal) add("macd_bull_cross", "bullish", 0.8);
    else if (facts.macd < facts.macdSignal) add("macd_bear_cross", "bearish", 0.8);
    else fired += 0.8;
  }

  // --- Close vs Bollinger bands --------------------------------------------
  if (facts.close !== null) {
    if (facts.bbLower !== null && facts.close < facts.bbLower) {
      add("close_below_lower_band", "bullish", 0.7);
    } else if (facts.bbUpper !== null && facts.close > facts.bbUpper) {
      add("close_above_upper_band", "bearish", 0.7);
    } else if (facts.bbLower !== null || facts.bbUpper !== null) {
      fired += 0.7;
    }
  }

  // --- Trend regime: SMA20 vs SMA50 ----------------------------------------
  if (facts.sma20 !== null && facts.sma50 !== null) {
    if (facts.sma20 > facts.sma50) add("sma20_above_sma50", "bullish", 0.5);
    else if (facts.sma20 < facts.sma50) add("sma20_below_sma50", "bearish", 0.5);
    else fired += 0.5;
  }

  // --- Short-term position: close vs SMA20 ---------------------------------
  if (facts.close !== null && facts.sma20 !== null) {
    if (facts.close > facts.sma20) add("close_above_sma20", "bullish", 0.4);
    else if (facts.close < facts.sma20) add("close_below_sma20", "bearish", 0.4);
    else fired += 0.4;
  }

  const score = fired === 0 ? 0 : clamp(signed / fired, -1, 1);
  const coverage = clamp(fired / MAX_WEIGHT, 0, 1);

  const direction: Direction =
    score > NEUTRAL_BAND ? "bullish" : score < -NEUTRAL_BAND ? "bearish" : "neutral";

  const strength = round3(clamp(Math.abs(score) * coverage, 0, 1));
  const rule = signals.length > 0 ? signals.map((s) => s.rule).join("+") : "none";

  return {
    direction,
    strength,
    score: round3(score),
    coverage: round3(coverage),
    signals,
    rule,
    evidence: buildEvidence(facts, { direction, strength, score, coverage, rule }),
  };
}

/** True when not a single indicator was computable — the agent must say nothing. */
export function hasNoUsableFacts(read: MechanicalRead): boolean {
  return read.coverage === 0;
}

export function rsiZone(rsi: number | null): string {
  if (rsi === null) return "unavailable";
  if (rsi < 30) return "oversold";
  if (rsi < 40) return "lean_oversold";
  if (rsi > 70) return "overbought";
  if (rsi > 60) return "lean_overbought";
  return "neutral";
}

/**
 * The authoritative evidence map. Only computed values go in here — this object
 * is spread LAST when assembling `AgentOutput.evidence`, so a model that narrates
 * a different RSI can never overwrite the real one.
 */
function buildEvidence(
  facts: IndicatorFacts,
  read: Pick<MechanicalRead, "direction" | "strength" | "score" | "coverage" | "rule">,
): Record<string, number | string | boolean> {
  const evidence: Record<string, number | string | boolean> = {
    rule: read.rule,
    rsiZone: rsiZone(facts.rsi),
    mechanicalDirection: read.direction,
    mechanicalStrength: round3(read.strength),
    mechanicalScore: round3(read.score),
    indicatorCoverage: round3(read.coverage),
  };

  for (const [key, value] of Object.entries(facts)) {
    if (typeof value === "number" && Number.isFinite(value)) evidence[key] = value;
  }

  if (facts.macd !== null && facts.macdSignal !== null) {
    evidence.macdHistogram = round3(facts.macd - facts.macdSignal);
  }

  return evidence;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
