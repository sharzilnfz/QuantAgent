import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  users,
  sessions,
  alpacaCredentials,
  watchlistItems,
  priceBars,
  indicatorSnapshots,
  agentRuns,
  agentOutputs,
  memoryShortTerm,
  memoryLongTerm,
  episodicReflections,
} from "../src/schema";

/**
 * Pure schema-shape assertions — these run with NO database connection.
 * They lock in the spec-01 invariants: point-in-time columns, ciphertext-only
 * credentials, numeric money, timestamptz timestamps.
 */

const TIMESTAMPTZ = "timestamp with time zone";

function cols(table: PgTable) {
  const cfg = getTableConfig(table);
  return new Map(cfg.columns.map((c) => [c.name, c]));
}

function indexNames(table: PgTable): string[] {
  return getTableConfig(table).indexes.map((i) => i.config.name ?? "");
}

function indexedColumnSets(table: PgTable): string[][] {
  return getTableConfig(table).indexes.map((i) =>
    (i.config.columns ?? []).map((c) => ("name" in c ? String(c.name) : "")),
  );
}

function uniqueColumnSets(table: PgTable): string[][] {
  return getTableConfig(table).uniqueConstraints.map((u) =>
    u.columns.map((c) => c.name),
  );
}

const CORE_TABLES: Array<[string, PgTable]> = [
  ["users", users],
  ["sessions", sessions],
  ["alpaca_credentials", alpacaCredentials],
  ["watchlist_items", watchlistItems],
  ["price_bars", priceBars],
  ["indicator_snapshots", indicatorSnapshots],
  ["agent_runs", agentRuns],
  ["agent_outputs", agentOutputs],
];

describe("core tables", () => {
  it("all eight Sprint-1 core tables are defined with the expected names", () => {
    for (const [name, table] of CORE_TABLES) {
      expect(getTableConfig(table).name).toBe(name);
    }
  });

  it("every timestamp column across core tables is timestamptz", () => {
    for (const [tableName, table] of CORE_TABLES) {
      for (const col of getTableConfig(table).columns) {
        if (col.getSQLType().startsWith("timestamp")) {
          expect(
            col.getSQLType(),
            `${tableName}.${col.name} must be timestamptz`,
          ).toBe(TIMESTAMPTZ);
        }
      }
    }
  });
});

describe("alpaca_credentials — ciphertext only", () => {
  const c = cols(alpacaCredentials);

  it("has exactly the ciphertext columns the spec allows", () => {
    expect([...c.keys()].sort()).toEqual(
      [
        "auth_tag",
        "created_at",
        "id",
        "iv",
        "key_ciphertext",
        "secret_ciphertext",
        "user_id",
      ].sort(),
    );
  });

  it("has NO plaintext key/secret column", () => {
    const forbidden =
      /^(api_)?(key|secret|api_secret|password|token|access_token)$/i;
    for (const name of c.keys()) {
      expect(forbidden.test(name), `${name} is a plaintext column`).toBe(false);
      // no column may be a bare key/secret, only *_ciphertext
      if (/key|secret/i.test(name)) {
        expect(name.endsWith("_ciphertext")).toBe(true);
      }
    }
  });

  it("ciphertext columns and crypto params are NOT NULL", () => {
    for (const name of ["key_ciphertext", "secret_ciphertext", "iv", "auth_tag"]) {
      expect(c.get(name)?.notNull, `${name} must be NOT NULL`).toBe(true);
    }
  });
});

describe("price_bars — fact table point-in-time discipline", () => {
  const c = cols(priceBars);

  it("has as_of timestamptz NOT NULL", () => {
    const asOf = c.get("as_of");
    expect(asOf).toBeDefined();
    expect(asOf?.getSQLType()).toBe(TIMESTAMPTZ);
    expect(asOf?.notNull).toBe(true);
  });

  it("indexes as_of so `WHERE as_of <= decision_ts` stays cheap", () => {
    expect(indexedColumnSets(priceBars)).toContainEqual(["as_of"]);
    expect(indexNames(priceBars)).toContain("price_bars_as_of_idx");
  });

  it("indexes (symbol, timeframe, ts)", () => {
    expect(indexedColumnSets(priceBars)).toContainEqual([
      "symbol",
      "timeframe",
      "ts",
    ]);
  });

  it("is unique on (symbol, timeframe, ts)", () => {
    expect(uniqueColumnSets(priceBars)).toContainEqual([
      "symbol",
      "timeframe",
      "ts",
    ]);
  });

  it("money/price/volume columns are numeric, never float", () => {
    for (const name of ["open", "high", "low", "close", "volume"]) {
      expect(c.get(name)?.getSQLType(), `${name} must be numeric`).toBe(
        "numeric",
      );
      expect(c.get(name)?.notNull).toBe(true);
    }
  });

  it("keeps field names isomorphic with the contracts PriceBar schema", () => {
    // contracts PriceBar: symbol, timeframe, ts, open, high, low, close, volume, asOf
    for (const name of [
      "symbol",
      "timeframe",
      "ts",
      "open",
      "high",
      "low",
      "close",
      "volume",
      "as_of",
    ]) {
      expect(c.has(name), `price_bars missing ${name}`).toBe(true);
    }
  });
});

