import type { Timeframe } from "@committee/contracts";
import { config } from "../config.js";
import {
  AlpacaHttpError,
  isRetryableStatus,
  parseRetryAfter,
  ResilientHttpClient,
  type ResilientHttpClientOptions,
} from "./resilient-http-client.js";

/**
 * Thin Alpaca market-data client. Node's built-in global `fetch` only — no axios.
 *
 * Responsibilities kept here (transport concerns):
 *   - auth headers, URL building, pagination (`next_page_token`)
 *   - chunking long date ranges so one call can't blow the page budget
 *
 * HTTP resilience (retries, exponential backoff, caching) is delegated to
 * `ResilientHttpClient`.
 *
 * Everything about MEANING (normalization, `as_of`) lives in `prices.ts` /
 * `as-of.ts`. This file must stay dumb about point-in-time semantics.
 */

export { AlpacaHttpError, isRetryableStatus, parseRetryAfter, ResilientHttpClient };

/** Raw bar as Alpaca returns it (v2 market-data API). */
export interface AlpacaRawBar {
  /** RFC-3339 bar OPEN time. */
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  /** trade count */
  n?: number;
  /** volume-weighted average price */
  vw?: number;
}

export interface AlpacaBarsResponse {
  bars?: AlpacaRawBar[] | null;
  symbol?: string;
  next_page_token?: string | null;
}

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<Response>;

export interface AlpacaClientOptions extends ResilientHttpClientOptions {
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  /** Data feed: "iex" is what free/paper keys get. */
  feed?: string;
  /** Hard cap on pages per chunk, so a bad token loop can't run forever. */
  maxPagesPerChunk?: number;
}

/** Pluggable cache seam — a no-op by default; `fs-cache.ts` provides a disk one. */
export interface ResponseCache {
  get(key: string): Promise<AlpacaBarsResponse | null>;
  set(key: string, value: AlpacaBarsResponse): Promise<void>;
}

const DEFAULT_MAX_PAGES = 200;
const PAGE_LIMIT = 10_000;

/** How many days of one timeframe we ask for in a single request window. */
const CHUNK_DAYS: Record<Timeframe, number> = {
  "1Day": 365 * 5,
  "1Hour": 90,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Split [from, to] into request windows. Long backfills are chunked so a single
 * call never has to walk hundreds of pages, and so a mid-range failure only
 * loses one chunk instead of the whole run.
 */
export function chunkRange(from: Date, to: Date, timeframe: Timeframe): Array<{ from: Date; to: Date }> {
  if (!(from.getTime() <= to.getTime())) return [];
  const spanMs = (CHUNK_DAYS[timeframe] ?? 365) * DAY_MS;
  const chunks: Array<{ from: Date; to: Date }> = [];
  let cursor = from.getTime();
  const end = to.getTime();
  while (cursor <= end) {
    const chunkEnd = Math.min(cursor + spanMs, end);
    chunks.push({ from: new Date(cursor), to: new Date(chunkEnd) });
    if (chunkEnd >= end) break;
    cursor = chunkEnd + 1;
  }
  return chunks;
}

export class AlpacaClient {
  private readonly httpClient: ResilientHttpClient;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly feed: string | undefined;
  private readonly maxPagesPerChunk: number;

  constructor(options: AlpacaClientOptions = {}) {
    this.httpClient = new ResilientHttpClient(options);
    this.apiKey = options.apiKey ?? config.ALPACA_KEY;
    this.apiSecret = options.apiSecret ?? config.ALPACA_SECRET;
    this.baseUrl = (options.baseUrl ?? config.ALPACA_DATA_URL).replace(/\/+$/, "");
    this.feed = options.feed;
    this.maxPagesPerChunk = options.maxPagesPerChunk ?? DEFAULT_MAX_PAGES;
  }

  private headers(): Record<string, string> {
    return {
      "APCA-API-KEY-ID": this.apiKey,
      "APCA-API-SECRET-KEY": this.apiSecret,
      accept: "application/json",
    };
  }

  private buildUrl(
    symbol: string,
    timeframe: Timeframe,
    from: Date,
    to: Date,
    pageToken?: string,
  ): string {
    const params = new URLSearchParams({
      timeframe,
      start: from.toISOString(),
      end: to.toISOString(),
      limit: String(PAGE_LIMIT),
      adjustment: "raw",
      sort: "asc",
    });
    if (this.feed) params.set("feed", this.feed);
    if (pageToken) params.set("page_token", pageToken);
    return `${this.baseUrl}/v2/stocks/${encodeURIComponent(symbol)}/bars?${params.toString()}`;
  }

  /**
   * One GET with retry/backoff. Delegated to ResilientHttpClient.
   */
  private async getJson(url: string): Promise<AlpacaBarsResponse> {
    return this.httpClient.getJson<AlpacaBarsResponse>(url, this.headers());
  }

  /**
   * All raw bars for one symbol/timeframe over [from, to], chunked + paginated.
   * Returns Alpaca's wire shape untouched — normalization is `prices.ts`'s job.
   */
  async getBars(
    symbol: string,
    timeframe: Timeframe,
    from: Date,
    to: Date,
  ): Promise<AlpacaRawBar[]> {
    const out: AlpacaRawBar[] = [];
    for (const chunk of chunkRange(from, to, timeframe)) {
      let pageToken: string | undefined;
      for (let page = 0; page < this.maxPagesPerChunk; page += 1) {
        const url = this.buildUrl(symbol, timeframe, chunk.from, chunk.to, pageToken);
        const json = await this.getJson(url);
        if (json.bars && json.bars.length > 0) out.push(...json.bars);
        if (!json.next_page_token) break;
        pageToken = json.next_page_token;
      }
    }
    return out;
  }
}

