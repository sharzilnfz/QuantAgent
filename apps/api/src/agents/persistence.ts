import type { AgentInput, AgentOutput } from "@committee/contracts";

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

export type AgentRunStatus = "completed" | "failed";

export interface AgentRunStore {
  recordRun(run: {
    runId: string;
    input: Omit<AgentInput, "runId">;
    outputs: AgentOutput[];
    status: AgentRunStatus;
  }): Promise<void>;
}

/**
 * Postgres-backed persistence. Every method resolves `@committee/db` lazily so
 * that merely importing this module never requires a live database.
 */
export function createDbPersistence(): AgentRunStore {
  return {
    async recordRun({ runId, input, outputs, status }) {
      const { db, agentRuns, agentOutputs } = await import("@committee/db");
      await db.transaction(async (tx) => {
        await tx.insert(agentRuns).values({
          id: runId,
          symbol: input.symbol,
          timeframe: input.timeframe,
          decisionTs: new Date(input.decisionTs),
          status,
          finishedAt: new Date(),
        });

        if (outputs.length > 0) {
          await tx.insert(agentOutputs).values(
            outputs.map((output) => ({
              runId,
              agent: output.agent,
              direction: output.direction,
              // numeric columns are string-typed in Drizzle
              confidence: String(output.confidence),
              rationale: output.rationale,
              raw: output,
            })),
          );
        }
      });
    },
  };
}

/**
 * Default persistence resolution used by `runAgents` when the caller says
 * nothing. Returns `null` (= skip writes) when no `DATABASE_URL` is configured,
 * so unit tests and offline dev runs still complete end-to-end.
 */
export function resolveDefaultPersistence(): AgentRunStore | null {
  return process.env.DATABASE_URL ? createDbPersistence() : null;
}

