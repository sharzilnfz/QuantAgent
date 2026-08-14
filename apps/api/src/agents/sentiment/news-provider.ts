import type { NewsItem } from "@committee/contracts";
import { TemporalGuard, loadNews } from "@committee/fixtures";

export interface NewsQuery {
  symbol: string;
  decisionTs: string;
  limit?: number;
}

export interface NewsProvider {
  getNews(query: NewsQuery): Promise<NewsItem[]>;
}

/**
 * In-memory news provider backed by a static array of news items.
 * Enforces point-in-time filtering via TemporalGuard.
 */
export class InMemoryNewsProvider implements NewsProvider {
  private readonly items: NewsItem[];

  constructor(items: readonly NewsItem[] = []) {
    this.items = [...items];
  }

  async getNews(query: NewsQuery): Promise<NewsItem[]> {
    const symbolUpper = query.symbol.toUpperCase();
    const matching = this.items.filter((item) =>
      item.symbols.some((s) => s.toUpperCase() === symbolUpper),
    );

    const pitItems = TemporalGuard.filter(matching, query.decisionTs);

    // Sort descending by point-in-time publication/asOf
    pitItems.sort((a, b) => Date.parse(b.asOf) - Date.parse(a.asOf));

    if (query.limit !== undefined && query.limit > 0) {
      return pitItems.slice(0, query.limit);
    }
    return pitItems;
  }
}

/**
 * Fixture news provider that reads frozen dataset fixtures on disk offline ($0 cost).
 * Enforces point-in-time filtering via TemporalGuard.
 */
export class FixtureNewsProvider implements NewsProvider {
  constructor(private readonly fixturesDir?: string) {}

  async getNews(query: NewsQuery): Promise<NewsItem[]> {
    try {
      const allNews = loadNews(query.symbol, {
        fixturesDir: this.fixturesDir,
      });

      const pitItems = TemporalGuard.filter(allNews, query.decisionTs);
      pitItems.sort((a, b) => Date.parse(b.asOf) - Date.parse(a.asOf));

      if (query.limit !== undefined && query.limit > 0) {
        return pitItems.slice(0, query.limit);
      }
      return pitItems;
    } catch {
      // If fixture does not exist or fails to load, return empty news list safely
      return [];
    }
  }
}

/**
 * Resolve the default news provider for sentiment analysis.
 * Defaults to FixtureNewsProvider for deterministic offline execution.
 */
export function resolveDefaultNewsProvider(): NewsProvider {
  return new FixtureNewsProvider();
}
