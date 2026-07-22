import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runAgents } from "../src/agents/runner.js";
import { createDbPersistence } from "../src/agents/persistence.js";
import { StubSentimentAgent, StubTechnicalAgent } from "../src/agents/stubs/index.js";
import { makeInput, silentLogger } from "./agents.helpers.js";

/**
 * Spec 06 §7 — the persistence test. This one needs a real Postgres, which CI and
 * local dev may not have, so it SKIPS GRACEFULLY rather than failing the suite.
 * The behaviour it covers is also proven database-free in `agents.runner.test.ts`
 * via the injected recording persistence.
 *
 * To run it: set DATABASE_URL and apply the spec-01 migrations.
 */

let dbAvailable = false;
let db: typeof import("@committee/db") | undefined;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  try {
    db = await import("@committee/db");
    // Cheap round-trip to confirm the server is actually reachable.
    await db.sql`select 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable && db) {
    try {
      await db.sql.end({ timeout: 1 });
    } catch {
      /* nothing to clean up */
    }
  }
});

describe("agent run persistence (requires Postgres)", () => {
  it("writes one agent_runs row and one agent_outputs row per agent", async ({ skip }) => {
    if (!dbAvailable || !db) {
      skip();
      return;
    }

    const symbol = `TEST_${Date.now()}`;
    const { runId, outputs } = await runAgents(
      makeInput({ symbol }),
      [
        new StubTechnicalAgent({ logger: silentLogger }),
        new StubSentimentAgent({ logger: silentLogger }),
      ],
      { persistence: createDbPersistence(), logger: silentLogger },
    );

    const { eq } = await import("drizzle-orm");

    const runRows = await db.db
      .select()
      .from(db.agentRuns)
      .where(eq(db.agentRuns.id, runId));
    const outputRows = await db.db
      .select()
      .from(db.agentOutputs)
      .where(eq(db.agentOutputs.runId, runId));

    expect(runRows).toHaveLength(1);
    expect(runRows[0]?.status).toBe("completed");
    expect(outputRows).toHaveLength(outputs.length);

    // Clean up — cascade removes the outputs.
    await db.db.delete(db.agentRuns).where(eq(db.agentRuns.id, runId));
  });
});
