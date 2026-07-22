# 06 — Agent Framework & Base Interface + Stub Agents (M1, L2)

> The base abstraction every specialist agent implements, the machinery that validates their output
> against the schema, isolates their failures, and logs every run — shipped with **stub/mock agents on
> day one** so downstream work (dashboard, watchlist, risk gate) isn't blocked on the real agents.
> PRD user stories: #13, #43, #45, #44.

## 1. Context & Goal

The guide names the agent framework as the project's single-point-of-failure risk: if M1 is late,
M2–M4 stall. The mitigation is explicit — ship the interface **plus working stub agents immediately**,
so the pipeline shape (run → agents → outputs, with failure isolation and logging) is real and testable
before any LLM agent lands. Spec 07 (technical agent) and every Sprint 2 agent slot into this frame.

"Done" means: an `Agent` interface + a runner exist; stub agents return schema-valid `AgentOutput`;
a timed-out/throwing agent yields a neutral "no opinion" instead of crashing the run; every run gets a
replayable id and structured log; results persist to `agent_runs`/`agent_outputs`.

## 2. Scope

**In scope**
- `Agent` base interface + a `BaseAgent` with shared concerns (timeout, schema validation, error →
  neutral, timing).
- An `AgentRunner`/mini-orchestrator that: creates an `agent_runs` row with a `decisionTs`, invokes one
  or more agents (parallel-capable), validates each `AgentOutput` against spec 02, persists to
  `agent_outputs`, and returns a structured result. (Full multi-agent debate/consensus is Sprint 2 —
  here the runner just needs to fan out and isolate failures.)
- **Stub agents**: `StubTechnicalAgent`, `StubSentimentAgent`, `StubFundamentalAgent` returning
  deterministic, schema-valid outputs (fixed or seeded-random within bounds). These are the interchange-
  able placeholders M2–M4 build against.
- Per-run structured logging keyed by `runId` (replayable).
- The **failure-isolation contract**: an agent that throws or exceeds its timeout produces
  `{direction:"neutral", confidence:0, rationale:"no opinion (timeout|error)"}` and the run continues.

**Non-goals**
- Real LLM agents (spec 07 = technical; Sprint 2 = sentiment/fundamental).
- Debate/consensus/synthesis (L3) — Sprint 2.
- Memory injection — Sprint 3 (leave `AgentInput.memory` unused but plumbed).

## 3. Dependencies

- Spec **02** (`AgentInput`/`AgentOutput` Zod schemas).
- Spec **01** (`agent_runs`/`agent_outputs` tables).

## 4. Interface & Contracts

```ts
export interface Agent {
  readonly name: AgentName;
  analyze(input: AgentInput): Promise<AgentOutput>;   // may throw / be slow — runner handles it
}

export abstract class BaseAgent implements Agent {
  abstract readonly name: AgentName;
  protected abstract run(input: AgentInput): Promise<AgentOutput>;
  // wraps run(): applies timeoutMs, validates via AgentOutput.parse, maps failure -> neutral
  async analyze(input: AgentInput): Promise<AgentOutput> { /* ... */ }
}

// The mini-orchestrator (extended into full pipeline in Sprint 2)
export async function runAgents(
  input: Omit<AgentInput,"runId">,
  agents: Agent[],
  opts?: { timeoutMs?: number }
): Promise<{ runId: string; outputs: AgentOutput[] }>;
```
- `runAgents` writes one `agent_runs` row (status lifecycle: running→completed/failed) and one
  `agent_outputs` row per agent, then returns. `runId` is the replayable id.
- Neutral fallback shape is a named constant `NO_OPINION(name)` so every failure path is identical.

## 5. Implementation notes

- **Timeout** via `Promise.race` against a configurable `timeoutMs`; on loss, emit `NO_OPINION`.
- **Validation** is mandatory: even a stub's output goes through `AgentOutput.parse` so the validation
  seam is exercised from day one (schema-first / untrusted-text law).
- Run agents in **parallel** with `Promise.allSettled` so one slow/failed agent can't block the others —
  this is the exact resilience the PRD tests demand.
- Structured logs: one line per agent with `runId`, `agent`, `durationMs`, `outcome`. No secrets.
- Keep the runner generic — it must not know anything technical-agent-specific. Agents are injected.

## 6. Acceptance criteria

- [ ] `Agent`/`BaseAgent` interface exists; a new agent is added by implementing `run()` only.
- [ ] Stub agents return schema-valid `AgentOutput` and pass `AgentOutput.parse`.
- [ ] `runAgents` persists an `agent_runs` row + one `agent_outputs` row per agent with a `runId`.
- [ ] A throwing agent and a timing-out agent each yield `NO_OPINION` and the run still **completes**.
- [ ] Every run emits structured logs keyed by `runId`; the run is replayable by id.
- [ ] Agents execute in parallel (a slow agent does not serialize the others).

## 7. Tests (Vitest)

- **Resilience test (required by PRD Testing Decisions):** inject an agent that throws and one that
  sleeps past the timeout; assert the run completes, both yield neutral output, and the other agents'
  real outputs are unaffected.
- Schema-enforcement test: an agent returning invalid output (bad confidence) is caught and mapped to
  neutral rather than propagating an unvalidated payload.
- Persistence test: after `runAgents`, `agent_runs` + N `agent_outputs` rows exist with the returned `runId`.
- Parallelism test: three agents each sleeping 100ms complete in ~100ms, not ~300ms.

## 8. Files & Definition of Done

- `apps/api/src/agents/`: `base.ts`, `runner.ts`, `stubs/*.ts`, `index.ts`, `tests/`.
- **DoD:** interface + runner + stubs merged, resilience and persistence tests green, downstream teams
  can import and run stub agents end-to-end. This unblocks specs 07 and 08. Merged to a feature branch
  off `main`.
