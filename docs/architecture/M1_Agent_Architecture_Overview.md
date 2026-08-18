# M1 (Sharzil) — Architecture Overview: The Agent Framework, Shared Contracts & Infrastructure

> Sprint 1 · The Committee (Multi-Agent Paper-Trading System)
> Member: `sharzilnfz` — Role M1, Agent Architecture Lead
> Scope: specs 02 (shared contracts), 06 (agent framework + stubs), 07 (technical analyst agent), Docker infrastructure

---

## 1. What was built

Three deliverables, mapped to specs 02, 06, 07 (all complete in Sprint 1):

### 1.1 `packages/contracts` (Spec 02) — the shared Zod contract package (19 passing tests)

- System enums: `Direction` (`bullish|bearish|neutral`), `AgentName` (`technical|sentiment|fundamental`), `Timeframe` (`1Day|1Hour`).
- `AgentInput` — runId (uuid), symbol, timeframe, `decisionTs`, bars, indicators, optional memory.
- `AgentOutput` — agent, direction, `confidence` in `[0,1]`, rationale (1–2000 chars), `evidence` record (the anti-hallucination hook).
- Signal/portfolio shapes: `IndicatorSnapshot`, `PriceBar`, `PortfolioState`.
- `AgentOutputJsonSchema` — zod-to-json-schema export; the bridge that feeds the LLM tool-calling layer.
- `CONTRACTS_VERSION = "1.0.0"` — the cross-team change protocol marker.
- Contract test suites: runtime behavior, JSON-Schema parity, and a compile-time DB-overlap test.

### 1.2 Agent Framework & Execution Engine (Spec 06, 23 files / 2,622 lines)

- `base.ts` — `BaseAgent` abstraction. `analyze()` **never rejects**: `Promise.race` timeout (20 s, `TIMEOUT` symbol) maps to `NO_OPINION(name,"timeout")`; every output passes `AgentOutput.parse`; anti-spoofing name check; structured JSON logs keyed by `runId`.
- `runner.ts` — `runAgents()` mini-orchestrator: parallel fan-out via `Promise.allSettled` (one slow/failed agent never blocks others), double-validation of returned outputs, persistence via an injectable `AgentRunPersistence` seam, graceful degradation when Postgres is down.
- `persistence.ts` — writes one `agent_runs` row (status lifecycle running → completed/failed) + one `agent_outputs` row per agent; lazy `@committee/db` import so the API boots DB-free.
- `stubs/` — deterministic, seeded placeholders (`StubTechnical`, `StubSentiment`, `StubFundamental`). FNV-1a-hash seeding over `(agent, symbol, decisionTs)` means identical inputs always produce byte-identical outputs — replayable, no LLM/network/DB.

### 1.3 Technical Analyst Agent (Spec 07) — the first real LLM agent

- `snapshots.ts` — point-in-time snapshot provider: the query applies `as_of <= decisionTs` — the PIT filter, never `>=`. Input-received snapshots whose `asOf` is after `decisionTs` are rejected (`technical.pit_violation_rejected`).
- `classify.ts` — pure-TypeScript deterministic classifier: RSI zones, MACD cross, Bollinger, SMA20/50 rules with fixed weights; produces a `MechanicalRead` (direction, strength, score, coverage, rule) — the "facts" side of facts-vs-narration.
- `llm-client.ts` — injectable `LlmClient` interface with implementations: `AnthropicLlmClient` (SDK, forced tool use), `OpenAiCompatibleLlmClient` / `OpenRouterLlmClient`, `GeminiLlmClient` (Google Gemini Free API), `FallbackLlmClient` (automatic zero-cost fallback chaining), and `ScriptedLlmClient` (test double for mocked-LLM CI).
- `prompt.ts` — system prompt enforcing "enforced by code, not trust"; unwraps `AgentOutputJsonSchema` into the tool `input_schema` (single source of truth with Zod).
- `agent.ts` — 5-step pipeline: PIT snapshot → deterministic classify → ONE cheap-tier LLM call (`claude-haiku-4-5`) → validation with exactly one retry → output assembly. `evidence = {...model, ...computed}` — **computed facts are spread last, so a lying model can never overwrite them**. `blendConfidence()` mixes mechanical strength with narration confidence and halves conviction when the model disagrees with the rules.

