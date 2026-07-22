/**
 * Placeholders for later-sprint tables. Intentionally EMPTY for Sprint 1 — the
 * core tables (users, sessions, alpaca_credentials, watchlist_items,
 * price_bars, indicator_snapshots, agent_runs, agent_outputs) are complete now;
 * these are added when their features land.
 *
 * TODO(sprint-2): debate_rounds, debate_messages, risk_decisions
 * TODO(sprint-3): allocations, orders, memory_short, memory_episodic,
 *                 memory_long, reflections, reports
 *
 * When implementing, remember the cross-cutting laws:
 *  - risk_decisions / allocations / orders are DECISION tables → reference the
 *    `agent_runs.decision_ts` window; any fact they read must have
 *    `as_of <= decision_ts`.
 *  - memory_* long-term tables use a `pgvector` `vector` column (extension is
 *    already enabled by the first migration).
 */

export {};
