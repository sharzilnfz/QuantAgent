import { PriceBar, NewsItem, DatasetFixture, Timeframe } from "@committee/contracts";
import { computeDailyBarAsOf, computeNewsAsOf } from "./as-of.js";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: { symbol?: string };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: unknown;
  };
}

/**
 * Fetch daily bars from Yahoo Finance public chart API (zero-credential).
 */
export async function fetchPublicDailyBars(
  ticker: string,
  startYear: number = 2023,
  endYear: number = 2024,
): Promise<PriceBar[]> {
  const period1 = Math.floor(new Date(`${startYear}-01-01T00:00:00Z`).getTime() / 1000);
  const period2 = Math.floor(new Date(`${endYear}-12-31T23:59:59Z`).getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker.toUpperCase(),
  )}?period1=${period1}&period2=${period2}&interval=1d`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance request failed with HTTP ${res.status}`);
    }

    const data = (await res.json()) as YahooChartResponse;
    const result = data.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      throw new Error(`No chart data returned for ${ticker}`);
    }

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const bars: PriceBar[] = [];

    for (let i = 0; i < timestamps.length; i += 1) {
      const tsSec = timestamps[i];
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const volume = quote.volume?.[i];

      if (
        tsSec === undefined ||
        open == null ||
        high == null ||
        low == null ||
        close == null ||
        volume == null ||
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close) ||
        !Number.isFinite(volume)
      ) {
        continue;
      }

      // Bar ts is 09:30 ET / 14:30 UTC or session start
      const d = new Date(tsSec * 1000);
      const isoTs = d.toISOString();
      const asOf = computeDailyBarAsOf(d);

      bars.push(
        PriceBar.parse({
          symbol: ticker.toUpperCase(),
          timeframe: "1Day",
          ts: isoTs,
          open: Number(open.toFixed(4)),
          high: Number(high.toFixed(4)),
          low: Number(low.toFixed(4)),
          close: Number(close.toFixed(4)),
          volume: Math.round(volume),
          asOf,
        }),
      );
    }

    return bars;
  } catch (err) {
    console.warn(`[generator] Could not fetch public bars from Yahoo: ${String(err)}. Falling back to synthetic generator.`);
    return generateSyntheticBars(ticker, startYear, endYear);
  }
}

/**
 * Generate deterministic daily bars when offline.
 */
