import type { AgentInput, AgentOutput } from "@quantagent/shared";
import { AgentOutputSchema } from "@quantagent/shared";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { agentRuns, agentOutputs } from "../../db/schema.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("agent-framework");

// ─── Base Agent ─────────────────────────────────────────────────────────────

/**
 * Abstract base class that every agent must extend.
 * Subclasses implement `analyze()` with their domain logic.
 */
export abstract class BaseAgent {
  abstract readonly name: string;

  /**
   * Core analysis method. Receives validated input with point-in-time
   * boundary and must return a schema-valid AgentOutput.
   */
  abstract analyze(input: AgentInput): Promise<AgentOutput>;
}

// ─── Agent Registry ─────────────────────────────────────────────────────────

const registry = new Map<string, BaseAgent>();

/** Register an agent instance by name. */
export function registerAgent(agent: BaseAgent) {
  if (registry.has(agent.name)) {
    logger.warn({ agent: agent.name }, "Agent already registered — replacing");
  }
  registry.set(agent.name, agent);
  logger.info({ agent: agent.name }, "Agent registered");
}

/** Look up a registered agent by name. */
export function getAgent(name: string): BaseAgent | undefined {
  return registry.get(name);
}

/** List all registered agent names. */
export function listAgents(): string[] {
  return Array.from(registry.keys());
}

// ─── Execution Wrapper ──────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 10_000; // 10 seconds
const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = 500;

interface ExecutionOptions {
  userId: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Execute an agent with:
 * - Timeout enforcement
 * - Retry with exponential backoff
 * - Zod validation of output
 * - Persistence of run + output to DB
 * - Structured logging
 */
export async function executeAgent(
  agentName: string,
  input: AgentInput,
  opts: ExecutionOptions
): Promise<AgentOutput> {
  const agent = getAgent(agentName);
  if (!agent) {
    throw new Error(`Agent "${agentName}" not found in registry`);
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? MAX_RETRIES;

  // Create agent_run record
  const [run] = await db
    .insert(agentRuns)
    .values({
      userId: opts.userId,
      agentName,
      symbol: input.symbol,
      decisionAsOf: new Date(input.decisionAsOf),
    })
    .returning();

  logger.info(
    { runId: run.id, agent: agentName, symbol: input.symbol },
    "Agent run started"
  );

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Run with timeout
      const output = await Promise.race([
        agent.analyze(input),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Agent timeout after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ]);

      // Validate output against Zod schema
      const validated = AgentOutputSchema.parse(output);

      // Mark run as success
      await db
        .update(agentRuns)
        .set({ status: "success", finishedAt: new Date() })
        .where(eq(agentRuns.id, run.id));

      // Persist output
      await db.insert(agentOutputs).values({
        agentRunId: run.id,
        symbol: validated.symbol,
        bias: validated.bias,
        confidence: String(validated.confidence),
        rationale: validated.rationale,
        features: validated.features,
        asOf: new Date(validated.asOf),
        schemaVersion: validated.schemaVersion,
      });

      logger.info(
        {
          runId: run.id,
          agent: agentName,
          bias: validated.bias,
          confidence: validated.confidence,
        },
        "Agent run completed"
      );

      return validated;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        { runId: run.id, attempt, err: lastError.message },
        "Agent execution attempt failed"
      );

      if (attempt < maxRetries) {
        await new Promise((r) =>
          setTimeout(r, RETRY_BACKOFF_MS * Math.pow(2, attempt))
        );
      }
    }
  }

  // All retries exhausted — mark as error
  await db
    .update(agentRuns)
    .set({
      status: "error",
      error: lastError?.message ?? "Unknown error",
      finishedAt: new Date(),
    })
    .where(eq(agentRuns.id, run.id));

  logger.error(
    { runId: run.id, agent: agentName, error: lastError?.message },
    "Agent run failed after all retries"
  );

  throw lastError!;
}
