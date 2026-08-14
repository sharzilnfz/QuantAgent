# Agent Guidelines — QuantAgent

## MANDATORY PRE-FLIGHT GATE (Zero-Skip Policy)

Before reading files, running `grep_search`, or writing any code:

1. **Step 1: Codebase Memory Discovery**
   - **MUST** query `codebase-memory-mcp` first for all symbol discovery, dependency tracing, and architecture lookups (`search_code`, `search_graph`, `query_graph`, `get_code_snippet`, `get_architecture`).
   - Do **NOT** default to raw filesystem greps or directory listings when graph queries can answer the question.

2. **Step 2: Multi-Agent Delegation**
   - For tasks with non-trivial complexity (multi-file changes, implementing issues from `.scratch/evaluation-lab/issues/`, cross-system impact, or debugging root causes), **MUST** invoke specialized subagents via `invoke_subagent` to parallelize research, test authoring, and implementation.
   - Decompose work into discrete subagent tasks rather than executing multi-file workflows sequentially in the main thread.

3. **Step 3: Verification & Execution**
   - Run tests (`pnpm test`) and typechecks (`pnpm typecheck`) to verify criteria before declaring tasks complete.
   - `pnpm test` and `pnpm typecheck` are accelerated by Turborepo — unchanged packages are instant cache hits (~20ms), making repeated verification safe and zero-cost.

---

## Core Engineering Principles

- **Package Management:**
  - TypeScript / JavaScript: Use `pnpm`.
  - Python: Use `uv`.
- **Temporal Correctness & Point-in-Time Discipline:**
  - Every historical dataset query, market bar, and indicator snapshot **must** filter on `as_of <= T_decision`.
  - Violations must throw `TemporalIntegrityViolation` via `@committee/fixtures` (`TemporalGuard`).
- **Deterministic Baselines & Offline Replay:**
  - Offline evaluation runs (`pnpm demo:replay`) must operate at $0.00 cost using frozen fixtures without requiring external API keys.
- **Surgical Changes:**
  - Touch only what is required for the task. Preserve existing working code, interfaces, and comments.
