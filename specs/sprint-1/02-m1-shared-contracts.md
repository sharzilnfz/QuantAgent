# 02 — Shared Contracts Package / Zod Schemas (M1, cross-cutting)

> The single source of truth for the validated schemas every agent input and output must satisfy, plus
> the signal/portfolio shapes the UI and quant service consume. Raw model text is untrusted until it
> parses against these.
> PRD user stories: #13, #43, #12.

## 1. Context & Goal

The PRD requires that "all agent inputs/outputs follow a consistent, validated schema so agents are
interchangeable and testable." That schema layer is a hard prerequisite for the agent framework (06),
the technical agent (07), and the dashboard's rendering of agent output (08). It is split into its own
tiny package so those three specs build against a stable, ownable contract instead of racing to define
shapes ad hoc. Own it early, keep it small, version changes deliberately.

"Done" means: `packages/contracts` exports Zod schemas + inferred TS types for agent I/O and signals,
these round-trip cleanly, and both `apps/api` and `apps/web` import them.

## 2. Scope

**In scope**
- `AgentInput`, `AgentOutput`, per-agent extensions, `IndicatorSnapshot`, `PriceBar`, `PortfolioState`
  Zod schemas + inferred types.
- A JSON-Schema export of `AgentOutput` (derive via `zod-to-json-schema`) so the LLM call in spec 07
  can request structured output and the quant service can validate too.
- Shared enums (`Direction`, `AgentName`, `Timeframe`) — one definition, imported everywhere.

**Non-goals**
- No DB models (spec 01 owns Drizzle; keep field names aligned but do not import db here).
- No debate/risk/allocation schemas yet — add them in Sprint 2 when those features land. Leave a clearly
  marked placeholder section so the extension point is obvious.
- No network code, no LLM code.

## 3. Dependencies

- None to *start* (pure schema package). Coordinate field names with spec 01's `agent_outputs` /
  `price_bars` / `indicator_snapshots` so DB rows and validated payloads stay isomorphic.

## 4. Interface & Contracts

Package `packages/contracts`, export Zod schemas and `z.infer` types:

```ts
export const Direction = z.enum(["bullish", "bearish", "neutral"]);
export const AgentName = z.enum(["technical", "sentiment", "fundamental"]);
export const Timeframe = z.enum(["1Day", "1Hour"]);

export const PriceBar = z.object({
  symbol: z.string(), timeframe: Timeframe,
  ts: z.string().datetime(), open: z.number(), high: z.number(),
  low: z.number(), close: z.number(), volume: z.number(),
  asOf: z.string().datetime(),
});

export const IndicatorSnapshot = z.object({
  symbol: z.string(), timeframe: Timeframe, ts: z.string().datetime(),
  rsi: z.number().nullable(), macd: z.number().nullable(), macdSignal: z.number().nullable(),
  bbUpper: z.number().nullable(), bbLower: z.number().nullable(),
  sma20: z.number().nullable(), sma50: z.number().nullable(),
  asOf: z.string().datetime(),
});

// What the orchestrator hands an agent. Bounded to what is knowable at decisionTs.
export const AgentInput = z.object({
  runId: z.string().uuid(), symbol: z.string(), timeframe: Timeframe,
  decisionTs: z.string().datetime(),
  bars: z.array(PriceBar),               // as_of <= decisionTs, enforced upstream
  indicators: IndicatorSnapshot.nullable(),
  memory: z.unknown().optional(),        // filled in Sprint 3
});

// What every agent MUST return. Untrusted model text is parsed against this.
export const AgentOutput = z.object({
  agent: AgentName,
  direction: Direction,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(2000),
  // agent-specific evidence the LLM narrated over (never numbers it invented):
  evidence: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
});

export const PortfolioState = z.object({
  cash: z.number(), equity: z.number(),
  positions: z.array(z.object({ symbol: z.string(), qty: z.number(), marketValue: z.number(), unrealizedPl: z.number() })),
  asOf: z.string().datetime(),
});

export type AgentOutput = z.infer<typeof AgentOutput>;
// ...inferred types for each schema
export const AgentOutputJsonSchema = zodToJsonSchema(AgentOutput, "AgentOutput");
```

**Contract-change protocol:** any edit to `AgentOutput`/`AgentInput` is a cross-team event. Bump a
`CONTRACTS_VERSION` const, note it in this spec's changelog, and ping owners of specs 01/06/07/08.

## 5. Implementation notes

- Keep timestamps as ISO strings at the contract boundary (JSON-safe across the TS↔Python seam);
  convert to `Date`/`timestamptz` only inside each service.
- `confidence` is always `[0,1]`. Bound `rationale` length so a runaway LLM response can't bloat storage.
- `evidence` is the anti-hallucination hook: the technical agent (07) fills it with the *already-computed*
  indicator values it reasoned over, so a reviewer can check narration against facts.
- Ship as a buildable TS package with its own `tsconfig`; export both ESM types and the JSON-schema.

## 6. Acceptance criteria

- [ ] `packages/contracts` builds and is importable by `apps/api` and `apps/web`.
- [ ] `AgentOutput.parse()` rejects `confidence` outside `[0,1]`, empty `rationale`, unknown `direction`.
- [ ] `AgentOutputJsonSchema` is exported and valid JSON Schema.
- [ ] Field names match spec 01's `agent_outputs`/`price_bars`/`indicator_snapshots` (documented mapping).
- [ ] A clearly marked placeholder exists for Sprint 2 debate/risk schemas.

## 7. Tests

- Round-trip: `AgentOutput.parse(validPayload)` succeeds; each of {bad confidence, empty rationale,
  bad enum} throws.
- `zodToJsonSchema` output validates a known-good payload via a JSON-schema validator (parity with Zod).
- Type-level: `z.infer<typeof AgentOutput>` assignable to the DB insert type from spec 01 (compile check).

## 8. Files & Definition of Done

- `packages/contracts/`: `src/index.ts`, `src/agents.ts`, `src/signals.ts`, `src/portfolio.ts`,
  `tests/`, `package.json`, `tsconfig.json`.
- **DoD:** builds, tests green, exported types consumed by at least one other package, contract-change
  protocol documented. Merged to a feature branch off `main`.
