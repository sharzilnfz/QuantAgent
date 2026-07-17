import { sql } from "drizzle-orm";
import { createDb } from "./client.js";
import { users, assets } from "./schema.js";
import { hash } from "argon2";

/**
 * Idempotent seed script.
 *
 * Seeds demo assets (AAPL, MSFT, SPY) and a demo user.
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING.
 */
async function seed() {
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/trading";
  const { db, sql: pgSql } = createDb(databaseUrl);

  console.log("🌱 Seeding database...");

  // Seed assets
  const demoAssets = [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      exchange: "NASDAQ",
      assetClass: "us_equity",
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corporation",
      exchange: "NASDAQ",
      assetClass: "us_equity",
    },
    {
      symbol: "SPY",
      name: "SPDR S&P 500 ETF Trust",
      exchange: "ARCA",
      assetClass: "us_equity",
    },
  ];

  for (const asset of demoAssets) {
    await db
      .insert(assets)
      .values(asset)
      .onConflictDoNothing({ target: assets.symbol });
    console.log(`  ✅ Asset: ${asset.symbol}`);
  }

  // Seed demo user
  const demoEmail = "demo@quantagent.dev";
  const demoPassword = await hash("demo-password-123");

  await db
    .insert(users)
    .values({
      email: demoEmail,
      passwordHash: demoPassword,
    })
    .onConflictDoNothing({ target: users.email });
  console.log(`  ✅ User: ${demoEmail}`);

  console.log("🌱 Seed complete.");

  await pgSql.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
