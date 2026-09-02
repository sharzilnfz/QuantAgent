# 🎙️ Member 1 (Lead & Multi-Agent Architecture) — Live Demo Companion & Showcase Guide

**Role:** M1 Lead / Multi-Agent Architecture  
**GitHub:** `@sharzilnfz` | **Email:** `sharzilrs@gmail.com`  
**Domain Ownership:** Base Agent Framework, Multi-LLM Fallback Chaining, Consensus & Debate Synthesis, Macro Specialist (Polymarket), Decision Lineage DAG, Model Context Protocol (MCP) Server.

---

## ⚡ 0. Pre-Flight Setup (Terminal Cheatsheet)
Have these running in your terminal before sharing your screen:
```bash
# Terminal Pane 1: Start Full System (Fastify API on :3000, Vite React UI on :5173)
pnpm dev

# Terminal Pane 2: (Optional backup for instant code/test proof)
pnpm --filter @committee/api test
```

---

## 🏛️ Feature 1: Base Agent Framework, Fault-Tolerant Runner & Zod Contracts
- **Module Mapping:** Module 1 / Lab 5 (Foundation Architecture)
- **30-Second Pitch:**
  - Standardizes all AI agents through a strict abstract interface (`BaseAgent`) and runner pipeline (`AgentRunner`).
  - Treats LLM output as untrusted text: every completion is validated against strict Zod schemas with a 2-try retry loop.
  - **Fail-Safe Isolation:** If any model times out or generates malformed JSON, it gracefully falls back to `NO_OPINION` (`bias: neutral, confidence: 0.0`) without throwing HTTP 500 errors or crashing the trading loop.
- **Live Demo Action:**
  - Trigger `GET http://localhost:3000/agents/latest?symbol=AAPL` in browser or curl.
  - Show standardized JSON output conforming to `AgentRunEnvelope` with latency, token count, and validated confidence.
