/**
 * Hand-rolled pure TypeScript technical indicators.
 * Zero external numeric dependencies.
 *
 * All conventions match the Python baseline (apps/quant/app/indicators/core.py)
 * and Spec 05 §7 / PRD Testing Decisions.
 */

export interface MacdResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export interface BollingerResult {
  lower: (number | null)[];
  mid: (number | null)[];
  upper: (number | null)[];
}

/**
 * Simple moving average of the last `length` items.
 * Indices 0..length-2 are null.
 */
export function sma(values: number[], length: number): (number | null)[] {
  if (length < 1) {
    throw new RangeError("sma length must be >= 1");
  }
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < length) {
    return out;
  }
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += values[i] ?? 0;
  }
  out[length - 1] = sum / length;
  for (let i = length; i < values.length; i++) {
    const curr = values[i] ?? 0;
    const prev = values[i - length] ?? 0;
    sum += curr - prev;
    out[i] = sum / length;
  }
  return out;
}

/**
 * Rolling population standard deviation (ddof=0) of last `length` items.
 * sqrt( sum((x_i - mean)^2) / length ). Indices 0..length-2 are null.
 */
export function rollingStdPopulation(values: number[], length: number): (number | null)[] {
  if (length < 1) {
    throw new RangeError("length must be >= 1");
  }
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < length) {
    return out;
  }
  for (let i = length - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - length + 1; j <= i; j++) {
      sum += values[j] ?? 0;
    }
    const mean = sum / length;
    let varSum = 0;
    for (let j = i - length + 1; j <= i; j++) {
      const diff = (values[j] ?? 0) - mean;
      varSum += diff * diff;
    }
    out[i] = Math.sqrt(varSum / length);
  }
  return out;
}

/**
 * SMA-seeded exponential moving average, alpha = 2 / (length + 1).
 * Leading nulls and non-finite values are skipped so it can be called on the
 * valid tail of another series (e.g. MACD signal line).
 */
export function ema(values: (number | null)[], length: number): (number | null)[] {
  if (length < 1) {
    throw new RangeError("ema length must be >= 1");
  }
  const out: (number | null)[] = new Array(values.length).fill(null);
  const valid: { index: number; val: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      valid.push({ index: i, val: v });
    }
  }
  if (valid.length < length) {
    return out;
  }
  const alpha = 2.0 / (length + 1.0);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const item = valid[i];
    if (item) {
      sum += item.val;
    }
  }
  let prev = sum / length;
  const seedItem = valid[length - 1];
  if (seedItem) {
    out[seedItem.index] = prev;
  }
  for (let i = length; i < valid.length; i++) {
    const item = valid[i];
    if (item) {
      prev = (item.val - prev) * alpha + prev;
      out[item.index] = prev;
    }
  }
  return out;
}

/**
 * Wilder's running moving average (alpha = 1/length), seeded with the SMA of first `length` items.
 */
export function wilderRma(values: number[], length: number): (number | null)[] {
  if (length < 1) {
    throw new RangeError("wilderRma length must be >= 1");
  }
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < length) {
    return out;
  }
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += values[i] ?? 0;
  }
  let prev = sum / length;
  out[length - 1] = prev;
  for (let i = length; i < values.length; i++) {
    const curr = values[i] ?? 0;
    prev = (prev * (length - 1) + curr) / length;
    out[i] = prev;
  }
  return out;
}

/**
 * Helper to compute RSI from smoothed average gain and average loss.
 */
function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0.0 && avgGain === 0.0) {
    // Perfectly flat window: no directional information.
    return 50.0;
  }
  if (avgLoss === 0.0) {
    return 100.0;
  }
  if (avgGain === 0.0) {
    return 0.0;
  }
  const rs = avgGain / avgLoss;
  return 100.0 - 100.0 / (1.0 + rs);
}

/**
 * Wilder's RSI. Indices 0..length-1 are null (needs `length` price changes).
 */
export function rsi(values: number[], length: number = 14): (number | null)[] {
  if (length < 1) {
    throw new RangeError("rsi length must be >= 1");
  }
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= length) {
    return out;
  }

  const rawGain: number[] = new Array(values.length).fill(0);
  const rawLoss: number[] = new Array(values.length).fill(0);
  for (let i = 1; i < values.length; i++) {
    const curr = values[i] ?? 0;
    const prev = values[i - 1] ?? 0;
    const diff = curr - prev;
    rawGain[i] = diff > 0 ? diff : 0;
    rawLoss[i] = diff < 0 ? -diff : 0;
  }

  // Seed on changes at indices 1..length -> first RSI value sits at index `length`.
  let sumGain = 0;
  let sumLoss = 0;
  for (let i = 1; i <= length; i++) {
    sumGain += rawGain[i] ?? 0;
    sumLoss += rawLoss[i] ?? 0;
  }
  let avgGain = sumGain / length;
  let avgLoss = sumLoss / length;
  out[length] = rsiFromAverages(avgGain, avgLoss);

  for (let i = length + 1; i < values.length; i++) {
    const g = rawGain[i] ?? 0;
    const l = rawLoss[i] ?? 0;
    avgGain = (avgGain * (length - 1) + g) / length;
    avgLoss = (avgLoss * (length - 1) + l) / length;
    out[i] = rsiFromAverages(avgGain, avgLoss);
  }

  return out;
}

/**
 * MACD line, signal line, and histogram.
 * fast < slow required.
 */
export function macd(
  values: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9,
): MacdResult {
  if (fast >= slow) {
    throw new RangeError("macd requires fast < slow");
  }
  if (fast < 1 || slow < 1 || signal < 1) {
    throw new RangeError("macd parameters must be >= 1");
  }

  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const line: (number | null)[] = new Array(values.length).fill(null);

  for (let i = 0; i < values.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f !== null && f !== undefined && s !== null && s !== undefined) {
      line[i] = f - s;
    }
  }

  const signalLine = ema(line, signal);
  const histogram: (number | null)[] = new Array(values.length).fill(null);

  for (let i = 0; i < values.length; i++) {
    const m = line[i];
    const sig = signalLine[i];
    if (m !== null && m !== undefined && sig !== null && sig !== undefined) {
      histogram[i] = m - sig;
    }
  }

  return {
    macd: line,
    signal: signalLine,
    histogram,
  };
}

/**
 * Bollinger Bands (lower, mid, upper).
 */
export function bollinger(
  values: number[],
  length: number = 20,
  numStd: number = 2.0,
): BollingerResult {
  if (length < 1) {
    throw new RangeError("bollinger length must be >= 1");
  }
  const mid = sma(values, length);
  const dev = rollingStdPopulation(values, length);
  const lower: (number | null)[] = new Array(values.length).fill(null);
  const upper: (number | null)[] = new Array(values.length).fill(null);

  for (let i = 0; i < values.length; i++) {
    const m = mid[i];
    const d = dev[i];
    if (m !== null && m !== undefined && d !== null && d !== undefined) {
      const band = d * numStd;
      lower[i] = m - band;
      upper[i] = m + band;
    }
  }

  return {
    lower,
    mid,
    upper,
  };
}
