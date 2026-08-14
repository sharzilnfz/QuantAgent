/**
 * L2 agent framework (spec 06) + the technical analyst agent (spec 07).
 *
 * Public surface for the rest of the API and for downstream teams:
 *
 *   import { runAgents, StubTechnicalAgent, TechnicalAgent } from "./agents/index.js";
 *
 * Adding a new specialist agent = subclass `BaseAgent`, implement `run()`, inject it.
 * The runner is generic and knows nothing about any particular agent.
 */

export {
  BaseAgent,
  NO_OPINION,
  DEFAULT_AGENT_TIMEOUT_MS,
  defaultAgentLogger,
  type Agent,
  type AgentLogRecord,
  type BaseAgentOptions,
  type NoOpinionReason,
  type StructuredLogger,
} from "./base.js";

export {
  runAgents,
  type RunAgentsOptions,
  type RunAgentsResult,
} from "./runner.js";

export {
  createDbPersistence,
  resolveDefaultPersistence,
  type AgentRunStore,
  type AgentRunStatus,
} from "./persistence.js";

export {
  StubTechnicalAgent,
  StubSentimentAgent,
  StubFundamentalAgent,
} from "./stubs/index.js";

export * from "./technical/index.js";
export {
  SentimentAgent,
  SentimentTelemetry,
  InMemoryNewsProvider,
  FixtureNewsProvider,
  resolveDefaultNewsProvider,
  classifySentimentHeadlines,
  classifyHeadlines,
  SENTIMENT_SYSTEM_PROMPT,
  buildSentimentUserPrompt,
  sentimentOutputToolSchema,
  normalizeSentimentModelOutput,
  type SentimentAgentOptions,
  type SentimentTelemetrySnapshot,
  type NewsProvider,
  type NewsQuery,
  type SentimentClassification,
  type SentimentPromptContext,
} from "./sentiment/index.js";

export * from "./coordinator/index.js";
export * from "./polymarket/index.js";

export { agentsPlugin } from "./plugin.js";
