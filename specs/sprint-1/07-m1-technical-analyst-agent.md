# 07 — Technical Analyst Agent (M1, L2)

> The first *real* agent: it reads deterministically-computed indicators (never raw price it re-derives)
> and emits a schema-valid bias + confidence + rationale. Proves the whole spine — data → signal →
> agent → validated output — end to end.
> PRD user stories: #16, #13, #7, #8.

## 1. Context & Goal

This is the walking skeleton's payoff: a genuine agent producing real output the dashboard can render.
It is deliberately the *technical* agent because its inputs are fully deterministic (indicators from
spec 05), which lets it showcase the **facts-vs-narration law** cleanly — the LLM narrates and forms a
bias over numbers that code computed; it never invents a number.

"Done" means: given a symbol + decision timestamp, the agent fetches the point-in-time indicator
snapshot, forms a `bullish/bearish/neutral` bias with a `[0,1]` confidence, and returns a validated
`AgentOutput` whose `evidence` contains the exact indicator values it reasoned over.

## 2. Scope

**In scope**
- A `TechnicalAgent extends BaseAgent` (spec 06) with `name:"technical"`.
- Fetch the latest `indicator_snapshot` for the symbol/timeframe with `as_of <= input.decisionTs`
  (point-in-time). If none exists, return `NO_OPINION` (neutral) — never fabricate.
- **A deterministic pre-classifier in code** that derives a candidate bias + base confidence from the
  indicators (e.g., RSI zones, MACD cross sign, price vs. Bollinger/SMA). This is the "facts" the LLM is
  handed — the numbers and the mechanical read are computed, not invented.
- **One LLM call** (`claude-haiku-4-5`, cheap tier) that narrates a rationale and may adjust/confirm the
  bias, constrained to structured output validated against `AgentOutput` (spec 02).
- Populate `evidence` with the actual indicator values used, so a reviewer can check narration vs. facts.

**Non-goals**
- Sentiment/fundamental agents — Sprint 2.
- Debate/consensus — Sprint 2 (this agent just returns its output to the runner).
- Memory — Sprint 3.
- Any trade action.

## 3. Dependencies

- Spec **06** (`BaseAgent`, runner, `NO_OPINION`).
- Spec **02** (`AgentInput`/`AgentOutput` + JSON schema for structured output).
- Spec **05** (`indicator_snapshots` populated) and spec **04** (bars behind them).
- `ANTHROPIC_API_KEY` env; `@anthropic-ai/sdk`.

## 4. Interface & Contracts

- Implements `run(input: AgentInput): Promise<AgentOutput>` per spec 06.
- Returns `AgentOutput` with `agent:"technical"`, and `evidence` including e.g.
  `{ rsi, macd, macdSignal, bbUpper, bbLower, sma20, sma50, close, rule: "rsi_oversold+macd_bull_cross" }`.
- The LLM call requests structured JSON matching `AgentOutputJsonSchema`; the raw response is parsed with
  `AgentOutput.parse` — parse failure → one retry → `NO_OPINION`, never a crash.

## 5. Implementation notes

- **Facts vs. narration (the whole point):** compute the indicator read in TS (RSI<30 → oversold lean,
  MACD line crossing above signal → bullish lean, close below lower band → mean-reversion lean, etc.).
  Hand those computed facts to the model. The model's job is to *weigh and explain*, not to compute or
  recall numbers. Any number in the rationale must also appear in `evidence`.
- **Point-in-time:** only read the snapshot whose `as_of <= decisionTs`; pick the latest such. If the
  input already carries `indicators` (from the orchestrator), prefer that and assert its `asOf` is legal.
- **Confidence** blends the mechanical signal strength with the model's stated conviction, clamped to
  `[0,1]`. Document the blend; keep it explainable.
- **Cost/determinism for tests:** the LLM client must be injectable/mockable so CI uses a recorded
  response (no live API, no flake, no budget burn) — matches the PRD's mocked-LLM test strategy.
- Cheap tier model id `claude-haiku-4-5`; verify current id at build time (see `claude-api` skill).

## 6. Acceptance criteria

- [ ] Given a symbol with a valid point-in-time snapshot, returns a schema-valid `AgentOutput`
      (`direction` ∈ enum, `confidence` ∈ [0,1], non-empty `rationale`).
- [ ] `evidence` contains the actual indicator values used; every number in `rationale` is present in
      `evidence` (no invented figures).
- [ ] Reads only snapshots with `as_of <= decisionTs`; no future data influences the output.
- [ ] Missing snapshot → `NO_OPINION` neutral, not a fabricated bias.
- [ ] Malformed LLM output is retried once then falls back to neutral; never crashes the run.
- [ ] Runs through spec 06's `runAgents` and persists to `agent_outputs`.

## 7. Tests (Vitest, mocked LLM)

- Schema-validity test against fixed indicator inputs (assert bounds, not exact wording — per PRD).
- **Facts-vs-narration test:** with a mocked LLM that tries to state an RSI value different from the
  computed one, assert the returned `evidence.rsi` equals the computed value (facts win; narration can't
  overwrite computed numbers).
- Point-in-time test: an input whose only newer snapshot has `as_of > decisionTs` is ignored; the agent
  uses the legal earlier one (or NO_OPINION if none).
- Plausible-bounds test: strongly oversold+bullish-cross inputs lean bullish; strongly overbought lean
  bearish (direction is sane given inputs).
- Fallback test: malformed mocked response → neutral, run intact.

## 8. Files & Definition of Done

- `apps/api/src/agents/technical/`: `agent.ts`, `classify.ts` (deterministic read), `prompt.ts`,
  `llm-client.ts` (injectable), `tests/` (+ recorded LLM fixture).
- **DoD:** real schema-valid output on live-ish inputs, facts-vs-narration enforced and tested, PIT
  respected, mocked-LLM tests green, integrates with the runner. Merged to a feature branch off `main`.
