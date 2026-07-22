import { config } from "../config.js";

/**
 * OWNER: M4 (spec 03). Lazy accessor for the shared Drizzle client.
 *
 * WHY LAZY: `@committee/db`'s entrypoint constructs the postgres-js pool at
 * *import* time and throws when `DATABASE_URL` is unset. Importing it eagerly
 * from a route module would therefore make the whole API (and every pure unit
 * test) fail to load on a machine with no database. Instead we:
 *
 *   1. import the *schema only* (`@committee/db/schema`) statically — that
 *      subpath has no client/connection side effects, and
 *   2. resolve the client on first actual use, seeding `process.env.DATABASE_URL`
 *      from the validated `config` so the package's own guard is satisfied.
 *
 * Net effect: modules under auth/, credentials/ and portfolio/ are import-safe
 * without Postgres; only a request that really touches the DB will connect.
 */

type DbModule = typeof import("@committee/db");
export type Db = DbModule["db"];

let dbPromise: Promise<Db> | null = null;

/** Resolve (and memoise) the Drizzle client. Throws only if the DB is unusable. */
export async function getDb(): Promise<Db> {
  if (!dbPromise) {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = config.DATABASE_URL;
    }
    dbPromise = import("@committee/db").then((m) => m.db);
    // Don't cache a rejected promise — a later request should be able to retry.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}
