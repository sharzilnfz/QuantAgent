import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq, and, lte } from "drizzle-orm";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { priceBars, users, watchlistItems } from "../src/schema";
import { seed, DEMO_EMAIL, DEMO_SYMBOLS } from "../src/seed";

/**
 * Integration tests (spec 01 §7). These need a live Postgres 16 + pgvector.
 * When DATABASE_URL is unset or unreachable they SKIP gracefully so the suite
 * still exits 0 in environments without a database.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, "../migrations");

type Client = ReturnType<typeof postgres>;

let client: Client | undefined;
let dbAvailable = false;
let skipReason = "DATABASE_URL is not set";

// Probe connectivity at module load so we can use describe.skipIf(...).
const connectionString = process.env.DATABASE_URL;
if (connectionString) {
  try {
    const probe = postgres(connectionString, {
      max: 1,
      connect_timeout: 3,
      idle_timeout: 1,
      onnotice: () => {},
    });
    await probe`select 1`;
    dbAvailable = true;
    client = probe;
  } catch (err) {
    skipReason = `Postgres unreachable: ${(err as Error).message}`;
    dbAvailable = false;
  }
}

if (!dbAvailable) {
  // Surfaced once so a skipped run is never silently mistaken for a pass.
  console.warn(`[db-constraints] skipping DB integration tests — ${skipReason}`);
}

const describeDb = describe.skipIf(!dbAvailable);

describeDb("migration round-trip on a live Postgres", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    db = drizzle(client!);
    await migrate(db, { migrationsFolder });
  }, 60_000);

  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  it("enables the vector and pgcrypto extensions", async () => {
    const rows = await client!<{ extname: string }[]>`
      select extname from pg_extension where extname in ('vector', 'pgcrypto')
    `;
    const names = rows.map((r) => r.extname).sort();
    expect(names).toEqual(["pgcrypto", "vector"]);
  });

  it("creates every core table", async () => {
    const rows = await client!<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public'
    `;
    const names = new Set(rows.map((r) => r.tablename));
    for (const t of [
      "users",
      "sessions",
      "alpaca_credentials",
      "watchlist_items",
      "price_bars",
      "indicator_snapshots",
      "agent_runs",
      "agent_outputs",
    ]) {
      expect(names.has(t), `missing table ${t}`).toBe(true);
    }
  });

  it("creates the as_of / decision_ts indexes", async () => {
    const rows = await client!<{ indexname: string }[]>`
      select indexname from pg_indexes where schemaname = 'public'
    `;
    const names = new Set(rows.map((r) => r.indexname));
    for (const i of [
      "price_bars_as_of_idx",
      "indicator_snapshots_as_of_idx",
      "agent_runs_decision_ts_idx",
      "price_bars_symbol_tf_ts_idx",
    ]) {
      expect(names.has(i), `missing index ${i}`).toBe(true);
    }
  });

  it("has no plaintext key/secret column on alpaca_credentials", async () => {
    const rows = await client!<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'alpaca_credentials'
    `;
    const names = rows.map((r) => r.column_name);
    expect(names).not.toContain("key");
    expect(names).not.toContain("secret");
    expect(names).not.toContain("api_key");
    expect(names).not.toContain("api_secret");
    expect(names).toContain("key_ciphertext");
    expect(names).toContain("secret_ciphertext");
  });

  it("rejects a price_bars row with no as_of (NOT NULL)", async () => {
    await expect(
      client!`
        insert into price_bars (symbol, timeframe, ts, open, high, low, close, volume)
        values ('TEST', '1Day', now(), 1, 2, 0.5, 1.5, 100)
      `,
    ).rejects.toThrow(/not[- ]null/i);
  });

  it("rejects a duplicate (symbol, timeframe, ts) price bar (UNIQUE)", async () => {
    const ts = new Date("2024-01-02T14:30:00.000Z");
    const bar = {
      symbol: "PITTEST",
      timeframe: "1Day" as const,
      ts,
      open: "100.00",
      high: "101.00",
      low: "99.00",
      close: "100.50",
      volume: "1000",
      asOf: new Date("2024-01-02T21:00:00.000Z"),
    };

    await db.delete(priceBars).where(eq(priceBars.symbol, "PITTEST"));
    await db.insert(priceBars).values(bar);
    await expect(db.insert(priceBars).values(bar)).rejects.toThrow(
      /duplicate key|unique/i,
    );
    await db.delete(priceBars).where(eq(priceBars.symbol, "PITTEST"));
  });

  it("honours the point-in-time filter as_of <= decision_ts", async () => {
    await db.delete(priceBars).where(eq(priceBars.symbol, "PITWINDOW"));
    const decisionTs = new Date("2024-03-01T00:00:00.000Z");
    await db.insert(priceBars).values([
      {
        symbol: "PITWINDOW",
        timeframe: "1Day",
        ts: new Date("2024-02-28T14:30:00.000Z"),
        open: "1",
        high: "2",
        low: "1",
        close: "2",
        volume: "10",
        asOf: new Date("2024-02-28T21:00:00.000Z"), // knowable
      },
      {
        symbol: "PITWINDOW",
        timeframe: "1Day",
        ts: new Date("2024-03-02T14:30:00.000Z"),
        open: "1",
        high: "2",
        low: "1",
        close: "2",
        volume: "10",
        asOf: new Date("2024-03-02T21:00:00.000Z"), // future — must be excluded
      },
    ]);

    const visible = await db
      .select()
      .from(priceBars)
      .where(
        and(
          eq(priceBars.symbol, "PITWINDOW"),
          // Typed operator, not a raw template: interpolating a JS Date through
          // `sql` sends it as a string parameter and postgres rejects it.
          lte(priceBars.asOf, decisionTs),
        ),
      );

    expect(visible).toHaveLength(1);
    await db.delete(priceBars).where(eq(priceBars.symbol, "PITWINDOW"));
  });

  it("seed is idempotent — running twice does not duplicate the demo user", async () => {
    await seed(db);
    await seed(db);

    const demoUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, DEMO_EMAIL));
    expect(demoUsers).toHaveLength(1);

    const items = await db
      .select()
      .from(watchlistItems)
      .where(eq(watchlistItems.userId, demoUsers[0]!.id));
    expect(items).toHaveLength(DEMO_SYMBOLS.length);
    expect(items.map((i) => i.symbol).sort()).toEqual([...DEMO_SYMBOLS].sort());
  });
});
