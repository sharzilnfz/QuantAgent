import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { DatasetFixture, type PriceBar, type NewsItem, type PredictionMarketEvent, type FundamentalReport } from "@committee/contracts";
import type { FixtureLoaderOptions } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default directory for pre-packaged JSON fixtures
const DEFAULT_FIXTURES_DIR = path.resolve(__dirname, "../data");

/**
 * Resolve the fixture file path for a given ticker symbol.
 */
export function getFixturePath(symbol: string, options?: FixtureLoaderOptions): string {
  const dir = options?.fixturesDir ?? DEFAULT_FIXTURES_DIR;
  return path.join(dir, `${symbol.toUpperCase()}.json`);
}

/**
 * Load and validate a complete dataset fixture for a symbol (offline, zero-credential).
 */
export function loadFixture(symbol: string, options?: FixtureLoaderOptions): DatasetFixture {
  const filePath = getFixturePath(symbol, options);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Fixture for symbol "${symbol.toUpperCase()}" not found at ${filePath}. Ensure packages/fixtures/data/${symbol.toUpperCase()}.json exists.`,
    );
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsedJson = JSON.parse(raw);
  return DatasetFixture.parse(parsedJson);
}

/**
 * Load price bars for a symbol from the frozen dataset fixture.
 */
export function loadPriceBars(symbol: string, options?: FixtureLoaderOptions): PriceBar[] {
  const fixture = loadFixture(symbol, options);
  return fixture.bars;
}

/**
 * Load timestamped news items for a symbol from the frozen dataset fixture.
 */
export function loadNews(symbol: string, options?: FixtureLoaderOptions): NewsItem[] {
  const fixture = loadFixture(symbol, options);
  return fixture.news;
}

/**
 * Load timestamped prediction market events for a symbol from the frozen dataset fixture.
 */
export function loadPredictionMarkets(symbol: string, options?: FixtureLoaderOptions): PredictionMarketEvent[] {
  const fixture = loadFixture(symbol, options);
  return fixture.predictionMarkets ?? [];
}

/**
 * Load timestamped fundamental reports for a symbol from the frozen dataset fixture.
 */
export function loadFundamentals(symbol: string, options?: FixtureLoaderOptions): FundamentalReport[] {
  const fixture = loadFixture(symbol, options);
  return fixture.fundamentals ?? [];
}

/**
 * List all available ticker fixtures in the fixtures directory.
 */
export function listAvailableFixtures(options?: FixtureLoaderOptions): string[] {
  const dir = options?.fixturesDir ?? DEFAULT_FIXTURES_DIR;
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.basename(f, ".json"));
}