describe("indicator_snapshots — fact table point-in-time discipline", () => {
  const c = cols(indicatorSnapshots);

  it("has as_of timestamptz NOT NULL", () => {
    const asOf = c.get("as_of");
    expect(asOf).toBeDefined();
    expect(asOf?.getSQLType()).toBe(TIMESTAMPTZ);
    expect(asOf?.notNull).toBe(true);
  });

  it("indexes as_of", () => {
    expect(indexedColumnSets(indicatorSnapshots)).toContainEqual(["as_of"]);
    expect(indexNames(indicatorSnapshots)).toContain(
      "indicator_snapshots_as_of_idx",
    );
  });

  it("is unique on (symbol, timeframe, ts)", () => {
    expect(uniqueColumnSets(indicatorSnapshots)).toContainEqual([
      "symbol",
      "timeframe",
      "ts",
    ]);
  });

  it("stores indicators as jsonb", () => {
    expect(c.get("indicators")?.getSQLType()).toBe("jsonb");
    expect(c.get("indicators")?.notNull).toBe(true);
  });
});

describe("agent_runs — the decision-window clock", () => {
  const c = cols(agentRuns);

  it("has decision_ts timestamptz NOT NULL (the point-in-time boundary)", () => {
    const d = c.get("decision_ts");
    expect(d).toBeDefined();
    expect(d?.getSQLType()).toBe(TIMESTAMPTZ);
    expect(d?.notNull).toBe(true);
  });

  it("indexes decision_ts", () => {
    expect(indexedColumnSets(agentRuns)).toContainEqual(["decision_ts"]);
  });

  it("uses a uuid primary key as the replayable run id", () => {
    expect(c.get("id")?.getSQLType()).toBe("uuid");
    expect(c.get("id")?.primary).toBe(true);
  });

  it("enumerates status as running/completed/failed", () => {
    expect(c.get("status")?.enumValues).toEqual([
      "running",
      "completed",
      "failed",
    ]);
  });
});

describe("agent_outputs — mirrors the contracts AgentOutput", () => {
  const c = cols(agentOutputs);

  it("has the contract-aligned columns", () => {
    for (const name of [
      "run_id",
      "agent",
      "direction",
      "confidence",
      "rationale",
      "raw",
    ]) {
      expect(c.has(name), `agent_outputs missing ${name}`).toBe(true);
    }
  });

  it("confidence is numeric (0-1), not float", () => {
    expect(c.get("confidence")?.getSQLType()).toBe("numeric");
  });

  it("agent and direction enums match the contracts enums", () => {
    expect(c.get("agent")?.enumValues).toEqual([
      "technical",
      "sentiment",
      "fundamental",
      "polymarket",
    ]);
    expect(c.get("direction")?.enumValues).toEqual([
      "bullish",
      "bearish",
      "neutral",
    ]);
  });
});

describe("watchlist_items", () => {
  it("is unique on (user_id, symbol)", () => {
    expect(uniqueColumnSets(watchlistItems)).toContainEqual([
      "user_id",
      "symbol",
    ]);
  });
});

describe("timeframe enum", () => {
  it("is 1Day / 1Hour everywhere it appears", () => {
    for (const table of [priceBars, indicatorSnapshots, agentRuns]) {
      expect(cols(table).get("timeframe")?.enumValues).toEqual([
        "1Day",
        "1Hour",
      ]);
    }
  });
});

describe("memory tables (Sprint 3)", () => {
  it("all memory tables have as_of timestamp with time zone", () => {
    const memoryTables = [
      memoryShortTerm,
      memoryLongTerm,
      episodicReflections,
    ];
    for (const table of memoryTables) {
      const c = cols(table);
      expect(c.has("as_of"), `${getTableConfig(table).name} missing as_of`).toBe(true);
      expect(c.get("as_of")?.getSQLType()).toBe(TIMESTAMPTZ);
    }
  });
});

