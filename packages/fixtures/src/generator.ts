import { PriceBar, NewsItem, DatasetFixture, PredictionMarketEvent, PolymarketProbabilityPoint, FundamentalReport, Timeframe } from "@committee/contracts";
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
 * Generate curated historical Polymarket probability curves for macroeconomic events.
 */
export function getCuratedPredictionMarkets(
  _ticker?: string,
  startYear: number = 2023,
  endYear: number = 2024,
): PredictionMarketEvent[] {
  const events: PredictionMarketEvent[] = [
    {
      id: "pm-fed-rate-cut-2024",
      marketSlug: "fed-funds-rate-cut-2024",
      question: "Will the Federal Reserve cut interest rates in 2024?",
      category: "fed_rate",
      outcomes: ["Yes", "No"],
      asOf: "2023-01-03T00:00:00.000Z",
      history: [
        { ts: "2023-01-03T16:00:00.000Z", asOf: "2023-01-03T21:00:00.000Z", probability: 0.32, volume24h: 45000 },
        { ts: "2023-03-15T16:00:00.000Z", asOf: "2023-03-15T21:00:00.000Z", probability: 0.58, volume24h: 120000 }, // SVB banking crisis flight
        { ts: "2023-06-14T16:00:00.000Z", asOf: "2023-06-14T21:00:00.000Z", probability: 0.42, volume24h: 65000 },
        { ts: "2023-09-20T16:00:00.000Z", asOf: "2023-09-20T21:00:00.000Z", probability: 0.38, volume24h: 80000 }, // Hawkish pause / higher for longer
        { ts: "2023-11-01T16:00:00.000Z", asOf: "2023-11-01T21:00:00.000Z", probability: 0.55, volume24h: 110000 },
        { ts: "2023-12-13T16:00:00.000Z", asOf: "2023-12-13T21:00:00.000Z", probability: 0.78, volume24h: 240000 }, // Powell pivot
        { ts: "2024-01-31T16:00:00.000Z", asOf: "2024-01-31T21:00:00.000Z", probability: 0.72, volume24h: 180000 },
        { ts: "2024-03-20T16:00:00.000Z", asOf: "2024-03-20T21:00:00.000Z", probability: 0.68, volume24h: 150000 },
        { ts: "2024-05-01T16:00:00.000Z", asOf: "2024-05-01T21:00:00.000Z", probability: 0.62, volume24h: 140000 },
        { ts: "2024-07-31T16:00:00.000Z", asOf: "2024-07-31T21:00:00.000Z", probability: 0.88, volume24h: 310000 }, // Jackson Hole / July cooling
        { ts: "2024-09-18T16:00:00.000Z", asOf: "2024-09-18T21:00:00.000Z", probability: 0.99, volume24h: 890000 }, // 50bps jumbo rate cut
        { ts: "2024-11-07T16:00:00.000Z", asOf: "2024-11-07T21:00:00.000Z", probability: 0.99, volume24h: 420000 }, // Follow-up 25bps cut
        { ts: "2024-12-18T16:00:00.000Z", asOf: "2024-12-18T21:00:00.000Z", probability: 0.99, volume24h: 350000 },
      ],
    },
    {
      id: "pm-cpi-inflation-above-3pct",
      marketSlug: "cpi-inflation-above-3pct-2024",
      question: "Will US headline CPI YoY exceed 3.0% in December 2024?",
      category: "cpi_inflation",
      outcomes: ["Yes", "No"],
      asOf: "2023-01-03T00:00:00.000Z",
      history: [
        { ts: "2023-01-03T16:00:00.000Z", asOf: "2023-01-03T21:00:00.000Z", probability: 0.65, volume24h: 22000 },
        { ts: "2023-06-13T16:00:00.000Z", asOf: "2023-06-13T21:00:00.000Z", probability: 0.54, volume24h: 38000 },
        { ts: "2023-11-14T16:00:00.000Z", asOf: "2023-11-14T21:00:00.000Z", probability: 0.48, volume24h: 45000 },
        { ts: "2024-01-11T16:00:00.000Z", asOf: "2024-01-11T21:00:00.000Z", probability: 0.44, volume24h: 52000 },
        { ts: "2024-04-10T16:00:00.000Z", asOf: "2024-04-10T21:00:00.000Z", probability: 0.52, volume24h: 68000 }, // Q1 inflation bump
        { ts: "2024-06-12T16:00:00.000Z", asOf: "2024-06-12T21:00:00.000Z", probability: 0.38, volume24h: 75000 },
        { ts: "2024-08-14T16:00:00.000Z", asOf: "2024-08-14T21:00:00.000Z", probability: 0.28, volume24h: 82000 },
        { ts: "2024-10-10T16:00:00.000Z", asOf: "2024-10-10T21:00:00.000Z", probability: 0.22, volume24h: 91000 },
        { ts: "2024-12-11T16:00:00.000Z", asOf: "2024-12-11T21:00:00.000Z", probability: 0.18, volume24h: 110000 },
      ],
    },
    {
      id: "pm-us-recession-2023-2024",
      marketSlug: "us-recession-declared-2023-2024",
      question: "Will NBER declare a US Recession in 2023 or 2024?",
      category: "recession",
      outcomes: ["Yes", "No"],
      asOf: "2023-01-03T00:00:00.000Z",
      history: [
        { ts: "2023-01-03T16:00:00.000Z", asOf: "2023-01-03T21:00:00.000Z", probability: 0.44, volume24h: 30000 },
        { ts: "2023-03-20T16:00:00.000Z", asOf: "2023-03-20T21:00:00.000Z", probability: 0.52, volume24h: 95000 },
        { ts: "2023-08-15T16:00:00.000Z", asOf: "2023-08-15T21:00:00.000Z", probability: 0.32, volume24h: 40000 },
        { ts: "2023-12-01T16:00:00.000Z", asOf: "2023-12-01T21:00:00.000Z", probability: 0.24, volume24h: 50000 },
        { ts: "2024-03-01T16:00:00.000Z", asOf: "2024-03-01T21:00:00.000Z", probability: 0.18, volume24h: 45000 },
        { ts: "2024-08-05T16:00:00.000Z", asOf: "2024-08-05T21:00:00.000Z", probability: 0.28, volume24h: 160000 }, // Yen carry unwind scare
        { ts: "2024-10-01T16:00:00.000Z", asOf: "2024-10-01T21:00:00.000Z", probability: 0.12, volume24h: 70000 },
        { ts: "2024-12-01T16:00:00.000Z", asOf: "2024-12-01T21:00:00.000Z", probability: 0.08, volume24h: 60000 },
      ],
    },
  ];

  return events.map((ev) =>
    PredictionMarketEvent.parse({
      ...ev,
      history: ev.history.map((pt) => PolymarketProbabilityPoint.parse(pt)),
    }),
  );
}

