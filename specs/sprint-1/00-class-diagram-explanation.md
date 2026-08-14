# QuantAgent Sprint-01 UML Class Diagram Explanation

This document provides a comprehensive technical explanation of the **Sprint-01 UML Class Diagram** (`specs/sprint-1/00-class-diagram.excalidraw` / `00-class-diagram.png`).

---

## 1. Overview & Architecture

The diagram models the complete object-oriented architecture of **Sprint-01** ("The Committee" multi-agent paper-trading system). The system is structured into five functional areas:

1. **Enumerations**: Standardized domain value types.
2. **Data & Fact Models**: Point-in-time domain entities and pipeline payloads (`PriceBar`, `IndicatorSnapshot`, `AgentRun`, `AgentInput`, `AgentOutput`, `PortfolioState`).
3. **Platform & Auth Services**: User authentication, session management, and encrypted credential vault (`User`, `Session`, `AlpacaCredentials`, `WatchlistItem`, `AuthService`, `CryptoUtil`).
4. **Quant & Data Ingestion Services**: Market data fetching, technical indicator calculations, and backtesting simulation (`MarketDataService`, `IndicatorEngine`, `BacktestHarness`).
5. **Agent Framework & Reasoning Engine**: Polymorphic agent architecture, deterministic classification, and LLM reasoning (`Agent` interface, `BaseAgent`, `TechnicalAgent`, `TechnicalClassifier`, `LLMClient`, `AgentRunner`).

---

## 2. Explanation of `PortfolioState` & `BacktestHarness` Relationships

> **Question**: In the diagram, `PortfolioState` and `BacktestHarness` appeared unconnected in the initial scaffold. Were they designed this way or was it an oversight?

### Clarification & Solution
In the initial visual layout pass, `PortfolioState` and `BacktestHarness` were placed without explicit connector arrows:

- **`PortfolioState`** is a fundamental snapshot data contract in `packages/contracts`. It captures the current state of a paper-trading account (`cash`, `equity`, `positions`, `asOf`). 
  - **Design Context**: It was initially authored as a standalone contract DTO served by `GET /portfolio` to the Web Dashboard.
  - **Connected Relationship**: `PortfolioState` connects via a **dependency arrow (`- - ->`) to `AgentRun`** (and `AgentRunner`), because agent execution and downstream risk evaluation require point-in-time portfolio context (current cash & open positions) to make valid decisions.

- **`BacktestHarness`** lives in `apps/quant` and provides historical strategy simulation.
  - **Design Context**: It was designed as an independent quant evaluation service operating over historical bar datasets.
  - **Connected Relationship**: `BacktestHarness` connects via **two dependency arrows (`- - ->`)**:
    1. **To `PriceBar`**: `BacktestHarness.runBacktest(...)` accepts historical `PriceBar[]` arrays as primary input.
    2. **To `IndicatorEngine`**: `BacktestHarness` relies on `IndicatorEngine.compute(...)` to generate indicators over the historical backtest window.

Both classes are now fully connected with directional dependency arrows in the diagram.

---

## 3. Detailed Class Breakdown

### 3.1 Domain Enumerations

- **`Direction`** (`«enumeration»`):
  - Values: `BULLISH`, `BEARISH`, `NEUTRAL`.
  - Represents an agent's signal bias for an asset.

- **`AgentName`** (`«enumeration»`):
  - Values: `TECHNICAL`, `SENTIMENT`, `FUNDAMENTAL`.
  - Distinguishes the three specialist committee analyst roles.

- **`Timeframe`** (`«enumeration»`):
  - Values: `1Day`, `1Hour`.
  - Specifies market data granularity.

---

### 3.2 Data & Fact Models

- **`PriceBar`**:
  - Represents OHLCV market data.
  - Critical field: `asOf` timestamp (enforces **Point-in-Time Integrity** — data is strictly unreadable before its `asOf` timestamp).

- **`IndicatorSnapshot`**:
  - Contains calculated technical indicators (`rsi`, `macd`, `macdSignal`, `bbUpper`, `bbLower`, `sma20`, `sma50`).
  - Fields are nullable (`number | null`) to account for warmup periods.
  - Carries its own `asOf` timestamp propagated from input price bars.

- **`AgentInput`**:
  - Package delivered to an agent during an execution run.
  - Contains `runId`, `symbol`, `timeframe`, `decisionTs`, `bars: PriceBar[]`, `indicators: IndicatorSnapshot`, and optional `memory`.