- **Files to Open in IDE:**
  - [`packages/contracts/src/agents.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/packages/contracts/src/agents.ts) — Strict Zod contracts (`AgentInputSchema`, `AgentOutputSchema`, `AgentRunEnvelopeSchema`).
  - [`apps/api/src/agents/base.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/base.ts) — Abstract `BaseAgent` class and `NO_OPINION()` fallback generator.
  - [`apps/api/src/agents/runner.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/runner.ts) — `AgentRunner.runAll()` with timeout isolation and retry logic.
- **Key Soundbite for Teacher:**
  > *"We isolate each agent execution. A single failing specialist agent cannot crash the committee or produce unhandled server errors."*

---

## 🔄 Feature 2: Technical & Sentiment Specialists with Multi-Provider Fallback Chaining
- **Module Mapping:** Module 2 / Lab 6 (Specialist Agents & Resilient LLM Inference)
- **30-Second Pitch:**
  - Implements specialized domain agents: **Technical Specialist** (parses Wilder RSI, MACD, Bollinger Bands) and **Sentiment Specialist** (parses financial news headlines).
  - **Facts vs. Narration Law:** Deterministic mathematical indicator calculations always override LLM hallucinations on collision.
  - **Multi-LLM Resiliency:** Implements `FallbackLlmClient` to sequentially failover across **Anthropic Claude $\to$ Google Gemini $\to$ OpenRouter $\to$ OpenAI** standard endpoints if rate-limits (429) or outages occur.
  - **Confidence Blending Formula:**
    $$\text{Confidence}_{\text{blended}} = \begin{cases} 0.5 \cdot \text{Strength}_{\text{rules}} + 0.5 \cdot \text{Conf}_{\text{model}} & \text{if } \text{Dir}_{\text{rules}} = \text{Dir}_{\text{model}} \\ 0.25 \cdot (\text{Strength}_{\text{rules}} + \text{Conf}_{\text{model}}) & \text{if } \text{Dir}_{\text{rules}} \neq \text{Dir}_{\text{model}} \end{cases}$$
- **Live Demo Action:**
  - Open `http://localhost:5173/signals`.
  - Point to the **Specialist Agent Stance Cards** showing real-time Technical vs Sentiment biases, confidence meters, and generated natural language rationales.
- **Files to Open in IDE:**
  - [`apps/api/src/agents/technical/agent.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/technical/agent.ts) — `TechnicalAgent` implementation and mathematical confidence blending.
  - [`apps/api/src/agents/technical/llm-client.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/technical/llm-client.ts) — Multi-provider fallback chain (`FallbackLlmClient`).
  - [`apps/api/src/agents/sentiment/agent.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/sentiment/agent.ts) — `SentimentAgent` headline reasoning.
- **Key Soundbite for Teacher:**
  > *"Confidence isn't purely hallucinated by the LLM: we mathematically blend algorithmic rule strength with model confidence, and protect uptime with an automated 4-provider fallback chain."*

---

## ⚖️ Feature 3: Consensus Short-Circuit & Conditional Debate Synthesis vs. Ablation
- **Module Mapping:** Module 3 / Lab 7 (Multi-Agent Consensus & Scientific Ablations)
- **30-Second Pitch:**
  - Eliminates unnecessary LLM compute costs: If all specialists agree (e.g. all bullish), the coordinator executes a **Consensus Short-Circuit** ($0 extra tokens).
  - When specialists clash (e.g. Technical is Bullish on momentum, but Sentiment is Bearish on negative earnings), an LLM **Debate Synthesizer** adjudicates the conflict, records dissenting views, and assigns weighted conviction.
  - **Scientific Ablation:** In "Debate OFF" mode, conflicting stances deterministically default to Cash preservation (`neutral`), proving the empirical alpha gained from debate synthesis.
- **Live Demo Action:**
  - Open `http://localhost:5173/observatory`.
  - Select the **Debate vs. Ablation** preset. Point out how **Multi-Agent (Debate ON)** outperforms **Multi-Agent (Ablation OFF)** across total return and Sharpe ratio.
- **Files to Open in IDE:**
  - [`apps/api/src/agents/coordinator/consensus.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/coordinator/consensus.ts) — `evaluateConsensus()` logic for the fast-path short-circuit.
  - [`apps/api/src/agents/coordinator/debate.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/coordinator/debate.ts) — `DebateSynthesizer.synthesize()` structured synthesis prompt.
  - [`packages/contracts/src/debate.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/packages/contracts/src/debate.ts) — `DebateSynthesis` contract schema.
- **Key Soundbite for Teacher:**
  > *"We don't call expensive LLMs for debate if there's no conflict. When there is conflict, structured debate produces higher risk-adjusted alpha than naive averaging or passive cash holding."*

---

## 🔍 Feature 4: Polymarket Macro Specialist & Immutable Decision Lineage DAG
- **Module Mapping:** Module 3 / Lab 7 (Prediction Markets & Complete Provenance Auditing)
- **30-Second Pitch:**
  - Integrates crowdsourced macroeconomic prediction market odds (FOMC interest rates, CPI inflation, recession probabilities) via `PolymarketAgent` strictly bounded by point-in-time constraints ($T_{\text{market}} \le T_{\text{decision}}$).
  - **Lineage DAG Recording:** Every single trade records a complete, tamper-proof forensic audit trail (market bars, indicators, news, exact LLM prompt sent, raw text received, and risk gate results).
- **Live Demo Action:**
  - Open `http://localhost:5173/lineage`.
  - Step through historical decisions with keyboard arrow keys (`←`/`→`).
  - Switch between the **Inputs**, **Debate**, and **Prompts & Completions** tabs, and click **Copy Prompt**.
- **Files to Open in IDE:**
  - [`apps/api/src/agents/polymarket/agent.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/polymarket/agent.ts) — `PolymarketAgent` Gamma API probability integration.
  - [`apps/api/src/agents/coordinator/lineage.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/coordinator/lineage.ts) — `DecisionLineageRecorder` recording engine.
  - [`packages/contracts/src/lineage.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/packages/contracts/src/lineage.ts) — `DecisionLineageRecord` contract.
- **Key Soundbite for Teacher:**
  > *"Black-box trading models are unacceptable in institutional finance. Our Lineage DAG gives complete forensic explainability down to the exact prompt tokens and probability curves."*

---

## 🤖 Feature 5: Multi-Round Adversarial Debate ($R=2$) & Model Context Protocol (MCP) Server
- **Module Mapping:** Module 3 / Lab 7 / Final Architecture (Advanced Consensus & MCP Tool Integration)
- **30-Second Pitch:**
  - **Multi-Round Adversarial Debate ($R=2$):** Specialists do not just state their views; they enter a 2-round cross-examination where the Technical agent critiques Sentiment's lag, Sentiment rebuts Technical's lack of macro context, and the judge synthesizes the final order.
  - **Model Context Protocol (MCP):** Implements an institutional MCP server exposing 8 tools (running backtests, fetching indicator snapshots, querying lineage records) over Stdio and HTTP JSON-RPC 2.0. Any external agent (Claude Desktop, Cursor, Antigravity) can query QuantAgent directly.
- **Live Demo Action:**
  - Run the MCP server in CLI: `pnpm mcp:server` or execute the multi-round debate test suite:
    ```bash
    pnpm --filter @committee/api test tests/debate.multiround.test.ts
    ```
  - Show how MCP tools (`quant_get_indicators`, `quant_evaluate_multiagent`, `quant_run_backtest`) return structured JSON-RPC responses.
- **Files to Open in IDE:**
  - [`apps/api/src/agents/coordinator/debate.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/coordinator/debate.ts) — `synthesizeMultiRound()` and `generateCritiques()`.
  - [`apps/api/src/mcp/server.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/mcp/server.ts) — Fastify MCP Server initialization and JSON-RPC transport.
  - [`apps/api/src/mcp/tools.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/mcp/tools.ts) — The 8 tool registrations (`quant_get_indicators`, `quant_run_backtest`, etc.).
- **Key Soundbite for Teacher:**
  > *"We converted QuantAgent into an open standard tool provider via Anthropic's Model Context Protocol (MCP), allowing external AI assistants to use our quantitative evaluation engine as a live tool."*

---

## 📊 Summary Cheat-Sheet Matrix

| # | Feature | Key File | Live Action / UI Route | 1-Sentence Takeaway |
|---|---|---|---|---|
| **1** | **Base Agent & Runner** | [`runner.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/runner.ts) | `GET /agents/latest` | Standardized execution pipeline with Zod validation & timeout isolation. |
| **2** | **Specialists & LLM Fallback** | [`llm-client.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/technical/llm-client.ts) | `http://localhost:5173/signals` | Facts vs Narration Law + 4-tier model failover (Claude $\to$ Gemini $\to$ OpenRouter $\to$ OpenAI). |
| **3** | **Consensus & Debate vs Ablation** | [`debate.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/coordinator/debate.ts) | `/observatory` (Debate vs Ablation) | Zero-token consensus short-circuit when aligned; LLM judge synthesis when clashing. |
| **4** | **Polymarket & Lineage DAG** | [`lineage.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/agents/coordinator/lineage.ts) | `http://localhost:5173/lineage` | Macro probability curves + full point-in-time prompt & trade provenance. |
| **5** | **Multi-Round Debate & MCP** | [`server.ts`](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/mcp/server.ts) | `pnpm mcp:server` / JSON-RPC | $R=2$ adversarial cross-examination & 8 standardized Model Context Protocol tools. |
