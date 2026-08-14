export {
  evaluateConsensus,
  type ConsensusEvaluation,
} from "./consensus.js";

export {
  DEBATE_SYSTEM_PROMPT,
  DEBATE_TOOL_NAME,
  buildDebateUserPrompt,
  debateOutputToolSchema,
  normalizeDebateOutput,
  type DebatePromptContext,
} from "./prompt.js";

export {
  DebateSynthesizer,
  type DebateSynthesizerOptions,
} from "./debate.js";

export {
  DecisionLineageRecorder,
  type RecordDecisionParams,
} from "./lineage.js";

export {
  MultiAgentCoordinator,
  type CoordinatorOptions,
} from "./coordinator.js";

export {
  MultiAgentCoordinatorStrategy,
  type MultiAgentCoordinatorStrategyOptions,
} from "./strategy.js";
