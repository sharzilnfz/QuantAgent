import type { AlpacaBarsResponse, FetchLike, ResponseCache } from "./alpaca-client.js";

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

export const DEFAULT_MAX_RETRIES = 5;
export const DEFAULT_BASE_DELAY_MS = 500;
export const DEFAULT_MAX_DELAY_MS = 30_000;

/** A request is retryable if the server said "slow down" or "I broke". */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status < 600);
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

export interface ResilientHttpClientOptions {
  fetchImpl?: FetchLike;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  cache?: ResponseCache;
}

export class ResilientHttpClient {
  private readonly fetchImpl: FetchLike;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly cache: ResponseCache | undefined;

  constructor(options: ResilientHttpClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.cache = options.cache;
  }

  /** Backoff delay for attempt N (0-based), exponential with full jitter. */
  backoffMs(attempt: number): number {
    const exponential = this.baseDelayMs * Math.pow(2, attempt);
    const capped = Math.min(exponential, this.maxDelayMs);
    // Full jitter, keeping at least half the delay so we genuinely back off.
    return Math.round(capped * (0.5 + 0.5 * this.random()));
  }

  /**
   * One GET with retry/backoff and optional caching.
   * 429 and 5xx are retried (honouring `Retry-After`); 4xx other than 429/408
   * fail immediately.
   */
  async getJson<T = AlpacaBarsResponse>(
    url: string,
    headers: Record<string, string>,
  ): Promise<T> {
    const cached = this.cache ? await this.cache.get(url) : null;
    if (cached) return cached as unknown as T;

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, { method: "GET", headers });
      } catch (error) {
        // Network-level failure: retryable.
        lastError = error;
        if (attempt === this.maxRetries) break;
        await this.sleep(this.backoffMs(attempt));
        continue;
      }

      if (response.ok) {
        const json = (await response.json()) as T;
        if (this.cache) await this.cache.set(url, json as unknown as AlpacaBarsResponse);
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
      : new Error(`Request failed after ${this.maxRetries + 1} attempts: ${url}`);
  }
}
