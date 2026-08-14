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

---

## Git Workflow & Team Attribution Practices

### 1. Branching & Worktrees
- **Feature Branches:** Develop all new features/issues on dedicated branches (`feat/<slug>` or `sprint<N>/<owner>-<slug>`), never uncommitted on baseline branches.
- **Milestone Tags:** Tag clean milestone baselines (e.g., `v0.1-sprint1-foundation`) before kicking off new sprints.
- **Worktrees:** Use `.worktrees/<feature-name>` for parallel multi-agent workflows or isolated branch reviews without switching primary directories.

### 2. Multi-Author Commit Attribution Matrix
When staging commits, attribute code to the matching PRD role using `git commit --author="..."`:

| Role | Member | GitHub | Email | `--author` String | Domain Ownership |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **M1** | Lead / Architecture | `@sharzilnfz` | `sharzilrs@gmail.com` | `"sharzilnfz <sharzilrs@gmail.com>"` | Agent framework, debate synthesis, specs, orchestration |
| **M2** | Quant / Data Lead | `@afnan-mojumder` | `afnan.mojumder@gmail.com` | `"afnan-mojumder <afnan.mojumder@gmail.com>"` | Indicators, backtest engine, frozen fixtures, anti-leakage |
| **M3** | Frontend / UI Lead | `@capitalD10` | `unjurndaniel05@gmail.com` | `"capitalD10 <unjurndaniel05@gmail.com>"` | Observatory UI, lineage inspector, tearsheet charts |
| **M4** | Platform / Risk Lead | `@ironhead2002` | `nnr.rudra123@gmail.com` | `"ironhead2002 <nnr.rudra123@gmail.com>"` | DB schema/migrations, auth, Turborepo tooling, Docker |

### 3. Commit Discipline
- **Atomic Commits:** Separate platform tooling, specs, data layers, and UI into distinct commits by owner.
- **Conventional Messages:** Follow `feat(m<N>): ...`, `fix(m<N>): ...`, `chore(platform): ...`, `docs(eval-lab): ...`.

