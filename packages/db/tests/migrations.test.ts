import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

/**
 * Assertions over the generated migration SQL — no database required.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, "../migrations");

const sqlFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const firstMigration = readFileSync(
  join(migrationsDir, sqlFiles[0] ?? ""),
  "utf8",
);

const allSql = sqlFiles
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n");

describe("generated migrations", () => {
  it("at least one migration SQL file is committed", () => {
    expect(sqlFiles.length).toBeGreaterThan(0);
  });

  it("the first migration enables pgvector and pgcrypto", () => {
    expect(firstMigration).toMatch(/CREATE EXTENSION IF NOT EXISTS vector/i);
    expect(firstMigration).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/i);
  });

  it("extensions are enabled before any table or type is created", () => {
    const lastExtension = Math.max(
      firstMigration.search(/CREATE EXTENSION IF NOT EXISTS vector/i),
      firstMigration.search(/CREATE EXTENSION IF NOT EXISTS pgcrypto/i),
    );
    const firstCreate = Math.min(
      ...[/CREATE TABLE/i, /CREATE TYPE/i]
        .map((re) => firstMigration.search(re))
        .filter((i) => i >= 0),
    );
    expect(lastExtension).toBeGreaterThanOrEqual(0);
    expect(lastExtension).toBeLessThan(firstCreate);
  });

  it("creates every core table", () => {
    for (const table of [
      "users",
      "sessions",
      "alpaca_credentials",
      "watchlist_items",
      "price_bars",
      "indicator_snapshots",
      "agent_runs",
      "agent_outputs",
    ]) {
      expect(allSql, `missing CREATE TABLE ${table}`).toMatch(
        new RegExp(`CREATE TABLE "${table}"`, "i"),
      );
    }
  });

  it("creates the as_of and decision_ts indexes", () => {
    expect(allSql).toMatch(/CREATE INDEX "price_bars_as_of_idx"/i);
    expect(allSql).toMatch(/CREATE INDEX "indicator_snapshots_as_of_idx"/i);
    expect(allSql).toMatch(/CREATE INDEX "agent_runs_decision_ts_idx"/i);
  });

  it("declares as_of / decision_ts as NOT NULL timestamptz", () => {
    expect(allSql).toMatch(
      /"as_of" timestamp with time zone NOT NULL/i,
    );
    expect(allSql).toMatch(
      /"decision_ts" timestamp with time zone NOT NULL/i,
    );
  });

  it("never creates a plaintext alpaca key/secret column", () => {
    expect(allSql).not.toMatch(/"api_key"|"api_secret"|"secret" text|"key" text/i);
    expect(allSql).toMatch(/"key_ciphertext" text NOT NULL/i);
    expect(allSql).toMatch(/"secret_ciphertext" text NOT NULL/i);
  });

  it("uses numeric (not float/real/double) for price columns", () => {
    expect(allSql).not.toMatch(/double precision|\breal\b|float8/i);
    for (const col of ["open", "high", "low", "close", "volume"]) {
      expect(allSql).toMatch(new RegExp(`"${col}" numeric NOT NULL`, "i"));
    }
  });
});