- **`AgentOutput`**:
  - Standardized schema returned by every agent.
  - Fields: `agent: AgentName`, `direction: Direction`, `confidence: number` (range `[0, 1]`), `rationale: String`, `evidence: Record<String, any>`.

- **`AgentRun`**:
  - Database record tracking an agent committee execution.
  - Contains `id`, `symbol`, `timeframe`, `decisionTs`, `status` (`running | completed | failed`), `startedAt`, `finishedAt`.
  - Holds a **Composition (`◆──>`)** relationship to its resulting `AgentOutput` payloads.

- **`PortfolioState`**:
  - Account snapshot containing `cash`, `equity`, `positions: Position[]`, and `asOf`.
  - Passed into agent runs and risk validation gates.

---

### 3.3 Platform & Authentication (Spec 03 & 07)

- **`User`**: Core user account (`id`, `email`, `passwordHash`, `createdAt`).
- **`Session`**: Active login session (`id`, `userId`, `expiresAt`, `createdAt`). Composed by `User` (`1 → *`).
- **`AlpacaCredentials`**: Encrypted API keys (`userId`, `keyCiphertext`, `secretCiphertext`, `iv`, `authTag`). Associated 0..1 with `User`.
- **`WatchlistItem`**: User tracked assets (`symbol`). Composed by `User` (`1 → *`).
- **`AuthService`**: Manages registration, login, logout, and credential storage. Uses `CryptoUtil`.
- **`CryptoUtil`**: Low-level AES-256-GCM encryption helper (`encrypt()`, `decrypt()`).

---

### 3.4 Quant & Data Ingestion (Spec 02, 03, 05, 06)

- **`MarketDataService`**: Fetches raw market data from Alpaca API and persists `PriceBar` records.
- **`IndicatorEngine`**: Deterministic indicator processing engine (computes SMA, RSI, MACD, Bollinger Bands via NumPy/Pandas). Returns `IndicatorSnapshot[]`.
- **`BacktestHarness`**: Simulates historical trading strategies using `PriceBar[]` and `IndicatorEngine`.

---

### 3.5 Agent Framework & Specialist Architecture (Spec 04 & 05)

- **`«interface» Agent`**:
  - Contract for all committee agents.
  - Method: `+ analyze(in input: AgentInput): AgentOutput`.

- **`«abstract» BaseAgent`**:
  - Implements `Agent` (`▲ - - -` Realization).
  - Handles safety invariants: timeouts, input validation, exception catching, and fallback to `NO_OPINION`.
  - Defines template method `# run(in input: AgentInput): AgentOutput`.

- **`TechnicalAgent`**:
  - Concrete specialist extending `BaseAgent` (`▲ ───` Inheritance).
  - Uses `TechnicalClassifier` for deterministic calculation and `LLMClient` for natural language rationale.

- **`TechnicalClassifier`**:
  - Pure deterministic helper. Evaluates `IndicatorSnapshot` to produce initial direction bias and confidence score.

- **`LLMClient`**:
  - Interface/wrapper for Anthropic Claude LLM calls (`+ generate(in prompt: String): AgentOutput`).

- **`AgentRunner`**:
  - Orchestrator that executes multiple agents in parallel, collects `AgentOutput[]`, and links them to the active `AgentRun`.

---

## 4. Summary of UML Relationship Notation

| Arrow Type | Representation | Meaning | Example in Diagram |
|------------|----------------|---------|---------------------|
| **Realization** | `▲ - - -` (Dashed, open triangle) | Implements an interface | `BaseAgent` implements `Agent` |
| **Inheritance** | `▲ ───` (Solid, open triangle) | Extends a class | `TechnicalAgent` extends `BaseAgent` |
| **Composition** | `◆ ───` (Solid diamond, solid line) | Strong ownership / lifecycle bound | `User` owns `Session` / `WatchlistItem`, `AgentRun` owns `AgentOutput` |
| **Association** | `────` (Solid line, optional multiplicity) | Structural reference | `User` 0..1 `AlpacaCredentials` |
| **Dependency** | `─ ─ >` (Dashed line, open arrowhead) | Uses / consumes transiently | `BacktestHarness` uses `PriceBar` & `IndicatorEngine`, `PortfolioState` used by `AgentRun` |

---

## 5. File References

- **Excalidraw Diagram File**: [`specs/sprint-1/00-class-diagram.excalidraw`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/specs/sprint-1/00-class-diagram.excalidraw)
- **Rendered PNG Image**: [`specs/sprint-1/00-class-diagram.png`](file:///c:/Users/afnan/Desktop/Projects/QuantAgent/specs/sprint-1/00-class-diagram.png)
