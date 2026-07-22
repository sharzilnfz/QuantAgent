import { AgentOutput, type AgentInput, type AgentName } from "@committee/contracts";

/**
 * Spec 06 §4 — the base agent abstraction.
 *
 * A new specialist agent is added by implementing `run()` ONLY. `BaseAgent.analyze()`
 * owns every shared concern:
 *
 *   1. timeout        — `Promise.race` against `timeoutMs`
 *   2. validation     — raw output is untrusted until `AgentOutput.parse` succeeds
 *   3. degradation    — any failure (throw / timeout / invalid schema) maps to `NO_OPINION`
 *   4. timing         — `durationMs` is reported to the structured logger
 *
 * Cross-cutting laws honoured here: #3 (schema-first / untrusted model text) and
 * #4 (graceful degradation — a failing agent never crashes a run).
 */

/** Default per-agent wall-clock budget. Overridable per agent and per run. */
export const DEFAULT_AGENT_TIMEOUT_MS = 20_000;

/** Why an agent produced no opinion. Rendered verbatim into the rationale. */
export type NoOpinionReason = "timeout" | "error";

/**
 * THE single neutral fallback shape. Every failure path in the framework returns
 * this — there is exactly one way for an agent to say "no opinion", so downstream
 * consumers (consensus, risk, UI) only have one case to handle.
 *
 * Spec 06 §4: `{direction:"neutral", confidence:0, rationale:"no opinion (timeout|error)"}`.
 */
export function NO_OPINION(
  name: AgentName,
  reason: NoOpinionReason = "error",
): AgentOutput {
  return {
    agent: name,
    direction: "neutral",
    confidence: 0,
    rationale: `no opinion (${reason})`,
    evidence: {},
  };
}

/** Spec 06 §4 — every L2 specialist implements this. */
export interface Agent {
  readonly name: AgentName;
  /** May throw or be slow — the runner/BaseAgent handles it. */
  analyze(input: AgentInput): Promise<AgentOutput>;
}

/**
 * One structured log record. Emitted as a single JSON line, keyed by `runId`
 * so a run is replayable by id (cross-cutting law #5).
 *
 * NEVER put secrets, credentials, or raw prompts in here.
 */
export interface AgentLogRecord {
  event: string;
  runId?: string;
  agent?: string;
  symbol?: string;
  decisionTs?: string;
  durationMs?: number;
  outcome?: "ok" | "timeout" | "error" | "invalid" | "skipped";
  detail?: string;
  [key: string]: unknown;
}

export type StructuredLogger = (record: AgentLogRecord) => void;

/** Default logger: one JSON line per event on stdout. No secrets, ever. */
export const defaultAgentLogger: StructuredLogger = (record) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...record }));
};

export interface BaseAgentOptions {
  timeoutMs?: number;
  logger?: StructuredLogger;
}

/** Internal marker so `analyze()` can tell a timeout from a thrown error. */
const TIMEOUT = Symbol("agent-timeout");

export abstract class BaseAgent implements Agent {
  abstract readonly name: AgentName;

  protected readonly timeoutMs: number;
  protected readonly logger: StructuredLogger;

  constructor(options: BaseAgentOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS;
    this.logger = options.logger ?? defaultAgentLogger;
  }

  /** Subclass hook. May throw, may be slow, may return garbage — all handled. */
  protected abstract run(input: AgentInput): Promise<AgentOutput>;

  /**
   * Wraps `run()` with timeout + validation + failure->neutral mapping.
   * This method never rejects.
   */
  async analyze(input: AgentInput): Promise<AgentOutput> {
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const emit = (outcome: NonNullable<AgentLogRecord["outcome"]>, detail?: string) => {
      this.logger({
        event: "agent.analyze",
        runId: input.runId,
        agent: this.name,
        symbol: input.symbol,
        decisionTs: input.decisionTs,
        durationMs: Date.now() - startedAt,
        outcome,
        ...(detail === undefined ? {} : { detail }),
      });
    };

    try {
      const timeout = new Promise<typeof TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT), this.timeoutMs);
      });

      const raced = await Promise.race([this.run(input), timeout]);

      if (raced === TIMEOUT) {
        emit("timeout", `exceeded ${this.timeoutMs}ms`);
        return NO_OPINION(this.name, "timeout");
      }

      // Untrusted until it parses. A stub's output goes through this too.
      const parsed = AgentOutput.parse(raced);

      if (parsed.agent !== this.name) {
        // An agent must not speak for another agent.
        emit("invalid", `agent name mismatch: got "${parsed.agent}"`);
        return NO_OPINION(this.name, "error");
      }

      emit("ok");
      return parsed;
    } catch (err) {
      emit("error", err instanceof Error ? err.message : String(err));
      return NO_OPINION(this.name, "error");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
