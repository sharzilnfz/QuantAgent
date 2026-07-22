import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Runs pending Drizzle migrations against DATABASE_URL, then exits.
 *   pnpm --filter @committee/db migrate
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — cannot run migrations.");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, "../migrations");

// A dedicated single-connection handle for migrations (max: 1).
const migrationClient = postgres(connectionString, { max: 1 });

async function main(): Promise<void> {
  const db = drizzle(migrationClient);
  console.log(`Running migrations from ${migrationsFolder} ...`);
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");
  await migrationClient.end();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await migrationClient.end();
  process.exit(1);
});
