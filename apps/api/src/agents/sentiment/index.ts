export {
  SentimentAgent,
  blendConfidence,
  type SentimentAgentOptions,
} from "./agent.js";

export {
  SentimentTelemetry,
  type SentimentTelemetrySnapshot,
} from "./telemetry.js";

export {
  InMemoryNewsProvider,
  FixtureNewsProvider,
  resolveDefaultNewsProvider,
  type NewsProvider,
  type NewsQuery,
} from "./news-provider.js";

export {
  classifySentimentHeadlines,
  classifyHeadlines,
  type SentimentClassification,
} from "./classify.js";

export {
  AGENT_OUTPUT_TOOL_NAME,
  SENTIMENT_SYSTEM_PROMPT,
  buildSentimentUserPrompt,
  sentimentOutputToolSchema,
  normalizeSentimentModelOutput,
  type SentimentPromptContext,
} from "./prompt.js";
