# M1 (Sharzil) — Sprint 1 High-Level Demo Video Script

> **Project:** QuantAgent / The Committee (Multi-Agent Trading System)  
> **Speaker:** Sharzil — M1, Agent Architecture Lead  
> **Target Duration:** ~1:00 – 1:30 (~180 words)

---

## Short & Concise Script

### 1. Hook & Overview *(0:00–0:15)*
> "Hi, I’m Sharzil, the Agent Architecture Lead for **The Committee**—a multi-agent AI system for paper trading. For Sprint 1, I built the foundational core: the shared contracts, the fault-tolerant execution framework, and our first production LLM agent."

---

### 2. Core Framework & Safety *(0:15–0:45)*
> "First, **schema-first validation**. Raw LLM output is untrusted by default, so every agent output must pass strict schema validation before it touches our database or dashboard.
>
> Second, **resilient parallel execution**. Agents run concurrently, but if an agent times out or throws an error, the framework catches it safely and returns a neutral fallback instead of crashing the pipeline. I also built deterministic stub agents on day one so the rest of the team could integrate against a live pipeline immediately."

---

### 3. Technical Analyst Agent: Facts vs. Narration *(0:45–1:15)*
> "Next, I built the **Technical Analyst Agent**, our first real AI agent. It operates on a strict principle: **facts versus narration**. 
>
> Technical indicators—like RSI, MACD, and Bollinger Bands—are computed deterministically in code so the model never hallucinates numbers. The LLM is only used to narrate the rationale. We also enforce point-in-time data snapshots to prevent look-ahead bias."

---

### 4. Live Demo & Wrap-up *(1:15–1:30)*
> "Everything is containerized with Docker Compose and backed by a comprehensive test suite. With this foundation proven and running live, we're ready to add the full agent committee and risk gate in Sprint 2."

---

## Visual Guidance

| Time | Script Section | Visual to Show |
|---|---|---|
| **0:00–0:15** | Hook & Overview | High-level project architecture or monorepo structure |
| **0:15–0:45** | Core Framework & Safety | Shared schema file + terminal showing passing framework tests |
| **0:45–1:15** | Technical Agent | Indicators calculation code / LLM prompt output |
| **1:15–1:30** | Live Demo & Wrap-up | Docker containers running + API trigger rendering on Dashboard |