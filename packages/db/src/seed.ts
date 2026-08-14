import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { users, watchlistItems } from "./schema";

/**
 * Idempotent seed: one demo user + a 3-symbol watchlist (AAPL/MSFT/SPY).
 * Running it twice does NOT duplicate the user or the watchlist rows.
 *   pnpm --filter @committee/db seed
 */

export const DEMO_EMAIL = "demo@committee.local";
// Not a real credential — a placeholder hash. Spec 03 owns auth/crypto.
export const DEMO_PASSWORD_HASH =
  "$2b$10$seedplaceholderhashseedplaceholderhashse";
export const DEMO_SYMBOLS = ["AAPL", "MSFT", "SPY"] as const;

type SeedDb = ReturnType<typeof drizzle>;

/** Idempotent. Safe to run any number of times against the same database. */
export async function seed(db: SeedDb): Promise<{ userId: string }> {
  // Upsert the demo user by unique email.
  const inserted = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, passwordHash: DEMO_PASSWORD_HASH })
    .onConflictDoNothing({ target: users.email })
    .returning();

  const demoUser =
    inserted[0] ??
    (
      await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1)
    )[0];

  if (!demoUser) {
    throw new Error("Failed to create or find the demo user.");
  }

  // Upsert each symbol; unique(user_id, symbol) makes this idempotent.
  for (const symbol of DEMO_SYMBOLS) {
    await db
      .insert(watchlistItems)
      .values({ userId: demoUser.id, symbol })
      .onConflictDoNothing({
        target: [watchlistItems.userId, watchlistItems.symbol],
      });
  }

  return { userId: demoUser.id };
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot seed.");
  }

  const sql = postgres(connectionString, { max: 1 });
  try {
    await seed(drizzle(sql));
    console.log(
      `Seed complete: ${DEMO_EMAIL} with watchlist ${DEMO_SYMBOLS.join(", ")}.`,
    );
  } catch (err) {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

// Only auto-run when executed directly (`tsx src/seed.ts`), not when imported.
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && invokedPath === resolve(fileURLToPath(import.meta.url))) {
  await main();
}
