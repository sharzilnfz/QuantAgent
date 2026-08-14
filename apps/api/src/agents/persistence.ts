import type { AgentInput, AgentOutput, Timeframe } from "@committee/contracts";

/**
 * Persistence seam for the agent runner (spec 06 §4).
 *
 * The runner writes one `agent_runs` row + one `agent_outputs` row per agent.
 * That is a hard dependency on Postgres, which would make the resilience /
 * parallelism / schema tests unrunnable in CI. So persistence is an INJECTABLE
 * interface: pass `null` to skip it entirely (pure in-memory run), pass a fake
 * to assert on writes, or let the runner build the real Drizzle-backed one.
 *
 * `@committee/db` is imported DYNAMICALLY inside the implementation because its
 * client module throws at import time when `DATABASE_URL` is unset — importing
 * it eagerly would break every test in this package.
 */

export interface AgentRunRecord {
  runId: string;
  symbol: string;
  timeframe: Timeframe;
  /** POINT-IN-TIME boundary for the whole run. */
  decisionTs: string;
}

export type AgentRunStatus = "completed" | "failed";

export interface AgentRunPersistence {
  /** Insert the `agent_runs` row with status `running`. */
  createRun(record: AgentRunRecord): Promise<void>;
  /** Insert one validated `agent_outputs` row. */
  saveOutput(runId: string, output: AgentOutput): Promise<void>;
  /** Close the lifecycle: running -> completed | failed. */
  finishRun(runId: string, status: AgentRunStatus): Promise<void>;
}

export function runRecordFromInput(
  runId: string,
  input: Omit<AgentInput, "runId">,
): AgentRunRecord {
  return {
    runId,
    symbol: input.symbol,
    timeframe: input.timeframe,
    decisionTs: input.decisionTs,
  };
}

/**
 * Postgres-backed persistence. Every method resolves `@committee/db` lazily so
 * that merely importing this module never requires a live database.
 */
export function createDbPersistence(): AgentRunPersistence {
  return {
    async createRun(record) {
      const { db, agentRuns } = await import("@committee/db");
      await db.insert(agentRuns).values({
        id: record.runId,
        symbol: record.symbol,
        timeframe: record.timeframe,
        decisionTs: new Date(record.decisionTs),
        status: "running",
      });
    },

    async saveOutput(runId, output) {
      const { db, agentOutputs } = await import("@committee/db");
      await db.insert(agentOutputs).values({
        runId,
        agent: output.agent,
        direction: output.direction,
        // numeric columns are string-typed in Drizzle
        confidence: String(output.confidence),
        rationale: output.rationale,
        raw: output,
      });
    },

    async finishRun(runId, status) {
      const { db, agentRuns } = await import("@committee/db");
      const { eq } = await import("drizzle-orm");
      await db
        .update(agentRuns)
        .set({ status, finishedAt: new Date() })
        .where(eq(agentRuns.id, runId));
    },
  };
}

/**
 * Default persistence resolution used by `runAgents` when the caller says
 * nothing. Returns `null` (= skip writes) when no `DATABASE_URL` is configured,
 * so unit tests and offline dev runs still complete end-to-end.
 */
export function resolveDefaultPersistence(): AgentRunPersistence | null {
  return process.env.DATABASE_URL ? createDbPersistence() : null;
}
