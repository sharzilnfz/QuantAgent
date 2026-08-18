# Sprint 1 — Team Contributions & Screen Recording Demo Guide

> **Project:** QuantAgent / The Committee (Multi-Agent Paper-Trading System)  
> **Branch:** `sprint1/foundation`  
> **Status:** Sprint 1 Complete — All 8 Specs & Shared Contracts Implemented  

---

## 📊 1. Team Ownership & Core Breakdown

| Member Handle | Role Owner | Primary Directory | Core Module Responsibility |
|---|---|---|---|
| **`sharzilnfz`** | **M1** | [`packages/contracts/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/contracts), [`apps/api/src/agents/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents) | Shared Zod Contracts, Agent Framework & Plugin System, Technical Analyst Agent, Docker Infrastructure |
| **`afnan-mojumder`** | **M2** | [`apps/api/src/ingest/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/ingest), [`apps/quant/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/quant) | Market Data Ingestion, Alpaca API Integration, Python Technical Indicator Engine, Backtest Skeleton |
| **`capitalD10`** | **M3** | [`apps/web/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/web) | Dashboard Shell, Portfolio & KPI Views, Shared UI Component Primitives, React Query API Hooks |
| **`ironhead2002`** | **M4** | [`packages/db/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/db), [`apps/api/src/auth/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/auth), [`apps/api/src/credentials/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/credentials) | Monorepo Scaffolding, Drizzle DB Schema & Point-in-Time Models, Argon2 Auth & JWT Sessions, AES-256 Credential Vault |
| **`nafisX`** | **Lead / Tooling** | [`PRD.md`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/PRD.md), `.agents/skills` | Initial Repository Setup, PRD & Architecture Documentation, Git Workflow Strategy, AI Agent Skills Setup |

---

## 🛠️ 2. Detailed Technical Development Breakdown

### 👤 Member 1: `sharzilnfz` — M1 (Agent Framework, Shared Contracts & Infrastructure)

