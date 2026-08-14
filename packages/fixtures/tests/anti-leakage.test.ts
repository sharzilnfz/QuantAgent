import { describe, it, expect } from "vitest";
import {
  TemporalGuard,
  TemporalIntegrityViolation,
  loadFixture,
  computeDailyBarAsOf,
} from "../src/index.js";
import type { PriceBar, NewsItem } from "@committee/contracts";

describe("Anti-Leakage CI Gate & TemporalGuard", () => {
  const sampleBars: PriceBar[] = [
    {
      symbol: "TEST",
      timeframe: "1Day",
      ts: "2024-01-03T14:30:00.000Z",
      open: 100,
      high: 105,
      low: 99,
      close: 104,
      volume: 1000000,
      asOf: "2024-01-03T21:00:00.000Z",
    },
    {
      symbol: "TEST",
      timeframe: "1Day",
      ts: "2024-01-04T14:30:00.000Z",
      open: 104,
      high: 108,
      low: 103,
      close: 107,
      volume: 1200000,
      asOf: "2024-01-04T21:00:00.000Z",
    },
    {
      symbol: "TEST",
      timeframe: "1Day",
      ts: "2024-01-05T14:30:00.000Z",
      open: 107,
      high: 110,
      low: 106,
      close: 109,
      volume: 1500000,
      asOf: "2024-01-05T21:00:00.000Z",
    },
  ];

  const sampleNews: NewsItem[] = [
    {
      id: "news-1",
      headline: "Company announces new product line",
      source: "benzinga",
      symbols: ["TEST"],
      publishedAt: "2024-01-03T18:00:00.000Z",
      asOf: "2024-01-03T18:00:00.000Z",
    },
    {
      id: "news-2",
      headline: "Analyst upgrades price target",
      source: "benzinga",
      symbols: ["TEST"],
      publishedAt: "2024-01-04T22:00:00.000Z",
      asOf: "2024-01-04T22:00:00.000Z",
    },
  ];

  it("strictly filters dataset records to only those with asOf <= T_decision", () => {
    // Decision instant: Jan 4 2024 at 21:00:00Z (after Jan 4 close, before Jan 5)
    const decisionTs = "2024-01-04T21:00:00.000Z";
    const visibleBars = TemporalGuard.queryBars(sampleBars, decisionTs);

    expect(visibleBars).toHaveLength(2);
    expect(visibleBars[0]?.ts).toBe("2024-01-03T14:30:00.000Z");
    expect(visibleBars[1]?.ts).toBe("2024-01-04T14:30:00.000Z");

    // Bar for Jan 5 must NOT be visible
    const hasJan5 = visibleBars.some((b) => b.ts.startsWith("2024-01-05"));
    expect(hasJan5).toBe(false);
  });

  it("throws TemporalIntegrityViolation when a dataset containing T+1 records is asserted at T", () => {
    // Decision instant is Jan 4 21:00Z, but we pass all 3 bars (including Jan 5) to assertNoLeakage
    const decisionTs = "2024-01-04T21:00:00.000Z";

    expect(() => {
      TemporalGuard.assertNoLeakage(sampleBars, decisionTs, "test-pipeline");
    }).toThrow(TemporalIntegrityViolation);

    try {
      TemporalGuard.assertNoLeakage(sampleBars, decisionTs);
    } catch (err) {
      expect(err).toBeInstanceOf(TemporalIntegrityViolation);
      const violation = err as TemporalIntegrityViolation;
      expect(violation.name).toBe("TemporalIntegrityViolation");
      expect(violation.decisionTs).toBe(decisionTs);
      expect(violation.recordTs).toBe("2024-01-05T21:00:00.000Z");
    }
  });

  it("catches deliberate look-ahead injections into news streams", () => {
    const decisionTs = "2024-01-04T12:00:00.000Z"; // Noon on Jan 4

    // Query news point-in-time
    const visibleNews = TemporalGuard.queryNews(sampleNews, decisionTs);
    expect(visibleNews).toHaveLength(1);
    expect(visibleNews[0]?.id).toBe("news-1");

    // Deliberately injecting news-2 (published at 22:00Z) into noon decision context throws violation
    expect(() => {
      TemporalGuard.assertNoLeakage(sampleNews, decisionTs, "sentiment-agent");
    }).toThrow(TemporalIntegrityViolation);
  });

  it("handles exact boundary condition: record at T is visible, T + 1ms is future", () => {
    const boundaryTs = "2024-01-04T21:00:00.000Z";
    const exactRecord = {
      asOf: "2024-01-04T21:00:00.000Z",
      data: "exact",
    };
    const futureRecord = {
      asOf: "2024-01-04T21:00:00.001Z",
      data: "future",
    };

    const queryResult = TemporalGuard.query([exactRecord, futureRecord], boundaryTs);
    expect(queryResult).toHaveLength(1);
    expect(queryResult[0]?.data).toBe("exact");

    expect(() => {
      TemporalGuard.assertNoLeakage([exactRecord, futureRecord], boundaryTs);
    }).toThrow(TemporalIntegrityViolation);
  });

  describe("Frozen Datasets Integrity & Zero-Leakage (AAPL, NVDA, SPY)", () => {
    const symbols = ["AAPL", "NVDA", "SPY"];

    for (const sym of symbols) {
      it(`enforces strict point-in-time discipline on ${sym} fixture`, () => {
        const fixture = loadFixture(sym);
        expect(fixture.bars.length).toBeGreaterThanOrEqual(500);

        for (let i = 0; i < fixture.bars.length; i += 1) {
          const bar = fixture.bars[i]!;
          const barOpenTime = new Date(bar.ts).getTime();
          const barAsOfTime = new Date(bar.asOf).getTime();

          // Invariant 1: Knowable moment (asOf) is strictly after or equal to open time (ts)
          expect(barAsOfTime).toBeGreaterThan(barOpenTime);

          // Invariant 2: asOf matches calculated regular session close
          const expectedAsOf = computeDailyBarAsOf(bar.ts);
          expect(bar.asOf).toBe(expectedAsOf);

          // Invariant 3: Sequential ordering
          if (i > 0) {
            const prevBar = fixture.bars[i - 1]!;
            const prevAsOf = new Date(prevBar.asOf).getTime();
            expect(barAsOfTime).toBeGreaterThan(prevAsOf);
          }
        }

        // Check news timestamps
        for (const item of fixture.news) {
          expect(new Date(item.asOf).getTime()).toBe(new Date(item.publishedAt).getTime());
        }
      });
    }
  });
});
