import { describe, expect, it } from "vitest";
import { DatasetFixture } from "@committee/contracts";
import {
  listAvailableFixtures,
  loadFixture,
  loadPriceBars,
  loadNews,
  loadFundamentals,
  loadPredictionMarkets,
} from "../src/index.js";

const EXPANDED_UNIVERSE = ["AAPL", "NVDA", "SPY", "MSFT", "GOOGL", "TLT", "QQQ"];

describe("Expanded Multi-Asset Universe Fixtures Integrity", () => {
  it("discovers all 7 fixtures in packages/fixtures/data", () => {
    const available = listAvailableFixtures();
    for (const sym of EXPANDED_UNIVERSE) {
      expect(available).toContain(sym);
    }
  });

  for (const sym of EXPANDED_UNIVERSE) {
    describe(`Symbol: ${sym}`, () => {
      it("loads and validates complete DatasetFixture Zod schema", () => {
        const fixture = loadFixture(sym);
        expect(fixture.symbol).toBe(sym);
        expect(DatasetFixture.safeParse(fixture).success).toBe(true);
      });

      it("contains 500+ daily bars in strictly ascending chronological order", () => {
        const bars = loadPriceBars(sym);
        expect(bars.length).toBeGreaterThanOrEqual(500);

        for (let i = 1; i < bars.length; i += 1) {
          const prev = new Date(bars[i - 1]!.ts).getTime();
          const curr = new Date(bars[i]!.ts).getTime();
          expect(curr).toBeGreaterThan(prev);

          // Point-in-time invariant: asOf >= ts
          const asOfTime = new Date(bars[i]!.asOf).getTime();
          expect(asOfTime).toBeGreaterThanOrEqual(curr);
        }
      });

      it("enforces point-in-time asOf tagging on all news items", () => {
        const news = loadNews(sym);
        for (const item of news) {
          expect(item.asOf).toBeDefined();
          const pubTime = new Date(item.publishedAt).getTime();
          const asOfTime = new Date(item.asOf).getTime();
          expect(asOfTime).toBeGreaterThanOrEqual(pubTime);
        }
      });

      it("enforces point-in-time asOf tagging on all SEC EDGAR fundamental filings", () => {
        const fundamentals = loadFundamentals(sym);
        for (const report of fundamentals) {
          expect(report.asOf).toBeDefined();
          const filedTime = new Date(report.filedAt).getTime();
          const asOfTime = new Date(report.asOf).getTime();
          expect(asOfTime).toBeGreaterThanOrEqual(filedTime);
        }
      });

      it("includes prediction market probability events", () => {
        const pm = loadPredictionMarkets(sym);
        expect(pm.length).toBeGreaterThan(0);
        for (const ev of pm) {
          expect(ev.history.length).toBeGreaterThan(0);
        }
      });
    });
  }
});
