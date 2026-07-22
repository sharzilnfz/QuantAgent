import { randomUUID } from "node:crypto";
import { AgentOutput, type AgentInput } from "@committee/contracts";

import {
  NO_OPINION,
  defaultAgentLogger,
  type Agent,
  type StructuredLogger,
} from "./base.js";
import {
  resolveDefaultPersistence,
  runRecordFromInput,
  type AgentRunPersistence,
} from "./persistence.js";

/**
 * Spec 06 §4 — the mini-orchestrator.
 *
 * `runAgents` is deliberately generic: it knows nothing about any specific agent.
 * Agents are injected. In Sprint 2 this grows into the full L3 pipeline; for now
 * it must only fan out, isolate failures, validate, persist, and log.
 *
 * Guarantees:
 *   - agents run IN PARALLEL (`Promise.allSettled`) — a slow agent never serialises
 *     the others, and a throwing agent never aborts the run;
 *   - every returned output has passed `AgentOutput.parse`;
 *   - a failed/timed-out agent contributes `NO_OPINION`, and the run still completes;
 *   - `runId` is the replayable id and keys every structured log line;
 *   - persistence is injectable/skippable, so the resilience tests run without Postgres.
 */

export interface RunAgentsOptions {
  /** Per-agent wall-clock budget forwarded to agents that accept one. */
  timeoutMs?: number;
  /**
   * `undefined` -> use the default (Postgres when `DATABASE_URL` is set, else skip).
   * `null`      -> explicitly skip all writes (unit tests, dry runs).
   */
  persistence?: AgentRunPersistence | null;
  logger?: StructuredLogger;
  /** Supply a run id (replay / test determinism). Defaults to a fresh uuid. */
  runId?: string;
}

export interface RunAgentsResult {
  /** The replayable run id. Also the `agent_runs.id` primary key. */
  runId: string;
  outputs: AgentOutput[];
}

export async function runAgents(
  input: Omit<AgentInput, "runId">,
  agents: Agent[],
  opts: RunAgentsOptions = {},
): Promise<RunAgentsResult> {
  const runId = opts.runId ?? randomUUID();
  const log = opts.logger ?? defaultAgentLogger;
  const persistence =
    opts.persistence === undefined ? resolveDefaultPersistence() : opts.persistence;

  const startedAt = Date.now();
  let persistenceHealthy = true;

  log({
    event: "agent_run.start",
    runId,
    symbol: input.symbol,
    decisionTs: input.decisionTs,
    agentCount: agents.length,
    persisted: persistence !== null,
  });

  if (persistence) {
    try {
      await persistence.createRun(runRecordFromInput(runId, input));
    } catch (err) {
      // A dead DB must not take the run down — degrade to in-memory.
      persistenceHealthy = false;
      log({
        event: "agent_run.persist_failed",
        runId,
        outcome: "error",
        detail: describe(err),
      });
    }
  }

  const fullInput: AgentInput = { ...input, runId };

  // FAN OUT. allSettled, never `all` — one rejection must not cancel the rest.
  const settled = await Promise.allSettled(
    agents.map((agent) => agent.analyze(fullInput)),
  );

  const outputs: AgentOutput[] = settled.map((result, i) => {
    const agentName = agents[i]?.name ?? "technical";

    if (result.status === "rejected") {
      // BaseAgent already swallows failures; this covers agents that bypass it.
      log({
        event: "agent_run.agent_rejected",
        runId,
        agent: agentName,
        outcome: "error",
        detail: describe(result.reason),
      });
      return NO_OPINION(agentName, "error");
    }

    // Belt-and-braces: revalidate at the runner boundary so nothing unvalidated
    // can reach persistence or the caller, even from a hand-rolled Agent.
    const validated = AgentOutput.safeParse(result.value);
    if (!validated.success) {
      log({
        event: "agent_run.agent_invalid",
        runId,
        agent: agentName,
        outcome: "invalid",
        detail: validated.error.issues.map((issue) => issue.path.join(".")).join(","),
      });
      return NO_OPINION(agentName, "error");
    }
    return validated.data;
  });

  if (persistence && persistenceHealthy) {
    const writes = await Promise.allSettled(
      outputs.map((output) => persistence.saveOutput(runId, output)),
    );
    for (const write of writes) {
      if (write.status === "rejected") {
        persistenceHealthy = false;
        log({
          event: "agent_run.persist_failed",
          runId,
          outcome: "error",
          detail: describe(write.reason),
        });
      }
    }

    try {
      await persistence.finishRun(runId, persistenceHealthy ? "completed" : "failed");
    } catch (err) {
      log({
        event: "agent_run.persist_failed",
        runId,
        outcome: "error",
        detail: describe(err),
      });
    }
  }

  log({
    event: "agent_run.finish",
    runId,
    symbol: input.symbol,
    decisionTs: input.decisionTs,
    durationMs: Date.now() - startedAt,
    outcome: "ok",
    neutralCount: outputs.filter((o) => o.direction === "neutral").length,
  });

  return { runId, outputs };
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
