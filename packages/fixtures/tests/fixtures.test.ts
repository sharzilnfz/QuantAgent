import { describe, it, expect } from "vitest";
import {
  loadFixture,
  loadPriceBars,
  loadNews,
  listAvailableFixtures,
  TemporalGuard,
} from "../src/index.js";

describe("Frozen Fixtures Zero-Credential Loader", () => {
  it("lists pre-packaged fixtures for AAPL, NVDA, SPY", () => {
    const available = listAvailableFixtures();
    expect(available).toContain("AAPL");
    expect(available).toContain("NVDA");
    expect(available).toContain("SPY");
  });

  it("loads AAPL fixture with 2023-2024 daily bars and news", () => {
    const aapl = loadFixture("AAPL");
    expect(aapl.symbol).toBe("AAPL");
    expect(aapl.bars.length).toBeGreaterThanOrEqual(500);
    expect(aapl.news.length).toBeGreaterThanOrEqual(5);

    // Verify date range
    const firstBar = aapl.bars[0]!;
    const lastBar = aapl.bars[aapl.bars.length - 1]!;
    expect(firstBar.ts).toMatch(/^2023-01/);
    expect(lastBar.ts).toMatch(/^2024-12/);
  });

  it("loads NVDA and SPY fixtures seamlessly without API credentials", () => {
    const nvdaBars = loadPriceBars("NVDA");
    const spyNews = loadNews("SPY");

    expect(nvdaBars.length).toBeGreaterThanOrEqual(500);
    expect(spyNews.length).toBeGreaterThanOrEqual(3);
  });

  it("throws a descriptive error when a non-existent symbol is requested", () => {
    expect(() => {
      loadFixture("NONEXISTENT_XYZ");
    }).toThrow(/Fixture for symbol "NONEXISTENT_XYZ" not found/);
  });

  it("queries sub-window of dataset fixture point-in-time via TemporalGuard", () => {
    const fixture = loadFixture("AAPL");
    const mid2023Cutoff = "2023-06-30T21:00:00.000Z";

    const filtered = TemporalGuard.queryDataset(fixture, mid2023Cutoff);
    expect(filtered.symbol).toBe("AAPL");
    expect(filtered.bars.length).toBeGreaterThan(100);
    expect(filtered.bars.length).toBeLessThan(fixture.bars.length);

    // Assert that every bar and news in the filtered dataset is <= mid2023Cutoff
    for (const bar of filtered.bars) {
      expect(new Date(bar.asOf).getTime()).toBeLessThanOrEqual(new Date(mid2023Cutoff).getTime());
    }
    for (const item of filtered.news) {
      expect(new Date(item.asOf).getTime()).toBeLessThanOrEqual(new Date(mid2023Cutoff).getTime());
    }
  });
});
