import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

/**
 * Tiny typed DB client other packages import. Configured from `DATABASE_URL`.
 *
 *   import { db, priceBars } from "@committee/db";
 *
 * CONNECTION IS LAZY, BY DESIGN. Importing this module must never open a socket
 * or throw — only *using* `db`/`sql` requires DATABASE_URL. That matters because
 * the API composition root imports every plugin at boot: if this module threw on
 * import, the whole service (including /health and the 401 paths) would be
 * unloadable on a machine without Postgres, and every consumer would have to
 * hand-roll a lazy `await import("@committee/db")` to work around it.
 *
 * The missing-DATABASE_URL error still surfaces — just at first query instead of
 * at import, which is where it is actionable.
 */

type Db = PostgresJsDatabase<typeof schema>;

let sqlInstance: Sql | undefined;
let dbInstance: Db | undefined;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — @committee/db needs a Postgres connection string.",
    );
  }
  return url;
}

/** Resolve (and memoize) the raw postgres-js handle. */
export function getSql(): Sql {
  sqlInstance ??= postgres(connectionString());
  return sqlInstance;
}

/** Resolve (and memoize) the Drizzle client. */
export function getDb(): Db {
  dbInstance ??= drizzle(getSql(), { schema });
  return dbInstance;
}

/** True when a connection string is present — lets callers skip DB work cleanly. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Close the pool (tests, CLI scripts, graceful shutdown). */
export async function closeDb(): Promise<void> {
  if (sqlInstance) {
    await sqlInstance.end({ timeout: 5 });
    sqlInstance = undefined;
    dbInstance = undefined;
  }
}

/**
 * `sql` and `db` stay importable as values for ergonomics; the proxies defer
 * every real operation to the getters above. The `sql` target is a function
 * because postgres-js is callable as a tagged template.
 */
export const sql: Sql = new Proxy((() => {}) as unknown as Sql, {
  apply(_target, thisArg, args: unknown[]) {
    return Reflect.apply(getSql() as unknown as (...a: unknown[]) => unknown, thisArg, args);
  },
  get(_target, prop, receiver) {
    return Reflect.get(getSql() as unknown as object, prop, receiver);
  },
  set(_target, prop, value, receiver) {
    return Reflect.set(getSql() as unknown as object, prop, value, receiver);
  },
  has(_target, prop) {
    return Reflect.has(getSql() as unknown as object, prop);
  },
});

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as unknown as object, prop, receiver);
  },
  set(_target, prop, value, receiver) {
    return Reflect.set(getDb() as unknown as object, prop, value, receiver);
  },
  has(_target, prop) {
    return Reflect.has(getDb() as unknown as object, prop);
  },
});

export type DrizzleDb = Db;

export * from "./schema";
