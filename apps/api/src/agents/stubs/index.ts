/**
 * Spec 06 §2 — stub agents.
 *
 * These exist so M2–M4 (dashboard, watchlist, risk gate) can build against the real
 * pipeline shape on day one instead of waiting on the LLM agents. They are:
 *
 *   - DETERMINISTIC   — same input, same output, forever. No clocks, no randomness.
 *   - DEPENDENCY-FREE — no LLM, no network, no database. Safe in any test.
 *   - SCHEMA-VALID    — they still go through `AgentOutput.parse` in `BaseAgent`,
 *                       so the validation seam is exercised from day one.
 *
 * They are interchangeable with the real agents: same `Agent` interface, same runner.
 */
export { StubTechnicalAgent } from "./technical.js";
export { StubSentimentAgent } from "./sentiment.js";
export { StubFundamentalAgent } from "./fundamental.js";
export { seededUnitInterval } from "./seed.js";
