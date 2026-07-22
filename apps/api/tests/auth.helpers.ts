import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import postgres from "postgres";

import { authPlugin } from "../src/auth/plugin.js";
import { credentialsPlugin } from "../src/credentials/plugin.js";
import { portfolioPlugin } from "../src/portfolio/plugin.js";
import { config } from "../src/config.js";

/**
 * Shared harness for the M4 (spec 03) test files.
 *
 * NOT a `.test.ts` file, so vitest does not collect it. It builds an app with
 * ONLY the M4 plugins — deliberately not `buildApp()` — so these tests stay
 * green while sibling teams are mid-flight on ingest/agents.
 */

export interface CapturedLogs {
  lines: string[];
  text(): string;
}

/** Build the M4 slice of the API, capturing every log line for assertions. */
export async function buildTestApp(): Promise<{
  app: FastifyInstance;
  logs: CapturedLogs;
}> {
  const lines: string[] = [];
  const app = Fastify({
    logger: {
      level: "trace",
      stream: {
        write(chunk: string) {
          lines.push(chunk);
        },
      },
    },
  });

  await app.register(cookie);
  await app.register(authPlugin);
  await app.register(credentialsPlugin);
  await app.register(portfolioPlugin);
  await app.ready();

  return { app, logs: { lines, text: () => lines.join("\n") } };
}

/** Pull a Set-Cookie value out of an inject() response. */
export function readCookie(
  setCookie: unknown,
  name: string,
): string | undefined {
  const raw = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const entry of raw) {
    if (entry && typeof entry === "object" && "name" in entry) {
      const c = entry as { name: string; value: string };
      if (c.name === name) return c.value;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Database availability probe
// ---------------------------------------------------------------------------

/**
 * The integration tests need a live Postgres with spec 01's migrations applied.
 * There is none in CI/dev sandboxes, so we probe once at module load and let the
 * suites use `describe.skipIf(...)` — a missing database SKIPS, never fails.
 */
export interface DbProbe {
  available: boolean;
  reason: string;
}

async function probeDatabase(): Promise<DbProbe> {
  const url = process.env.DATABASE_URL ?? config.DATABASE_URL;
  if (!url) return { available: false, reason: "DATABASE_URL is not set" };

  let client: ReturnType<typeof postgres> | undefined;
  try {
    client = postgres(url, {
      max: 1,
      connect_timeout: 3,
      idle_timeout: 1,
      onnotice: () => {},
    });
    // Not just "can I connect" — spec 01's tables must exist too.
    await client`select 1 from users limit 1`;
    process.env.DATABASE_URL = url;
    return { available: true, reason: "" };
  } catch (err) {
    const e = err as { message?: string; code?: string };
    return {
      available: false,
      reason: `Postgres unusable: ${e.code ?? ""} ${e.message || String(err)}`.trim(),
    };
  } finally {
    await client?.end({ timeout: 1 }).catch(() => {});
  }
}

export const dbProbe: DbProbe = await probeDatabase();

if (!dbProbe.available) {
  console.warn(
    `[m4-auth] skipping DB-backed integration tests — ${dbProbe.reason}`,
  );
}

/** Random, collision-free email for a test run. */
export function testEmail(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}@committee.test`;
}
