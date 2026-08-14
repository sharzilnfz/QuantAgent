import { describe, expect, it } from "vitest";
import {
  bollinger,
  ema,
  macd,
  rollingStdPopulation,
  rsi,
  sma,
  wilderRma,
} from "../src/indicators/core.js";

// ---------------------------------------------------------------------------
// Independent oracles — plain loops, no shared code with core.ts.
// ---------------------------------------------------------------------------
export function oracleSma(values: number[], n: number): (number | null)[] {
  return values.map((_, i) =>
    i < n - 1
      ? null
      : values.slice(i - n + 1, i + 1).reduce((sum, v) => sum + v, 0) / n,
  );
}

export function oracleEma(values: number[], n: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < n) return out;
  const alpha = 2.0 / (n + 1.0);
  let prev = values.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
  out[n - 1] = prev;
  for (let i = n; i < values.length; i++) {
    const val = values[i] ?? 0;
    prev = (val - prev) * alpha + prev;
    out[i] = prev;
  }
  return out;
}

export function oracleRsi(values: number[], n: number = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= n) return out;

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const curr = values[i] ?? 0;
    const prev = values[i - 1] ?? 0;
    gains.push(Math.max(curr - prev, 0.0));
    losses.push(Math.max(prev - curr, 0.0));
  }

  let avgG = gains.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let avgL = losses.slice(0, n).reduce((s, v) => s + v, 0) / n;

  function toRsi(g: number, l: number): number {
    if (g === 0.0 && l === 0.0) return 50.0;
    if (l === 0.0) return 100.0;
    if (g === 0.0) return 0.0;
    return 100.0 - 100.0 / (1.0 + g / l);
  }

  out[n] = toRsi(avgG, avgL);
  for (let i = n + 1; i < values.length; i++) {
    const g = gains[i - 1] ?? 0;
    const l = losses[i - 1] ?? 0;
    avgG = (avgG * (n - 1) + g) / n;
    avgL = (avgL * (n - 1) + l) / n;
    out[i] = toRsi(avgG, avgL);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Synthetic test series
// ---------------------------------------------------------------------------
export function crossoverCloses(): number[] {
  const arr: number[] = [];
  for (let i = 0; i < 100; i++) arr.push(200.0 - i);
  for (let i = 100; i < 200; i++) arr.push(i + 2.0);
  return arr;
}

export const CROSSOVER_BAR = 122;

describe("SMA", () => {
  it("computes closed-form values on a linear ramp", () => {
    const ramp = Array.from({ length: 80 }, (_, i) => i);
    const s20 = sma(ramp, 20);
    const s50 = sma(ramp, 50);

    expect(s20[18]).toBeNull();
    expect(s20[19]).toBeCloseTo(9.5, 10);
    expect(s20[50]).toBeCloseTo(40.5, 10);

    expect(s50[48]).toBeNull();
    expect(s50[49]).toBeCloseTo(24.5, 10);
    expect(s50[79]).toBeCloseTo(54.5, 10);
  });

  it("matches the independent oracle", () => {
    const closes = crossoverCloses();
    for (const n of [20, 50]) {
      const expected = oracleSma(closes, n);
      const actual = sma(closes, n);
      expect(actual.length).toBe(expected.length);
      for (let i = 0; i < closes.length; i++) {
        const want = expected[i];
        const got = actual[i];
        if (want === null || want === undefined) {
          expect(got).toBeNull();
        } else {
          expect(got).toBeCloseTo(want, 10);
        }
      }
    }
  });

  it("rejects invalid length", () => {
    expect(() => sma([1.0, 2.0], 0)).toThrow();
    expect(() => sma([1.0, 2.0], -1)).toThrow();
  });
});

describe("SMA crossover bar", () => {
  it("fires on the expected crossover bar (122)", () => {
    const closes = crossoverCloses();
    const s20 = sma(closes, 20);
    const s50 = sma(closes, 50);

    // Hand-computed at bar 122:
    expect(s20[CROSSOVER_BAR]).toBeCloseTo(114.5, 2);
    expect(s50[CROSSOVER_BAR]).toBeCloseTo(113.54, 2);

    // Prior bar (121): s20 < s50
    expect(s20[CROSSOVER_BAR - 1]).toBeCloseTo(113.5, 2);
    expect(s50[CROSSOVER_BAR - 1]).toBeCloseTo(113.62, 2);
    expect(s20[CROSSOVER_BAR - 1]!).toBeLessThan(s50[CROSSOVER_BAR - 1]!);
    expect(s20[CROSSOVER_BAR]!).toBeGreaterThan(s50[CROSSOVER_BAR]!);
  });
});

describe("RSI", () => {
  it("is 100 on a strictly rising series", () => {
    const rising = Array.from({ length: 60 }, (_, i) => 100.0 + i);
    const values = rsi(rising, 14);
    expect(values[13]).toBeNull();
    expect(values[14]).toBeCloseTo(100.0, 10);
    expect(values[values.length - 1]).toBeCloseTo(100.0, 10);
  });

  it("is 0 on a strictly falling series", () => {
    const falling = Array.from({ length: 60 }, (_, i) => 200.0 - i);
    const values = rsi(falling, 14);
    expect(values[13]).toBeNull();
    expect(values[14]).toBeCloseTo(0.0, 10);
    expect(values[values.length - 1]).toBeCloseTo(0.0, 10);
  });

  it("is 50 on a flat series", () => {
    const flat = Array.from({ length: 80 }, () => 100.0);
    const values = rsi(flat, 14);
    expect(values[13]).toBeNull();
    expect(values[14]).toBeCloseTo(50.0, 10);
    expect(values[values.length - 1]).toBeCloseTo(50.0, 10);
  });

  it("matches the independent Wilder oracle", () => {
    const closes = crossoverCloses();
    const expected = oracleRsi(closes, 14);
    const actual = rsi(closes, 14);
    for (let i = 0; i < closes.length; i++) {
      const want = expected[i];
      const got = actual[i];
      if (want === null || want === undefined) {
        expect(got).toBeNull();
      } else {
        expect(got).toBeCloseTo(want, 10);
      }
    }
  });

  it("hand-computed on a tiny series", () => {
    // 15 closes -> exactly one RSI value, at index 14.
    // Gains at odd steps (+2), losses at even steps (-1): 7 gains, 7 losses.
    const closes = [100.0];
    for (let i = 0; i < 14; i++) {
      const last = closes[closes.length - 1] ?? 100.0;
      closes.push(last + (i % 2 === 0 ? 2.0 : -1.0));
    }
    const avgGain = (7 * 2.0) / 14;
    const avgLoss = (7 * 1.0) / 14;
    const expected = 100.0 - 100.0 / (1.0 + avgGain / avgLoss); // rs = 2 -> 66.666...
    const values = rsi(closes, 14);
    expect(values[13]).toBeNull();
    expect(values[14]).toBeCloseTo(expected, 10);
    expect(values[14]).toBeCloseTo(200.0 / 3.0, 10);
  });

  it("rejects invalid length", () => {
    expect(() => rsi([100, 101], 0)).toThrow();
  });
});

describe("MACD", () => {
  it("EMA matches the independent oracle", () => {
    const closes = crossoverCloses();
    for (const n of [9, 12, 26]) {
      const expected = oracleEma(closes, n);
      const actual = ema(closes, n);
      for (let i = 0; i < closes.length; i++) {
        const want = expected[i];
        const got = actual[i];
        if (want === null || want === undefined) {
          expect(got).toBeNull();
        } else {
          expect(got).toBeCloseTo(want, 10);
        }
      }
    }
  });

  it("line is fast EMA minus slow EMA", () => {
    const closes = crossoverCloses();
    const fast = oracleEma(closes, 12);
    const slow = oracleEma(closes, 26);
    const res = macd(closes, 12, 26, 9);
    for (let i = 0; i < closes.length; i++) {
      const f = fast[i];
      const s = slow[i];
      if (f === null || f === undefined || s === null || s === undefined) {
        expect(res.macd[i]).toBeNull();
      } else {
        expect(res.macd[i]).toBeCloseTo(f - s, 10);
      }
    }
  });

  it("signal is an EMA of the line and histogram is their difference", () => {
    const closes = crossoverCloses();
    const res = macd(closes, 12, 26, 9);
    const lineTail = res.macd.filter((v): v is number => v !== null);
    const expectedSignal = oracleEma(lineTail, 9);
    const actualSignal = res.signal.filter((v): v is number => v !== null);

    const validExpected = expectedSignal.filter((v): v is number => v !== null);
    expect(actualSignal.length).toBe(validExpected.length);
    for (let i = 0; i < actualSignal.length; i++) {
      const exp = validExpected[i];
      if (exp !== undefined) {
        expect(actualSignal[i]).toBeCloseTo(exp, 10);
      }
    }

    for (let i = 0; i < closes.length; i++) {
      const m = res.macd[i];
      const sig = res.signal[i];
      if (m !== null && m !== undefined && sig !== null && sig !== undefined) {
        expect(res.histogram[i]).toBeCloseTo(m - sig, 10);
      } else {
        expect(res.histogram[i]).toBeNull();
      }
    }
  });

  it("is zero on a flat series", () => {
    const flat = Array.from({ length: 80 }, () => 100.0);
    const res = macd(flat, 12, 26, 9);
    const valid = res.macd.filter((v): v is number => v !== null);
    for (const v of valid) {
      expect(Math.abs(v)).toBeCloseTo(0.0, 10);
    }
  });

  it("rejects fast >= slow", () => {
    expect(() => macd([1.0, 2.0], 26, 12)).toThrow();
    expect(() => macd([1.0, 2.0], 12, 12)).toThrow();
  });
});

describe("Bollinger Bands & Rolling Std", () => {
  it("hand-computed on a linear ramp", () => {
    // Window 0..19 of p[i] = i: mid = 9.5; population variance = 33.25.
    const ramp = Array.from({ length: 80 }, (_, i) => i);
    const expectedStd = Math.sqrt(33.25);
    const res = bollinger(ramp, 20, 2.0);

    expect(res.mid[19]).toBeCloseTo(9.5, 10);
    expect(res.upper[19]).toBeCloseTo(9.5 + 2 * expectedStd, 10);
    expect(res.lower[19]).toBeCloseTo(9.5 - 2 * expectedStd, 10);
    expect(res.upper[19]).toBeCloseTo(21.03256259467, 8);
  });

  it("collapses to the mean on a flat series", () => {
    const flat = Array.from({ length: 80 }, () => 100.0);
    const res = bollinger(flat, 20, 2.0);
    expect(res.upper[19]).toBeCloseTo(100.0, 10);
    expect(res.lower[19]).toBeCloseTo(100.0, 10);
    expect(res.mid[19]).toBeCloseTo(100.0, 10);
  });

  it("uses population stdev (ddof=0) not sample (ddof=1)", () => {
    const ramp = Array.from({ length: 80 }, (_, i) => i);
    const res = bollinger(ramp, 20, 2.0);
    const upper19 = res.upper[19];
    const mid19 = res.mid[19];
    expect(upper19).not.toBeNull();
    expect(mid19).not.toBeNull();

    if (upper19 !== null && upper19 !== undefined && mid19 !== null && mid19 !== undefined) {
      const width = upper19 - mid19;
      // Sample variance for 0..19: sum((i - 9.5)^2) / 19 = 665 / 19 = 35.0
      const sampleStd = Math.sqrt(35.0);
      const sampleStdWidth = 2 * sampleStd;

      expect(width).toBeCloseTo(2 * Math.sqrt(33.25), 10);
      expect(Math.abs(width - sampleStdWidth)).toBeGreaterThan(0.1);
    }
  });

  it("rejects length < 1", () => {
    expect(() => rollingStdPopulation([1, 2], 0)).toThrow();
    expect(() => bollinger([1, 2], 0)).toThrow();
  });
});

describe("Wilder RMA", () => {
  it("matches SMA seed and recursion", () => {
    const values = [10, 20, 30, 40, 50, 60, 70];
    const rma = wilderRma(values, 3);
    expect(rma[0]).toBeNull();
    expect(rma[1]).toBeNull();
    expect(rma[2]).toBeCloseTo((10 + 20 + 30) / 3, 10); // 20
    expect(rma[3]).toBeCloseTo((20 * 2 + 40) / 3, 10); // 80/3 = 26.6666...
    expect(rma[4]).toBeCloseTo(((80 / 3) * 2 + 50) / 3, 10);
  });

  it("rejects length < 1", () => {
    expect(() => wilderRma([1, 2], 0)).toThrow();
  });
});
