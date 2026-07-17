import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

/**
 * Create a database connection and Drizzle ORM client.
 *
 * Uses `postgres` driver with a connection pool. In tests, the connection
 * string can be overridden via `DATABASE_URL` env var.
 */
function createDb(connectionString: string) {
  const sql = postgres(connectionString, {
    max: 10, // connection pool size
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return {
    db: drizzle(sql, { schema }),
    sql,
  };
}

// Default connection — used by the running server.
// In tests, modules import `createDb` directly with a test connection string.
const databaseUrl = process.env.DATABASE_URL;

let db: ReturnType<typeof createDb>["db"];
let sql: ReturnType<typeof createDb>["sql"];

if (databaseUrl) {
  const connection = createDb(databaseUrl);
  db = connection.db;
  sql = connection.sql;
}

export { db, sql, createDb, schema };