export function generateSyntheticBars(
  ticker: string,
  startYear: number = 2023,
  endYear: number = 2024,
): PriceBar[] {
  const bars: PriceBar[] = [];
  const start = new Date(Date.UTC(startYear, 0, 1));
  const end = new Date(Date.UTC(endYear, 11, 31));

  let price = ticker === "NVDA" ? 145 : ticker === "AAPL" ? 130 : 385;
  const current = new Date(start);

  while (current <= end) {
    const day = current.getUTCDay();
    // Weekdays only
    if (day !== 0 && day !== 6) {
      // 09:30 ET is 14:30 or 13:30 UTC
      const barTs = new Date(
        Date.UTC(
          current.getUTCFullYear(),
          current.getUTCMonth(),
          current.getUTCDate(),
          14,
          30,
          0,
          0,
        ),
      );

      const changePct = ((Math.sin(bars.length * 0.1) * 0.02) + (Math.cos(bars.length * 0.05) * 0.015));
      const open = price;
      const close = price * (1 + changePct);
      const high = Math.max(open, close) * 1.01;
      const low = Math.min(open, close) * 0.99;
      const volume = Math.floor(50000000 + Math.abs(Math.sin(bars.length)) * 20000000);
      price = close;

      const asOf = computeDailyBarAsOf(barTs);

      bars.push(
        PriceBar.parse({
          symbol: ticker.toUpperCase(),
          timeframe: "1Day",
          ts: barTs.toISOString(),
          open: Number(open.toFixed(4)),
          high: Number(high.toFixed(4)),
          low: Number(low.toFixed(4)),
          close: Number(close.toFixed(4)),
          volume,
          asOf,
        }),
      );
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return bars;
}

/**
 * Curated key financial news headlines for 2023-2024 for AAPL, NVDA, SPY.
 */
export function getCuratedNews(ticker: string, startYear: number = 2023, endYear: number = 2024): NewsItem[] {
  const sym = ticker.toUpperCase();
  const allNews: Array<{
    id: string;
    headline: string;
    summary: string;
    source: string;
    symbols: string[];
    publishedAt: string;
  }> = [
    // 2023 News
    {
      id: "news-2023-02-01-fomc",
      headline: "Fed raises interest rates by 25 basis points, signals ongoing increases",
      summary: "The Federal Reserve raised its benchmark interest rate by a quarter percentage point and noted inflation remains elevated.",
      source: "benzinga",
      symbols: ["SPY", "AAPL", "NVDA"],
      publishedAt: "2023-02-01T19:00:00Z",
    },
    {
      id: "news-2023-02-02-aapl-q1",
      headline: "Apple reports Q1 FY23 revenue of $117.2 billion, down 5% year-over-year",
      summary: "Apple faced foreign exchange headwinds and supply constraints on iPhone 14 Pro during the holiday quarter.",
      source: "benzinga",
      symbols: ["AAPL"],
      publishedAt: "2023-02-02T21:30:00Z",
    },
    {
      id: "news-2023-02-22-nvda-q4",
      headline: "Nvidia announces strong AI chip demand in Q4 earnings, CEO says AI at inflection point",
      summary: "Jensen Huang highlights generative AI computing needs driving demand for Hopper and Ampere architecture GPUs.",
      source: "benzinga",
      symbols: ["NVDA"],
      publishedAt: "2023-02-22T21:20:00Z",
    },
    {
      id: "news-2023-05-04-aapl-q2",
      headline: "Apple reports Q2 results with record iPhone revenue and services growth",
      summary: "Apple beats Wall Street estimates driven by emerging markets strength and iPhone 14 momentum.",
      source: "benzinga",
      symbols: ["AAPL"],
      publishedAt: "2023-05-04T20:30:00Z",
    },
    {
      id: "news-2023-05-24-nvda-guidance",
      headline: "Nvidia shocks Wall Street with unprecedented $11B revenue guidance on AI boom",
      summary: "Nvidia shares skyrocket 25% after hours on historic demand for datacenter AI hardware.",
      source: "benzinga",
      symbols: ["NVDA", "SPY"],
      publishedAt: "2023-05-24T20:45:00Z",
    },
    {
      id: "news-2023-06-05-aapl-visionpro",
      headline: "Apple unveils Vision Pro spatial computer at WWDC23",
      summary: "Apple enters spatial computing category with high-resolution micro-OLED headset priced at $3,499.",
      source: "benzinga",
      symbols: ["AAPL"],
      publishedAt: "2023-06-05T18:00:00Z",
    },
    {
      id: "news-2023-08-23-nvda-q2",
      headline: "Nvidia Q2 revenue doubles to $13.51B as Data Center sales surge 171%",
      summary: "AI mega-trend fuels massive profit expansion across enterprise and cloud providers.",
      source: "benzinga",
      symbols: ["NVDA", "SPY"],
      publishedAt: "2023-08-23T20:30:00Z",
    },
    {
      id: "news-2023-09-12-aapl-iphone15",
      headline: "Apple launches iPhone 15 Pro with titanium frame and 3nm A17 Pro chip",
      summary: "New premium iPhones feature USB-C connectivity, lighter design, and enhanced camera zoom.",
      source: "benzinga",
      symbols: ["AAPL"],
      publishedAt: "2023-09-12T18:30:00Z",
    },
    {
      id: "news-2023-11-21-nvda-q3",
      headline: "Nvidia Q3 revenue triples to $18.12 billion, beats all expectations",
      summary: "Demand for HGX systems remains robust while company navigates updated US export restrictions.",
      source: "benzinga",
      symbols: ["NVDA"],
      publishedAt: "2023-11-21T21:20:00Z",
    },
    {
      id: "news-2023-12-13-fed-pivot",
      headline: "Fed holds rates steady, dot plot projects three rate cuts in 2024",
      summary: "Chairman Jerome Powell indicates monetary policy easing is coming into view as inflation moderates.",
      source: "benzinga",
      symbols: ["SPY", "AAPL", "NVDA"],
      publishedAt: "2023-12-13T19:30:00Z",
    },
    // 2024 News
    {
      id: "news-2024-02-01-aapl-q1",
      headline: "Apple returns to revenue growth in Q1 FY24 with $119.6B, Vision Pro launches",
      summary: "iPhone sales rise 6% while China revenue softens amid competitive domestic offerings.",
      source: "benzinga",
      symbols: ["AAPL"],
      publishedAt: "2024-02-01T21:30:00Z",
    },
    {
      id: "news-2024-02-21-nvda-q4",
      headline: "Nvidia posts 265% revenue surge in Q4, cementing market cap leadership",
      summary: "Datacenter revenue reaches $18.4B in single quarter as global AI infrastructure spending accelerates.",
      source: "benzinga",
      symbols: ["NVDA", "SPY"],
      publishedAt: "2024-02-21T21:30:00Z",
    },
    {
      id: "news-2024-03-18-nvda-blackwell",
      headline: "Nvidia introduces Blackwell B200 GPU, claiming 30x inference speedup",
      summary: "GTC 2024 keynote showcases next-generation architecture featuring 208 billion transistors.",
      source: "benzinga",
      symbols: ["NVDA"],
      publishedAt: "2024-03-18T18:00:00Z",
    },
    {
      id: "news-2024-05-02-aapl-buyback",
      headline: "Apple authorizes historic $110 billion share buyback program, raises dividend",
      summary: "Largest share repurchase authorization in corporate history announced alongside Q2 results.",
      source: "benzinga",
      symbols: ["AAPL", "SPY"],
      publishedAt: "2024-05-02T20:30:00Z",
    },
    {
      id: "news-2024-05-22-nvda-split",
      headline: "Nvidia announces 10-for-1 stock split and 150% dividend increase on record Q1 results",
      summary: "Quarterly revenue hits $26.0B as Blackwell platform enters full production.",
      source: "benzinga",
      symbols: ["NVDA", "SPY"],
      publishedAt: "2024-05-22T20:20:00Z",
    },
    {
      id: "news-2024-06-10-aapl-intelligence",
      headline: "Apple announces 'Apple Intelligence' personal AI system integrated across iOS 18 and macOS",
      summary: "Partnership with OpenAI integrates ChatGPT alongside privacy-focused on-device foundation models.",
      source: "benzinga",
      symbols: ["AAPL"],
      publishedAt: "2024-06-10T18:30:00Z",
    },
    {
      id: "news-2024-08-28-nvda-q2",
      headline: "Nvidia Q2 revenue jumps 122% to $30.04B, approves additional $50B share buyback",
      summary: "CEO confirms Blackwell sample shipments to partners with production ramp on track.",
      source: "benzinga",
      symbols: ["NVDA"],
      publishedAt: "2024-08-28T20:30:00Z",
    },
    {
      id: "news-2024-09-18-fed-jumbo",
      headline: "Federal Reserve cuts interest rates by 50 basis points, beginning easing cycle",
      summary: "Fed makes aggressive first rate cut in four years, recalibrating policy toward labor market preservation.",
      source: "benzinga",
      symbols: ["SPY", "AAPL", "NVDA"],
      publishedAt: "2024-09-18T18:00:00Z",
    },
    {
      id: "news-2024-10-31-aapl-q4",
      headline: "Apple reports Q4 revenue of $94.9B, up 6% YoY, driven by iPhone 16 demand",
      summary: "Services revenue sets new all-time record of $25.0B as active device installed base expands.",
      source: "benzinga",
      symbols: ["AAPL"],
      publishedAt: "2024-10-31T20:30:00Z",
    },
    {
      id: "news-2024-11-20-nvda-q3",
      headline: "Nvidia Q3 revenue hits $35.08B, beating consensus estimates",
      summary: "Blackwell chip delivers full operational readiness with cloud hyperscalers booking entire pipeline.",
      source: "benzinga",
      symbols: ["NVDA", "SPY"],
      publishedAt: "2024-11-20T21:30:00Z",
    },
  ];

  const filtered = allNews.filter((item) => {
    const pubYear = new Date(item.publishedAt).getUTCFullYear();
    const hasSymbol = item.symbols.includes(sym);
    return hasSymbol && pubYear >= startYear && pubYear <= endYear;
  });

  return filtered.map((item) =>
    NewsItem.parse({
      ...item,
      asOf: computeNewsAsOf(item.publishedAt),
    }),
  );
}

/**
 * Generate a complete DatasetFixture for a symbol.
 */
export async function generateDatasetFixture(
  ticker: string,
  startYear: number = 2023,
  endYear: number = 2024,
): Promise<DatasetFixture> {
  const bars = await fetchPublicDailyBars(ticker, startYear, endYear);
  const news = getCuratedNews(ticker, startYear, endYear);

  return DatasetFixture.parse({
    symbol: ticker.toUpperCase(),
    bars,
    news,
  });
}