### 1.4 Docker & LLM infrastructure (infra commits)

- `docker-compose.yml` — multi-container setup: `api:3000`, `web:5173`, `quant:8000`, `postgres` (pgvector/pgvector:pg17-alpine) with named volume, health checks, and auto-migrate + seed on container start.
- Native OpenRouter support with `ANTHROPIC_BASE_URL` override in `config.ts`.
- Sprint 1 Excalidraw class diagram (`specs/sprint-1/00-class-diagram*`).

---

## 2. Files changed (git: commits `2dc7f73`, `0b22a16`, `2b6212d`, `1d49c28`, infra commits)

```
packages/contracts/{package.json, tsconfig.json, src/{index,enums,signals,agents,portfolio}.ts, tests/{agents,jsonschema,types}.test.ts}
apps/api/src/agents/{base,runner,persistence,plugin,index}.ts
apps/api/src/agents/stubs/{index,seed,technical,sentiment,fundamental}.ts
apps/api/src/agents/technical/{agent,classify,llm-client,prompt,snapshots,index}.ts
apps/api/tests/{agents.helpers.ts, agents.base.test.ts, agents.runner.test.ts, agents.stubs.test.ts, agents.persistence.db.test.ts, technical.agent.test.ts, technical.classify.test.ts}
docker-compose.yml, apps/api/Dockerfile, apps/api/src/config.ts, .env.example
```

---

## 3. Architecture — how the agent chain flows

```
DB (pgvector) ── indicator_snapshots (M2 writes) ──▶ SnapshotProvider (PIT filter as_of <= decision_ts)
                                                    │
POST /agents/run (auth-required) ──▶ runAgents() ──▶ [TechnicalAgent]
                                                     │      ├─ classify() → MechanicalRead (code-computed facts)
                                                     │      ├─ LLM narration (1 cheap call, 1 retry on malformed)
                                                     │      └─ evidence: {...model, ...computed} — facts win
                                                     ├─ AgentOutput.parse (twice: BaseAgent + runner boundary)
                                                     └─ agent_runs / agent_outputs rows (decision_ts = run-wide PIT boundary)

GET /agents/latest ──▶ raw jsonb outputs for the web dashboard
```

---

## 4. Overlap with other members

| Member | Surface | Relationship |
|---|---|---|
| **M4 (ironhead2002, DB/auth)** | `agent_runs`/`agent_outputs` tables, `requireAuth` seam | Deepest overlap. `persistence.ts` writes rows whose columns line up 1:1 with M4's Drizzle schema (camel↔snake). The full validated `AgentOutput` is stored verbatim in the `raw` jsonb. Route registration happens after `authPlugin`. |
| **M2 (afnan, ingest/quant)** | `indicator_snapshots` | The technical agent reads snapshots written by the Python quant service through the shared DB — no HTTP seam needed. Cross-language contract (camelCase + ISO timestamps) is duplicated by hand in Python and validated Zod-side. Known gap: `QUANT_SERVICE_URL` declared in config but never consumed. |
| **M3 (capitalD10, web)** | `@committee/contracts` import, `/agents/latest` | `AgentActivityCard` renders `AgentOutput` with schemas parsed at the API boundary. Web consumes the read side only; nothing triggers `/agents/run` from the UI. |
| **M1 ↔ M2/M4 conflict** | contracts/db isomorphism | No shared files; overlap is purely contract + PIT timestamp convention and shared DB tables. `packages/db` deliberately never imports contracts — isomorphism is guarded by tests only (`contracts/tests/types.test.ts`, `db/tests/schema-shape.test.ts`). |

---

## 5. Laws the code enforces (non-negotiable)

1. **Schema-first / untrusted model text** — every output passes `AgentOutput.parse`; failure → handled neutral, never a crash.
2. **Point-in-time discipline** — `as_of <= decisionTs` on every snapshot read; illegal inputs rejected, never clamped.
3. **Facts vs. narration** — the LLM weighs and explains; code computes RSI/MACD/Bollinger reads. Computed evidence always wins in the spread.
4. **Graceful degradation** — timeout/throw/parse-fail ⇒ `NO_OPINION` ("no opinion"), run finishes, 2622 lines of tests prove it.
5. **Every run logged** — structured JSON line per agent, keyed by replayable `runId`; caller-supplied runIds honored.