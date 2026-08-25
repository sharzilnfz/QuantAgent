import * as crypto from "node:crypto";
import { execSync } from "node:child_process";
import type { DatasetFixture } from "@committee/contracts";

/**
 * Computes a deterministic SHA-256 hex digest of a dataset fixture.
 * Normalizes and sorts bars and news to ensure bit-level reproducibility.
 */
export function computeDatasetHash(fixture: DatasetFixture): string {
  const normalizedBars = [...fixture.bars]
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    .map((bar) => ({
      symbol: bar.symbol,
      timeframe: bar.timeframe,
      ts: bar.ts,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      asOf: bar.asOf,
    }));

  const normalizedNews = [...fixture.news]
    .sort((a, b) => {
      const timeDiff = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    })
    .map((item) => ({
      id: item.id,
      headline: item.headline,
      summary: item.summary ?? null,
      source: item.source,
      url: item.url ?? null,
      symbols: [...item.symbols].sort(),
      publishedAt: item.publishedAt,
      asOf: item.asOf,
    }));

  const canonicalPayload = JSON.stringify({
    symbol: fixture.symbol,
    bars: normalizedBars,
    news: normalizedNews,
  });

  return crypto.createHash("sha256").update(canonicalPayload).digest("hex");
}

/**
 * Retrieves the current git commit SHA with graceful fallbacks.
 */
export function getGitCommitHash(): string {
  try {
    const commit = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (commit && commit.length >= 7) {
      return commit;
    }
    return "unknown-commit";
  } catch {
    return "unknown-commit";
  }
}
