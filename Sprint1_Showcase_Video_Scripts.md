# 🎬 Sprint 1 Showcase Video Scripts — QuantAgent / The Committee

> **Project:** QuantAgent / The Committee (Multi-Agent Paper-Trading System)  
> **Sprint:** Sprint 1 — Foundation, Shared Contracts, Market Ingestion, Quant Engine, Auth/DB & Web Dashboard Shell  
> **Total Target Duration:** ~2:30 minutes (~25–30 seconds per member)

---

## 🧭 Recording Tips & General Guidelines
1. **Video Format:** 1080p or 4K screen recording, 30/60 fps.
2. **Audio:** Clear microphone audio. Speak at a steady, confident cadence.
3. **Screen Setup:** Dark mode code editor (VS Code), terminal visible, browser window ready.
4. **Transition:** Pass seamlessly between speakers using: *"Next up, [Name] will present [Feature Area]..."*

---

## 🎬 Script 1: `nafisX` — Lead / Project Vision & Scaffolding
* **Role:** Lead / Tooling & Architecture
* **Focus:** Repository Foundation, PRD & Architecture Documentation, Git & Agent Skills Strategy
* **Target Duration:** ~30 seconds

### 🖥️ On-Screen Visuals & Actions
1. Open [`PRD.md`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/PRD.md) in editor; scroll briefly through System Architecture & Agent Committee design.
2. Highlight [`Git_Workflow_Branches_Worktrees.md`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/Git_Workflow_Branches_Worktrees.md) and `.agents/skills` folder in project tree.
3. Display project monorepo layout (`apps/`, `packages/`, `specs/`).

### 🎙️ Spoken Script (Voiceover)
> *"Hi everyone, I'm **nafisX**, project lead for **QuantAgent: The Committee** — a multi-agent paper trading system driven by specialized AI analysts."*
> 
> *"For Sprint 1, I laid the groundwork by authoring our core Product Requirements Document and establishing our multi-agent architecture. I configured our monorepo Git workflow strategy and initialized our customized AI Agent Skills in `.agents/` to keep our automated development standardized."*
> 
> *"Now, let's dive into our technical features, starting with our Agent Framework and Shared Contracts with **sharzilnfz**."*

---

## 🎬 Script 2: `sharzilnfz` — M1 (Agent Framework, Shared Contracts & Infrastructure)
* **Role Owner:** M1
* **Focus:** Shared Zod Contracts (`packages/contracts`), Agent Registry & Runner, LLM Technical Analyst, Docker Setup
* **Target Duration:** ~30 seconds

### 🖥️ On-Screen Visuals & Actions
1. Open [`packages/contracts/src/schemas/agent-signal.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/contracts/src/schemas/agent-signal.ts) & [`apps/api/src/agents/technical/analyst.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents/technical/analyst.ts).
2. Run terminal command:
   ```bash
   pnpm --filter @committee/contracts test && pnpm --filter @committee/api test -- tests/agents/
   ```
3. Show Docker Desktop or running containers (`api`, `web`, `quant`, `db` with `pgvector`).

### 🎙️ Spoken Script (Voiceover)
> *"Thanks! I'm **sharzilnfz**, responsible for **M1** — our shared contract definitions, agent execution framework, and container infrastructure."*
> 
> *"I built our `@committee/contracts` package using Zod for strict type validation across agent signals and portfolio runs. Over in `apps/api`, I implemented our Agent Framework registry and runner with strict timeout isolation, alongside our first full LLM-powered Technical Analyst agent enforcing point-in-time data."*
> 
> *"Finally, I containerized the system with Docker Compose, integrating OpenRouter and Anthropic backends with automatic database migrations on launch."*
> 
> *"Over to **afnan-mojumder** for our data ingestion and quantitative engines!"*

---

## 🎬 Script 3: `afnan-mojumder` — M2 (Data Ingestion & Quantitative Python Engine)
* **Role Owner:** M2
* **Focus:** Market Data Ingestion (`apps/api/src/ingest`), Point-in-Time Enforcement (`as-of.ts`), FastAPI Quant Service (`apps/quant`)
* **Target Duration:** ~30 seconds

