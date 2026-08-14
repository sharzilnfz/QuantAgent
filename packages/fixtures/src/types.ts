import type { PriceBar, NewsItem, DatasetFixture } from "@committee/contracts";

export type { PriceBar, NewsItem, DatasetFixture };

export interface SeedOptions {
  ticker: string;
  year?: number;
  from?: string;
  to?: string;
  outputPath?: string;
}

export interface FixtureLoaderOptions {
  fixturesDir?: string;
}
