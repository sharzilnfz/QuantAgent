import type { Timeframe } from "@committee/contracts";
import { config } from "../config.js";

/**
 * Thin Alpaca market-data client. Node's built-in global `fetch` only — no axios.
 *
 * Responsibilities kept here (transport concerns):
 *   - auth headers, URL building, pagination (`next_page_token`)
 *   - retry + exponential backoff with jitter on 429 / 5xx, honouring `Retry-After`
 *   - chunking long date ranges so one call can't blow the page budget
 *   - an optional on-disk response cache so dev re-runs don't burn rate limit
 *
 * Everything about MEANING (normalization, `as_of`) lives in `prices.ts` /
 * `as-of.ts`. This file must stay dumb about point-in-time semantics.
 */

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

export interface AlpacaClientOptions {
  /** Injected for tests. Defaults to Node's global fetch. */
  fetchImpl?: FetchLike;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  /** Data feed: "iex" is what free/paper keys get. */
  feed?: string;
  /** Attempts AFTER the first try. */
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Injected for tests so backoff doesn't actually sleep. */
  sleep?: (ms: number) => Promise<void>;
  /** Deterministic jitter for tests. Returns [0,1). */
  random?: () => number;
  /** Optional response cache. */
  cache?: ResponseCache;
  /** Hard cap on pages per chunk, so a bad token loop can't run forever. */
  maxPagesPerChunk?: number;
}

/** Pluggable cache seam — a no-op by default; `fs-cache.ts` provides a disk one. */
export interface ResponseCache {
  get(key: string): Promise<AlpacaBarsResponse | null>;
  set(key: string, value: AlpacaBarsResponse): Promise<void>;
}

export class AlpacaHttpError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Alpaca responded ${status}: ${body.slice(0, 400)}`);
    this.name = "AlpacaHttpError";
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_MAX_PAGES = 200;
const PAGE_LIMIT = 10_000;

/** How many days of one timeframe we ask for in a single request window. */
const CHUNK_DAYS: Record<Timeframe, number> = {
  "1Day": 365 * 5,
  "1Hour": 90,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** A request is retryable if the server said "slow down" or "I broke". */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status < 600);
}

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

/** `Retry-After` may be seconds or an HTTP date. Returns ms, or null. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  if (Number.isNaN(at)) return null;
  return Math.max(0, at - now);
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class AlpacaClient {
  private readonly fetchImpl: FetchLike;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly feed: string | undefined;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly cache: ResponseCache | undefined;
  private readonly maxPagesPerChunk: number;

  constructor(options: AlpacaClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.apiKey = options.apiKey ?? config.ALPACA_KEY;
    this.apiSecret = options.apiSecret ?? config.ALPACA_SECRET;
    this.baseUrl = (options.baseUrl ?? config.ALPACA_DATA_URL).replace(/\/+$/, "");
    this.feed = options.feed;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.cache = options.cache;
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

  /** Backoff delay for attempt N (0-based), exponential with full jitter. */
  private backoffMs(attempt: number): number {
    const exponential = this.baseDelayMs * Math.pow(2, attempt);
    const capped = Math.min(exponential, this.maxDelayMs);
    // Full jitter, keeping at least half the delay so we genuinely back off.
    return Math.round(capped * (0.5 + 0.5 * this.random()));
  }

  /**
   * One GET with retry/backoff. 429 and 5xx are retried (honouring
   * `Retry-After`); 4xx other than 429/408 fail immediately — retrying a bad
   * request just burns quota.
   */
  private async getJson(url: string): Promise<AlpacaBarsResponse> {
    const cached = this.cache ? await this.cache.get(url) : null;
    if (cached) return cached;

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, { method: "GET", headers: this.headers() });
      } catch (error) {
        // Network-level failure: retryable.
        lastError = error;
        if (attempt === this.maxRetries) break;
        await this.sleep(this.backoffMs(attempt));
        continue;
      }

      if (response.ok) {
        const json = (await response.json()) as AlpacaBarsResponse;
        if (this.cache) await this.cache.set(url, json);
        return json;
      }

      const body = await response.text().catch(() => "");
      const error = new AlpacaHttpError(response.status, body);
      if (!isRetryableStatus(response.status) || attempt === this.maxRetries) throw error;

      lastError = error;
      const retryAfter = parseRetryAfter(response.headers?.get?.("retry-after") ?? null);
      await this.sleep(retryAfter ?? this.backoffMs(attempt));
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Alpaca request failed after ${this.maxRetries + 1} attempts: ${url}`);
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