### 🖥️ On-Screen Visuals & Actions
1. Open [`apps/api/src/ingest/as-of.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/ingest/as-of.ts) and [`apps/quant/app/indicators/engine.py`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/quant/app/indicators/engine.py).
2. Run terminal command:
   ```bash
   cd apps/quant && pytest
   ```
3. Open browser to FastAPI Swagger UI at `http://localhost:8000/docs`, trigger `/indicators` endpoint showing JSON output with calculated RSI, MACD, and Bollinger Bands.

### 🎙️ Spoken Script (Voiceover)
> *"Thanks **sharzilnfz**! I'm **afnan-mojumder**, owner of **M2** — Market Data Ingestion and Quantitative Analytics."*
> 
> *"I built the Alpaca API integration for fetching historical price bars, enforcing strict point-in-time compliance via `as_of` timestamps to prevent look-ahead bias during trading decisions."*
> 
> *"On the quant side, I developed our Python FastAPI microservice, implementing a vectorized indicator engine using `pandas-ta` for SMA, EMA, RSI, MACD, and Bollinger Bands, complete with strategy backtesting harnesses backed by 57 passing tests."*
> 
> *"Now let's look at the web dashboard shell with **capitalD10**!"*

---

## 🎬 Script 4: `capitalD10` — M3 (Frontend React Dashboard Shell)
* **Role Owner:** M3
* **Focus:** Web Application Shell (`apps/web`), Dashboard Shell, KPI Cards, Recharts Portfolio Chart, Agent Activity Feed
* **Target Duration:** ~30 seconds

### 🖥️ On-Screen Visuals & Actions
1. Open browser to `http://localhost:5173`. Show quick login flow, redirecting to main dashboard layout.
2. Hover over `KpiRow` tiles, interactive `PortfolioValueChart` line graph, `PositionsTable`, and `AgentActivityCard` showing conviction badges.
3. Open [`apps/web/src/pages/PortfolioPage.tsx`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/web/src/pages/PortfolioPage.tsx).
4. Run terminal command:
   ```bash
   pnpm --filter @committee/web test
   ```

### 🎙️ Spoken Script (Voiceover)
> *"Thanks **afnan-mojumder**! I'm **capitalD10**, leading **M3** — our Frontend Web Dashboard Shell."*
> 
> *"I scaffolded our Vite, React 18, and TailwindCSS frontend application. I built authentication routing guards and our core dashboard layout, featuring responsive KPI tiles for total portfolio metrics, interactive portfolio value charts built with Recharts, and real-time open position tables."*
> 
> *"I also designed our Agent Activity cards to visually highlight specialist committee signals, conviction levels, and agent reasoning text, powered by custom React Query hooks."*
> 
> *"Next up, **ironhead2002** will take us through database architecture and security!"*

---

## 🎬 Script 5: `ironhead2002` — M4 (Database Schema, User Auth & Security Vault)
* **Role Owner:** M4
* **Focus:** Monorepo Workspace, Fastify API Shell, Drizzle ORM Schema (`packages/db`), Argon2 Auth & AES-256 Vault
* **Target Duration:** ~30 seconds

### 🖥️ On-Screen Visuals & Actions
1. Open [`packages/db/src/schema/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/db/src/schema/) showing schema definitions with mandatory `as_of` fields.
2. Open [`apps/api/src/auth/plugin.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/auth/plugin.ts) & [`apps/api/src/credentials/vault.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/credentials/vault.ts).
3. Run terminal command:
   ```bash
   pnpm --filter @committee/db test && pnpm --filter @committee/api test -- tests/auth/
   ```
4. Show Drizzle Studio interface (`pnpm --filter @committee/db studio`) displaying tables and encrypted user credential records.

### 🎙️ Spoken Script (Voiceover)
> *"Thanks **capitalD10**! I'm **ironhead2002**, responsible for **M4** — Database Architecture, User Auth, and Credential Security."*
> 
> *"I established the monorepo foundation, Fastify API shell, and our Drizzle ORM database schema with PostgreSQL. Every market and agent table enforces strict `as_of` and `created_at` timestamping for point-in-time integrity."*
> 
> *"I also implemented secure user registration and login using Argon2 password hashing and JWT sessions, plus an AES-256-GCM symmetric encryption vault to safely store external Alpaca API keys at rest."*
> 
> *"Back to **nafisX** to wrap up!"*

---

## 🎬 Outro Script: `nafisX` — Summary & Sprint 1 Wrap-up
* **Role:** Lead
* **Focus:** All Specs Verification & Sprint 1 Handover
* **Target Duration:** ~15 seconds

### 🖥️ On-Screen Visuals & Actions
1. Show project overview table from [`Sprint1_Team_Contributions_and_Demo_Guide.md`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/Sprint1_Team_Contributions_and_Demo_Guide.md) showing all 8 specs complete and passing.

### 🎙️ Spoken Script (Voiceover)
> *"With all 8 Sprint 1 feature specifications implemented, tested, and passing across contracts, API, database, quant service, and frontend shell, our foundation is complete and ready for full committee integration in Sprint 2."*
> 
> *"Thank you for watching!"*

---

## 📊 Summary Reference Matrix

| Order | Member Handle | Role / Area | Visual Focus | Terminal / Demo Command | Spoken Time |
|---|---|---|---|---|---|
| 1 | `nafisX` | Lead / Setup & Architecture | `PRD.md`, `.agents/skills`, Monorepo Structure | N/A | ~30s |
| 2 | `sharzilnfz` | M1 — Contracts, Agents & Docker | `schemas/agent-signal.ts`, `analyst.ts`, Docker | `pnpm --filter @committee/contracts test` | ~30s |
| 3 | `afnan-mojumder` | M2 — Ingestion & Python Quant | `as-of.ts`, `engine.py`, FastAPI Swagger UI | `cd apps/quant && pytest` | ~30s |
| 4 | `capitalD10` | M3 — Frontend Web Shell | Dashboard UI, KPI cards, Recharts chart | `pnpm --filter @committee/web test` | ~30s |
| 5 | `ironhead2002` | M4 — DB Schema, Auth & Security | Schema files, Argon2 plugin, AES Vault, Drizzle | `pnpm --filter @committee/db test` | ~30s |
| Outro | `nafisX` | Lead / Wrap-up | Spec mapping table, Passing tests summary | N/A | ~15s |
