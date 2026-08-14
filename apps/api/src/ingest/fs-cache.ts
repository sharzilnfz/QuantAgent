import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { AlpacaBarsResponse, ResponseCache } from "./alpaca-client.js";

/**
 * On-disk cache of raw Alpaca responses, keyed by the full request URL
 * (symbol + timeframe + window + page token). The guide flags Alpaca rate
 * limits as a real Sprint-1 risk; a dev re-running a backfill should not burn
 * quota re-fetching a window that has not changed.
 *
 * Cache is opt-in (`INGEST_CACHE_DIR`, or pass a dir) and best-effort: every
 * failure degrades to "no cache", never to a thrown error. Historical bars are
 * immutable once final, so entries do not expire by default; a TTL is available
 * for windows that may still be filling.
 */

export interface FsResponseCacheOptions {
  dir?: string;
  /** Milliseconds. 0/undefined = never expire. */
  ttlMs?: number;
}

interface CacheEnvelope {
  cachedAt: number;
  payload: AlpacaBarsResponse;
}

export class FsResponseCache implements ResponseCache {
  private readonly dir: string;
  private readonly ttlMs: number;
  private ensured = false;

  constructor(options: FsResponseCacheOptions = {}) {
    this.dir =
      options.dir ??
      process.env.INGEST_CACHE_DIR ??
      join(tmpdir(), "committee-ingest-cache");
    this.ttlMs = options.ttlMs ?? 0;
  }

  private path(key: string): string {
    const hash = createHash("sha256").update(key).digest("hex");
    return join(this.dir, `${hash}.json`);
  }

  private async ensureDir(): Promise<void> {
    if (this.ensured) return;
    await mkdir(this.dir, { recursive: true });
    this.ensured = true;
  }

  async get(key: string): Promise<AlpacaBarsResponse | null> {
    try {
      const raw = await readFile(this.path(key), "utf8");
      const envelope = JSON.parse(raw) as CacheEnvelope;
      if (this.ttlMs > 0 && Date.now() - envelope.cachedAt > this.ttlMs) return null;
      return envelope.payload;
    } catch {
      return null;
    }
  }

  async set(key: string, value: AlpacaBarsResponse): Promise<void> {
    try {
      await this.ensureDir();
      const envelope: CacheEnvelope = { cachedAt: Date.now(), payload: value };
      await writeFile(this.path(key), JSON.stringify(envelope), "utf8");
    } catch {
      // Cache is an optimization; never let it break an ingest.
    }
  }
}

/** Returns a disk cache only when one has been explicitly configured. */
export function cacheFromEnv(): FsResponseCache | undefined {
  return process.env.INGEST_CACHE_DIR ? new FsResponseCache() : undefined;
}
