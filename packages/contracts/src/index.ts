/**
 * @committee/contracts — the cross-service source of truth for validated schemas.
 *
 * Exports Zod schemas + inferred TS types for shared enums, L0/L1 signals, L2 agent I/O,
 * and portfolio state, plus a JSON-Schema export of `AgentOutput`. Raw model text is
 * untrusted until it parses against these. Dependency-free of `@committee/db` by design.
 */

export * from "./enums";
export * from "./signals";
export * from "./agents";
export * from "./portfolio";
export * from "./backtest";
export * from "./experiment";

// ---------------------------------------------------------------------------
// PLACEHOLDER — Sprint 2 (L3 Consensus / L4 Risk).  DO NOT implement here yet.
// ---------------------------------------------------------------------------
// When the debate/consensus and risk features land, their Zod schemas live in this
// package alongside the L2 contracts above. Suggested extension points:
//
//   src/debate.ts   — DebateTranscript, ConsensusResult (2-of-3 + synthesis call)
//   src/risk.ts     — RiskAssessment, RiskRuleResult (deterministic rules engine)
//
// Add the corresponding `export * from "./debate";` / `export * from "./risk";` lines
// here when those files exist. Follow the contract-change protocol (bump CONTRACTS_VERSION)
// for any change that touches an already-shipped schema.
// ---------------------------------------------------------------------------