* **Shared Contracts Package ([`packages/contracts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/contracts))**:
  * [`src/enums.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/contracts/src/enums.ts): System enums (`SignalDirection`, `Conviction`, `Timeframe`, `AgentRole`).
  * [`src/schemas/agent-signal.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/contracts/src/schemas/agent-signal.ts): Zod schema for specialist agent analysis output.
  * [`src/schemas/agent-run.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/contracts/src/schemas/agent-run.ts): Zod schema for full execution run output & dissent logging.
  * [`src/schemas/portfolio.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/contracts/src/schemas/portfolio.ts): Zod schema for portfolio snapshots.
  * Authored contract test suite (`tests/contracts.test.ts` — 19 passing unit tests).

* **Agent Framework & Execution Engine ([`apps/api/src/agents`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents))**:
  * [`src/agents/types.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents/types.ts): Agent base interfaces, execution contexts, and memory integration types.
  * [`src/agents/registry.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents/registry.ts) & `plugin.ts`: Agent plugin registration system.
  * [`src/agents/runner.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents/runner.ts): Agent runner with timeout handling, failure isolation, and fallback defaults.
  * [`src/agents/persistence.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents/persistence.ts): Run state and agent signal database persistence layer.
  * [`src/agents/stubs/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents/stubs): Fundamental and Sentiment analyst stub agents.
  * [`src/agents/technical/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents/technical): Full LLM-powered **Technical Analyst Agent** (`analyst.ts`, `prompts.ts`, `snapshots.ts`, `indicators.ts`) enforcing point-in-time (`as_of`) data filtering.
  * Authored test suites for agent execution (`tests/agents/`).

* **Containerization & LLM Infrastructure**:
  * [`docker-compose.yml`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/docker-compose.yml): Multi-container setup for API, Web, DB (`pgvector/pgvector:pg17-alpine`), and Quant engine.
  * Built native OpenRouter provider support and `ANTHROPIC_BASE_URL` override logic for flexible LLM backend targeting.
  * Container health checks and automated DB migration/seeding on startup.
  * Designed Sprint 1 Excalidraw architecture diagram ([`Sprint1_Class_Diagram_ExcalidrawFile.excalidraw`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/Sprint1_Class_Diagram_ExcalidrawFile.excalidraw)).

---

### 👤 Member 2: `afnan-mojumder` — M2 (Data Ingestion & Quantitative Python Engine)

* **Market Data Ingestion Service ([`apps/api/src/ingest`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/ingest))**:
  * [`src/ingest/alpaca.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/ingest/alpaca.ts): Alpaca Paper API client for historical stock bar retrieval.
  * [`src/ingest/as-of.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/ingest/as-of.ts): Point-in-time data isolation enforcement logic (`lte(asOf, decisionTs)`).
  * [`src/ingest/cache.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/ingest/cache.ts): Filesystem caching layer for external API responses.
  * [`src/ingest/service.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/ingest/service.ts) & [`routes.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/ingest/routes.ts): Fastify endpoints and service for idempotent database bar upserts.
  * Authored ingestion test suite (`tests/ingest/`).

* **Python Quant Service ([`apps/quant`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/quant))**:
  * [`app/main.py`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/quant/app/main.py): FastAPI Python microservice with `/indicators` and `/backtest` endpoints.
  * `app/indicators/engine.py`: Vectorized technical indicator engine using `pandas` and `pandas-ta` (computing SMA, EMA, RSI, MACD, Bollinger Bands).
  * `app/backtest/harness.py`: Backtesting engine base class with warm-up null handling and `as_of` timestamp propagation.
  * `app/backtest/runner.py`: Strategy execution harness.
  * Authored quantitative test suite (`tests/` — 57 passing pytest unit tests).

* **Docs & Specs Coordination**:
  * Scaffolded Sprint 1 implementation specs ([`specs/00-overview.md`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/specs/00-overview.md)).
  * Created Sprint 1 progress tracking document ([`progress_notes.md`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/progress_notes.md)).

---

### 👤 Member 3: `capitalD10` — M3 (Frontend React Dashboard Shell)

* **Web Application Foundation ([`apps/web`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/web))**:
  * Scaffolded Vite + React 18 + TypeScript + TailwindCSS frontend monorepo app.
  * Built authentication UI flows (`LoginPage`, `RequireAuth` route guard).
* **Dashboard Shell & Portfolio View ([`apps/web/src/pages/PortfolioPage.tsx`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/web/src/pages/PortfolioPage.tsx))**:
  * [`AppLayout`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/web/src/components/layout/AppLayout.tsx): Layout wrapper with header, navigation bar, and dark mode theme provider.
  * `KpiRow`: Visual KPI cards for total portfolio value, cash balance, open positions count, and P&L.
  * `PositionsTable`: Table component displaying open stock holdings with allocation percentages.
  * `PortfolioValueChart`: Interactive Recharts line chart showing portfolio history over time.
  * `AgentActivityCard`: UI component rendering specialist agent decisions, conviction badges, and reasoning text.
* **Shared UI Components & Data Layer**:
  * Reusable UI primitives (`Button`, `Card`, `Field`, `States` for loading, empty, and error views).
  * API Integration client ([`apps/web/src/lib/api.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/web/src/lib/api.ts)) and React Query data fetching hooks.
  * Authored frontend component test suite (`tests/` — 25 passing tests).

---

### 👤 Member 4: `ironhead2002` — M4 (Database Schema, User Auth & Security Vault)

* **Monorepo Foundation & Workspace Setup**:
  * Established root [`package.json`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/package.json), [`pnpm-workspace.yaml`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/pnpm-workspace.yaml), root [`tsconfig.base.json`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/tsconfig.base.json), and API Fastify server shell ([`apps/api/src/app.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/app.ts)).
* **Database Architecture ([`packages/db`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/db))**:
  * Designed Drizzle ORM schema (`users`, `market` bars, `agents` runs/signals, `enums`, `stubs`).
  * Enforced mandatory `as_of` and `created_at` timestamp columns on all tables for point-in-time compliance (Law 1).
  * Generated migration SQL ([`0000_ancient_rictor.sql`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/db/migrations/0000_ancient_rictor.sql)), migration runner, database client, seed scripts, and exported TypeScript types.
  * Authored database test suite (`packages/db/tests/`).
* **Authentication & User Sessions ([`apps/api/src/auth`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/auth))**:
  * Implemented user registration, login, Argon2 password hashing, JWT session handling, `requireAuth` middleware, and Fastify auth routes (`/auth/register`, `/auth/login`, `/auth/me`).
* **Credential Vault ([`apps/api/src/credentials`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/credentials))**:
  * Implemented AES-256-GCM symmetric encryption for safely storing Alpaca API keys encrypted at rest.
* **Portfolio API Routes ([`apps/api/src/portfolio`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/portfolio))**:
  * Built portfolio service layer and Fastify endpoints for fetching positions, cash, and P&L metrics.

---

### 👤 Member 5: `nafisX` — Lead / Repository Setup, PRD & Agent Skills

* **Repository Initialization & Product Requirements**:
  * Created project baseline commits and directory structure.
  * Authored core Product Requirements Document ([`PRD.md`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/PRD.md)).
  * Authored [`Git_Workflow_Branches_Worktrees.md`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/Git_Workflow_Branches_Worktrees.md) defining branch naming rules and multi-author `--author` commit protocols.
* **AI Tooling & Skill Infrastructure**:
  * Configured workspace skills in `.agents/` and `.claude/`.
  * Configured Excalidraw diagram skill, graphify knowledge graph, and AI assistant configurations.

---

## 📋 3. Sprint 1 Feature Spec Mapping

| Spec ID | Feature Name | Owner | Primary Implementation Path |
|---|---|---|---|
| `01` | DB Schema & Core Models | **M4 (`ironhead2002`)** | [`packages/db/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/db) |
| `02` | Shared Contracts Package (Zod) | **M1 (`sharzilnfz`)** | [`packages/contracts/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/contracts) |
| `03` | User Auth & Session Management | **M4 (`ironhead2002`)** | [`apps/api/src/auth/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/auth), [`apps/api/src/credentials/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/credentials) |
| `04` | Market Data Ingestion Service | **M2 (`afnan-mojumder`)** | [`apps/api/src/ingest/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/ingest) |
| `05` | Technical Indicator Engine & Backtest Skeleton | **M2 (`afnan-mojumder`)** | [`apps/quant/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/quant) |
| `06` | Agent Framework & Base Interface + Stubs | **M1 (`sharzilnfz`)** | [`apps/api/src/agents/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents) |
| `07` | Technical Analyst Agent | **M1 (`sharzilnfz`)** | [`apps/api/src/agents/technical/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents/technical) |
| `08` | Dashboard Shell & Portfolio View | **M3 (`capitalD10`)** | [`apps/web/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/web) |

---

## 🎥 4. Member Screen Recording Snippet Guide (20-30s per member)

### 🎥 Member 1: `sharzilnfz` (M1 — Agent Framework & Docker Setup)
* **Code to Highlight:**
  * Open [`packages/contracts/src/schemas/agent-signal.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/contracts/src/schemas/agent-signal.ts) & [`apps/api/src/agents/technical/analyst.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/agents/technical/analyst.ts).
* **Terminal Commands:**
  ```bash
  pnpm --filter @committee/contracts test
  pnpm --filter @committee/api test -- tests/agents/
  ```
* **Visuals:** Run `docker compose up --build` or show running Docker containers (`api`, `web`, `quant`, `db`) with DB auto-migrations on startup.

---

### 🎥 Member 2: `afnan-mojumder` (M2 — Data Ingestion & Python Quant Engine)
* **Code to Highlight:**
  * Open [`apps/api/src/ingest/as-of.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/ingest/as-of.ts) & [`apps/quant/app/indicators/engine.py`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/quant/app/indicators/engine.py).
* **Terminal Commands:**
  ```bash
  cd apps/quant && pytest
  ```
* **Visuals:** Open FastAPI Swagger UI at `http://localhost:8000/docs`, execute `/indicators` with price bars to display output JSON containing calculated RSI, MACD, and Bollinger Bands.

---

### 🎥 Member 3: `capitalD10` (M3 — Frontend Web Dashboard Shell)
* **Code to Highlight:**
  * Open [`apps/web/src/pages/PortfolioPage.tsx`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/web/src/pages/PortfolioPage.tsx) & [`apps/web/src/lib/api.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/web/src/lib/api.ts).
* **Browser Demo (`http://localhost:5173`)**:
  * Demonstrate login flow on `LoginPage` and redirect into dashboard.
  * Hover over `KpiRow` tiles, interactive `PortfolioValueChart` (Recharts line chart), `PositionsTable`, and `AgentActivityCard`.
* **Terminal Commands:**
  ```bash
  pnpm --filter @committee/web test
  ```

---

### 🎥 Member 4: `ironhead2002` (M4 — DB Schema, Auth & Credential Vault)
* **Code to Highlight:**
  * Open [`packages/db/src/schema/`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/packages/db/src/schema/) (showing point-in-time `as_of` fields), [`apps/api/src/auth/plugin.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/auth/plugin.ts), and [`apps/api/src/credentials/vault.ts`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/apps/api/src/credentials/vault.ts).
* **Terminal Commands:**
  ```bash
  pnpm --filter @committee/db test
  pnpm --filter @committee/api test -- tests/auth/
  ```
* **Visuals:** Launch Drizzle Studio via `pnpm --filter @committee/db studio` or query Postgres showing table schemas and AES-256 encrypted credential records in DB.

---

### 🎬 Recording Summary Matrix

| Member | Clip Target | Key Focus Area | Primary Verification Command |
|---|---|---|---|
| **`sharzilnfz` (M1)** | ~25 sec | Agent Framework + Shared Contracts + Docker | `pnpm --filter @committee/contracts test` |
| **`afnan-mojumder` (M2)** | ~25 sec | Market Data Ingestion + Python Indicators & Backtest | `cd apps/quant && pytest` |
| **`capitalD10` (M3)** | ~25 sec | Dashboard UI + Login + Recharts & Agent Cards | `pnpm --filter @committee/web test` |
| **`ironhead2002` (M4)** | ~25 sec | Drizzle DB Schema + Argon2 Auth + AES Vault | `pnpm --filter @committee/db test` |