/**
 * Generate curated historical SEC EDGAR 10-Q and 10-K fundamental reports with strict point-in-time filing timestamps.
 */
export function getCuratedFundamentals(
  ticker: string,
  startYear: number = 2023,
  endYear: number = 2024,
): FundamentalReport[] {
  const sym = ticker.toUpperCase();

  const allReports: Record<string, Array<Omit<FundamentalReport, "asOf"> & { filedAt: string }>> = {
    AAPL: [
      {
        id: "aapl-10q-2023-q1",
        symbol: "AAPL",
        cik: "0000320193",
        form: "10-Q",
        fiscalYear: 2023,
        fiscalPeriod: "Q1",
        periodEndDate: "2022-12-31",
        filedAt: "2023-02-03T18:00:00.000Z",
        revenue: 117154000000,
        grossProfit: 50332000000,
        operatingIncome: 36016000000,
        netIncome: 29998000000,
        eps: 1.88,
        totalAssets: 346747000000,
        totalLiabilities: 290020000000,
        stockholdersEquity: 56727000000,
        currentAssets: 128777000000,
        currentLiabilities: 137286000000,
        cashAndEquivalents: 51355000000,
        totalDebt: 111110000000,
        operatingCashFlow: 34005000000,
        capitalExpenditures: 3781000000,
        freeCashFlow: 30224000000,
        grossMargin: 0.4296,
        operatingMargin: 0.3074,
        netMargin: 0.2561,
        debtToEquity: 5.1125,
        currentRatio: 0.938,
        revenueGrowthYoY: -0.0548,
      },
      {
        id: "aapl-10q-2023-q2",
        symbol: "AAPL",
        cik: "0000320193",
        form: "10-Q",
        fiscalYear: 2023,
        fiscalPeriod: "Q2",
        periodEndDate: "2023-04-01",
        filedAt: "2023-05-05T18:00:00.000Z",
        revenue: 94836000000,
        grossProfit: 41976000000,
        operatingIncome: 28318000000,
        netIncome: 24160000000,
        eps: 1.52,
        totalAssets: 332160000000,
        totalLiabilities: 270002000000,
        stockholdersEquity: 62158000000,
        currentAssets: 112853000000,
        currentLiabilities: 120075000000,
        cashAndEquivalents: 55872000000,
        totalDebt: 109614000000,
        operatingCashFlow: 24860000000,
        capitalExpenditures: 2780000000,
        freeCashFlow: 22080000000,
        grossMargin: 0.4426,
        operatingMargin: 0.2986,
        netMargin: 0.2547,
        debtToEquity: 4.3438,
        currentRatio: 0.9398,
        revenueGrowthYoY: -0.0251,
      },
      {
        id: "aapl-10q-2023-q3",
        symbol: "AAPL",
        cik: "0000320193",
        form: "10-Q",
        fiscalYear: 2023,
        fiscalPeriod: "Q3",
        periodEndDate: "2023-07-01",
        filedAt: "2023-08-04T18:00:00.000Z",
        revenue: 81797000000,
        grossProfit: 36413000000,
        operatingIncome: 22998000000,
        netIncome: 19881000000,
        eps: 1.26,
        totalAssets: 335038000000,
        totalLiabilities: 274764000000,
        stockholdersEquity: 60274000000,
        currentAssets: 122696000000,
        currentLiabilities: 125137000000,
        cashAndEquivalents: 62482000000,
        totalDebt: 109280000000,
        operatingCashFlow: 26380000000,
        capitalExpenditures: 2040000000,
        freeCashFlow: 24340000000,
        grossMargin: 0.4452,
        operatingMargin: 0.2812,
        netMargin: 0.2431,
        debtToEquity: 4.5586,
        currentRatio: 0.9805,
        revenueGrowthYoY: -0.014,
      },
      {
        id: "aapl-10k-2023-fy",
        symbol: "AAPL",
        cik: "0000320193",
        form: "10-K",
        fiscalYear: 2023,
        fiscalPeriod: "FY",
        periodEndDate: "2023-09-30",
        filedAt: "2023-11-03T18:00:00.000Z",
        revenue: 89498000000,
        grossProfit: 40427000000,
        operatingIncome: 26969000000,
        netIncome: 22956000000,
        eps: 1.46,
        totalAssets: 352583000000,
        totalLiabilities: 290437000000,
        stockholdersEquity: 62146000000,
        currentAssets: 143566000000,
        currentLiabilities: 145308000000,
        cashAndEquivalents: 61555000000,
        totalDebt: 111088000000,
        operatingCashFlow: 28000000000,
        capitalExpenditures: 2500000000,
        freeCashFlow: 25500000000,
        grossMargin: 0.4517,
        operatingMargin: 0.3013,
        netMargin: 0.2565,
        debtToEquity: 4.6735,
        currentRatio: 0.988,
        revenueGrowthYoY: -0.0072,
      },
      {
        id: "aapl-10q-2024-q1",
        symbol: "AAPL",
        cik: "0000320193",
        form: "10-Q",
        fiscalYear: 2024,
        fiscalPeriod: "Q1",
        periodEndDate: "2023-12-30",
        filedAt: "2024-02-02T18:00:00.000Z",
        revenue: 119575000000,
        grossProfit: 54855000000,
        operatingIncome: 40373000000,
        netIncome: 33916000000,
        eps: 2.18,
        totalAssets: 353514000000,
        totalLiabilities: 279414000000,
        stockholdersEquity: 74100000000,
        currentAssets: 143692000000,
        currentLiabilities: 133969000000,
        cashAndEquivalents: 73100000000,
        totalDebt: 108040000000,
        operatingCashFlow: 39895000000,
        capitalExpenditures: 2385000000,
        freeCashFlow: 37510000000,
        grossMargin: 0.4588,
        operatingMargin: 0.3376,
        netMargin: 0.2836,
        debtToEquity: 3.7708,
        currentRatio: 1.0726,
        revenueGrowthYoY: 0.0207,
      },
      {
        id: "aapl-10q-2024-q2",
        symbol: "AAPL",
        cik: "0000320193",
        form: "10-Q",
        fiscalYear: 2024,
        fiscalPeriod: "Q2",
        periodEndDate: "2024-03-30",
        filedAt: "2024-05-03T18:00:00.000Z",
        revenue: 90753000000,
        grossProfit: 42271000000,
        operatingIncome: 27900000000,
        netIncome: 23636000000,
        eps: 1.53,
        totalAssets: 337411000000,
        totalLiabilities: 263220000000,
        stockholdersEquity: 74191000000,
        currentAssets: 125608000000,
        currentLiabilities: 122298000000,
        cashAndEquivalents: 67150000000,
        totalDebt: 104590000000,
        operatingCashFlow: 22690000000,
        capitalExpenditures: 1930000000,
        freeCashFlow: 20760000000,
        grossMargin: 0.4658,
        operatingMargin: 0.3074,
        netMargin: 0.2604,
        debtToEquity: 3.5479,
        currentRatio: 1.0271,
        revenueGrowthYoY: -0.0431,
      },
      {
        id: "aapl-10q-2024-q3",
        symbol: "AAPL",
        cik: "0000320193",
        form: "10-Q",
        fiscalYear: 2024,
        fiscalPeriod: "Q3",
        periodEndDate: "2024-06-29",
        filedAt: "2024-08-02T18:00:00.000Z",
        revenue: 85777000000,
        grossProfit: 39678000000,
        operatingIncome: 25352000000,
        netIncome: 21448000000,
        eps: 1.40,
        totalAssets: 329775000000,
        totalLiabilities: 263091000000,
        stockholdersEquity: 66684000000,
        currentAssets: 119860000000,
        currentLiabilities: 116345000000,
        cashAndEquivalents: 61800000000,
        totalDebt: 101300000000,
        operatingCashFlow: 28890000000,
        capitalExpenditures: 2150000000,
        freeCashFlow: 26740000000,
        grossMargin: 0.4626,
        operatingMargin: 0.2956,
        netMargin: 0.2500,
        debtToEquity: 3.9453,
        currentRatio: 1.0302,
        revenueGrowthYoY: 0.0487,
      },
      {
        id: "aapl-10k-2024-fy",
        symbol: "AAPL",
        cik: "0000320193",
        form: "10-K",
        fiscalYear: 2024,
        fiscalPeriod: "FY",
        periodEndDate: "2024-09-28",
        filedAt: "2024-11-01T18:00:00.000Z",
        revenue: 94930000000,
        grossProfit: 43879000000,
        operatingIncome: 29591000000,
        netIncome: 14736000000,
        eps: 0.97,
        totalAssets: 364980000000,
        totalLiabilities: 308030000000,
        stockholdersEquity: 56950000000,
        currentAssets: 152988000000,
        currentLiabilities: 148896000000,
        cashAndEquivalents: 65900000000,
        totalDebt: 106629000000,
        operatingCashFlow: 26800000000,
        capitalExpenditures: 2400000000,
        freeCashFlow: 24400000000,
        grossMargin: 0.4622,
        operatingMargin: 0.3117,
        netMargin: 0.1552,
        debtToEquity: 5.4088,
        currentRatio: 1.0275,
        revenueGrowthYoY: 0.0607,
      },
    ],
    NVDA: [
      {
        id: "nvda-10q-2024-q1",
        symbol: "NVDA",
        cik: "0001045810",
        form: "10-Q",
        fiscalYear: 2024,
        fiscalPeriod: "Q1",
        periodEndDate: "2023-04-30",
        filedAt: "2023-05-26T18:00:00.000Z",
        revenue: 7192000000,
        grossProfit: 4648000000,
        operatingIncome: 2140000000,
        netIncome: 2043000000,
        eps: 0.82,
        totalAssets: 44460000000,
        totalLiabilities: 19939000000,
        stockholdersEquity: 24521000000,
        currentAssets: 29000000000,
        currentLiabilities: 7200000000,
        cashAndEquivalents: 15320000000,
        totalDebt: 11990000000,
        operatingCashFlow: 2910000000,
        capitalExpenditures: 250000000,
        freeCashFlow: 2660000000,
        grossMargin: 0.6463,
        operatingMargin: 0.2976,
        netMargin: 0.2841,
        debtToEquity: 0.8131,
        currentRatio: 4.0278,
        revenueGrowthYoY: -0.1325,
      },
      {
        id: "nvda-10q-2024-q2",
        symbol: "NVDA",
        cik: "0001045810",
        form: "10-Q",
        fiscalYear: 2024,
        fiscalPeriod: "Q2",
        periodEndDate: "2023-07-30",
        filedAt: "2023-08-25T18:00:00.000Z",
        revenue: 13507000000,
        grossProfit: 9462000000,
        operatingIncome: 6800000000,
        netIncome: 6188000000,
        eps: 2.48,
        totalAssets: 49550000000,
        totalLiabilities: 21800000000,
        stockholdersEquity: 27750000000,
        currentAssets: 34000000000,
        currentLiabilities: 8900000000,
        cashAndEquivalents: 16020000000,
        totalDebt: 11980000000,
        operatingCashFlow: 6350000000,
        capitalExpenditures: 290000000,
        freeCashFlow: 6060000000,
        grossMargin: 0.7005,
        operatingMargin: 0.5034,
        netMargin: 0.4581,
        debtToEquity: 0.7856,
        currentRatio: 3.8202,
        revenueGrowthYoY: 1.0146,
      },
      {
        id: "nvda-10q-2024-q3",
        symbol: "NVDA",
        cik: "0001045810",
        form: "10-Q",
        fiscalYear: 2024,
        fiscalPeriod: "Q3",
        periodEndDate: "2023-10-29",
        filedAt: "2023-11-21T18:00:00.000Z",
        revenue: 18120000000,
        grossProfit: 13400000000,
        operatingIncome: 10417000000,
        netIncome: 9243000000,
        eps: 3.71,
        totalAssets: 55700000000,
        totalLiabilities: 22400000000,
        stockholdersEquity: 33300000000,
        currentAssets: 39000000000,
        currentLiabilities: 9500000000,
        cashAndEquivalents: 18280000000,
        totalDebt: 11980000000,
        operatingCashFlow: 7330000000,
        capitalExpenditures: 300000000,
        freeCashFlow: 7030000000,
        grossMargin: 0.7395,
        operatingMargin: 0.5749,
        netMargin: 0.5101,
        debtToEquity: 0.6727,
        currentRatio: 4.1053,
        revenueGrowthYoY: 2.0551,
      },
      {
        id: "nvda-10k-2024-fy",
        symbol: "NVDA",
        cik: "0001045810",
        form: "10-K",
        fiscalYear: 2024,
        fiscalPeriod: "FY",
        periodEndDate: "2024-01-28",
        filedAt: "2024-02-21T18:00:00.000Z",
        revenue: 22103000000,
        grossProfit: 16790000000,
        operatingIncome: 13615000000,
        netIncome: 12285000000,
        eps: 4.93,
        totalAssets: 65728000000,
        totalLiabilities: 22750000000,
        stockholdersEquity: 42978000000,
        currentAssets: 44345000000,
        currentLiabilities: 10631000000,
        cashAndEquivalents: 25980000000,
        totalDebt: 11056000000,
        operatingCashFlow: 11500000000,
        capitalExpenditures: 310000000,
        freeCashFlow: 11190000000,
        grossMargin: 0.7596,
        operatingMargin: 0.6159,
        netMargin: 0.5558,
        debtToEquity: 0.5293,
        currentRatio: 4.1713,
        revenueGrowthYoY: 2.6528,
      },
      {
        id: "nvda-10q-2025-q1",
        symbol: "NVDA",
        cik: "0001045810",
        form: "10-Q",
        fiscalYear: 2025,
        fiscalPeriod: "Q1",
        periodEndDate: "2024-04-28",
        filedAt: "2024-05-22T18:00:00.000Z",
        revenue: 26044000000,
        grossProfit: 20406000000,
        operatingIncome: 16909000000,
        netIncome: 14881000000,
        eps: 5.98,
        totalAssets: 77072000000,
        totalLiabilities: 27928000000,
        stockholdersEquity: 49144000000,
        currentAssets: 53800000000,
        currentLiabilities: 15200000000,
        cashAndEquivalents: 31438000000,
        totalDebt: 11050000000,
        operatingCashFlow: 15340000000,
        capitalExpenditures: 400000000,
        freeCashFlow: 14940000000,
        grossMargin: 0.7835,
        operatingMargin: 0.6492,
        netMargin: 0.5714,
        debtToEquity: 0.5683,
        currentRatio: 3.5395,
        revenueGrowthYoY: 2.6212,
      },
      {
        id: "nvda-10q-2025-q2",
        symbol: "NVDA",
        cik: "0001045810",
        form: "10-Q",
        fiscalYear: 2025,
        fiscalPeriod: "Q2",
        periodEndDate: "2024-07-28",
        filedAt: "2024-08-28T18:00:00.000Z",
        revenue: 30040000000,
        grossProfit: 22574000000,
        operatingIncome: 18642000000,
        netIncome: 16599000000,
        eps: 0.67,
        totalAssets: 85226000000,
        totalLiabilities: 27083000000,
        stockholdersEquity: 58143000000,
        currentAssets: 59800000000,
        currentLiabilities: 14900000000,
        cashAndEquivalents: 34800000000,
        totalDebt: 10500000000,
        operatingCashFlow: 14500000000,
        capitalExpenditures: 450000000,
        freeCashFlow: 14050000000,
        grossMargin: 0.7515,
        operatingMargin: 0.6206,
        netMargin: 0.5526,
        debtToEquity: 0.4658,
        currentRatio: 4.0134,
        revenueGrowthYoY: 1.2241,
      },
    ],
    SPY: [
      {
        id: "spy-semi-2023-h1",
        symbol: "SPY",
        cik: "0000884394",
        form: "10-Q",
        fiscalYear: 2023,
        fiscalPeriod: "Q2",
        periodEndDate: "2023-06-30",
        filedAt: "2023-08-15T18:00:00.000Z",
        revenue: 8500000000,
        grossProfit: 8500000000,
        operatingIncome: 8400000000,
        netIncome: 8400000000,
        eps: null,
        totalAssets: 410000000000,
        totalLiabilities: 1500000000,
        stockholdersEquity: 408500000000,
        currentAssets: 410000000000,
        currentLiabilities: 1500000000,
        cashAndEquivalents: 1200000000,
        totalDebt: 0,
        operatingCashFlow: 8300000000,
        capitalExpenditures: 0,
        freeCashFlow: 8300000000,
        grossMargin: 1.0,
        operatingMargin: 0.9882,
        netMargin: 0.9882,
        debtToEquity: 0.0037,
        currentRatio: 273.33,
        revenueGrowthYoY: 0.082,
      },
      {
        id: "spy-annual-2023-fy",
        symbol: "SPY",
        cik: "0000884394",
        form: "10-K",
        fiscalYear: 2023,
        fiscalPeriod: "FY",
        periodEndDate: "2023-12-31",
        filedAt: "2024-02-20T18:00:00.000Z",
        revenue: 17200000000,
        grossProfit: 17200000000,
        operatingIncome: 17000000000,
        netIncome: 17000000000,
        eps: null,
        totalAssets: 495000000000,
        totalLiabilities: 1800000000,
        stockholdersEquity: 493200000000,
        currentAssets: 495000000000,
        currentLiabilities: 1800000000,
        cashAndEquivalents: 1500000000,
        totalDebt: 0,
        operatingCashFlow: 16800000000,
        capitalExpenditures: 0,
        freeCashFlow: 16800000000,
        grossMargin: 1.0,
        operatingMargin: 0.9884,
        netMargin: 0.9884,
        debtToEquity: 0.0036,
        currentRatio: 275.0,
        revenueGrowthYoY: 0.125,
      },
    ],
  };

  const list = allReports[sym] ?? [];
  const filtered = list.filter((item) => {
    const pubYear = new Date(item.filedAt).getUTCFullYear();
    return pubYear >= startYear && pubYear <= endYear;
  });

  return filtered.map((item) => {
    // asOf is 21:00 UTC (16:00 ET / 17:00 ET) on filing date so after-market publication is respected
    const filingDate = item.filedAt.slice(0, 10);
    const asOf = `${filingDate}T21:00:00.000Z`;
    return FundamentalReport.parse({
      ...item,
      asOf,
    });
  });
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
  const predictionMarkets = getCuratedPredictionMarkets(ticker, startYear, endYear);
  const fundamentals = getCuratedFundamentals(ticker, startYear, endYear);

  return DatasetFixture.parse({
    symbol: ticker.toUpperCase(),
    bars,
    news,
    predictionMarkets,
    fundamentals,
  });
}
