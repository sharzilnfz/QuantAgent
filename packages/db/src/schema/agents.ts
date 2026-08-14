import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import {
  timeframeEnum,
  agentNameEnum,
  directionEnum,
  runStatusEnum,
} from "./enums";
import type { AgentOutputPayload } from "../types";

/**
 * L2 agent execution records.
 *
 * `agent_runs.decision_ts` is THE point-in-time boundary for the whole
 * pipeline: no input row with `as_of > decision_ts` is legal for a run. Every
 * downstream query reads against this clock (`WHERE as_of <= decision_ts`).
 */

export const agentRuns = pgTable(
  "agent_runs",
  {
    // the replayable run id
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol").notNull(),
    timeframe: timeframeEnum("timeframe").notNull(),
    // POINT-IN-TIME BOUNDARY: no input with as_of > decision_ts is legal.
    decisionTs: timestamp("decision_ts", { withTimezone: true }).notNull(),
    status: runStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("agent_runs_decision_ts_idx").on(t.decisionTs)],
);

/**
 * One row per agent opinion in a run. Shape mirrors the contracts `AgentOutput`
 * Zod schema (spec 02 §4) — keep them in lockstep. `raw` stores the validated
 * schema payload.
 */
export const agentOutputs = pgTable(
  "agent_outputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    agent: agentNameEnum("agent").notNull(),
    direction: directionEnum("direction").notNull(),
    // confidence in [0,1]
    confidence: numeric("confidence").notNull(),
    rationale: text("rationale").notNull(),
    // the validated AgentOutput payload
    raw: jsonb("raw").$type<AgentOutputPayload>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agent_outputs_run_id_idx").on(t.runId)],
);
