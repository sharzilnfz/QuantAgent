# Git Workflow — Branches & Worktrees Across Four Sprints

Practical, not theoretical. Built around the M1–M4 ownership split from the PRD, since that split is what makes this simple: each person mostly touches their own files.

---

## 1. The core model: trunk-based, short-lived branches

Keep it to one long-lived branch plus small, fast-merging feature branches. No `develop` branch, no git-flow ceremony — four people don't need that overhead.

- **`main`** — always working, always demo-able. This is what you show up with at every sprint check-in.
- **Feature branches** — one per PRD feature, named so anyone can tell what it is and who owns it at a glance:

```
sprint<N>/<owner>-<short-feature-slug>

sprint1/m1-agent-framework
sprint1/m4-auth-session
sprint2/m2-fundamental-agent
sprint3/m4-reflection-agent
```

Branch off `main`, merge back into `main` via PR as soon as the feature works — don't let branches live longer than a few days. Long-lived branches are where painful merges come from.

---

## 2. Why this split naturally avoids conflicts

Because M1/M2/M3/M4 own distinct services (agent core, quant/data service, frontend, platform/execution), most branches never touch the same files. The friction only shows up at **shared contracts** — the handful of things more than one person depends on:

- **Agent output schema** (M1 defines it, M2 and M4's agents/consumers depend on it)
- **Database schema** (M4 owns migrations, but M1/M2 tables live in the same DB)
- **API contracts** between the Node backend and the Python quant service (M1/M4 vs M2)

Treat changes to these three as **high-priority, same-day merges** — land them early in each sprint, before people branch off to build features that depend on them. If someone needs a schema change, open that PR first thing in the sprint, get it reviewed fast, merge it, *then* branch feature work off the updated `main`. Nobody should be rebasing a week of work over a schema that moved underneath them.

---

## 3. Sprint cadence

At the start of each sprint:

```bash
git checkout main
git pull
git tag sprint2-start   # optional, marks the baseline
```

During the sprint, everyone branches off current `main`, opens PRs as features finish, and merges continuously — not saved up for a final "sprint merge day." At the end of each sprint:

```bash
git checkout main
git pull
git tag v0.<N>-sprint<N>   # e.g. v0.2-sprint2
git push --tags
```

That tag is your sprint deliverable, permanently pointable-to — useful for the demo, and for your own sanity if Sprint 3 breaks something Sprint 2 had working.

---

## 3a. Sprint 1 special case — one developer, four authors

For Sprint 1, all work happens in one IDE with one coding agent. But the git history needs to show four contributors matching the PRD ownership split. Git supports this natively — the `--author` flag overrides who the commit is attributed to, no account switching required.

### Setup: team member identities

| Role | GitHub | Email | `--author` string |
|------|--------|-------|-------------------|
| **M1** — Agent Architecture Lead | @sharzilnfz | sharzilrs@gmail.com | `"sharzilnfz <sharzilrs@gmail.com>"` |
| **M2** — Data, Quant & Evaluation | @afnan-mojumder | afnan.mojumder@gmail.com | `"afnan-mojumder <afnan.mojumder@gmail.com>"` |
| **M3** — Frontend & Visualization | @capitalD10 | unjurndaniel05@gmail.com | `"capitalD10 <unjurndaniel05@gmail.com>"` |
| **M4** — Platform, Risk & Execution | @ironhead2002 | nnr.rudra123@gmail.com | `"ironhead2002 <nnr.rudra123@gmail.com>"` |

### How to commit as a specific member

```bash
# Normal commit (uses your own git config):
git commit -m "feat(m1): agent framework base interface + stub agents"

# Commit attributed to a specific member:
git commit --author="sharzilnfz <sharzilrs@gmail.com>" -m "feat(m1): agent framework base interface + stub agents"
git commit --author="afnan-mojumder <afnan.mojumder@gmail.com>" -m "feat(m2): market data ingestion service"
git commit --author="capitalD10 <unjurndaniel05@gmail.com>" -m "feat(m3): dashboard shell + portfolio view"
git commit --author="ironhead2002 <nnr.rudra123@gmail.com>" -m "feat(m4): database schema + auth session"
```

The `--author` flag sets the **author** (who wrote the code). The **committer** (who ran `git commit`) stays as you — this is normal and expected in open-source workflows where a maintainer lands someone else's patch.

### The workflow: build everything, then commit by owner

You don't need to commit in real-time as you code. The cleanest approach:

1. **Build all Sprint 1 features** in one session, on a single working branch.
2. **Stage and commit by owner**, grouping files by who owns them per the PRD.
3. **Push** — the history shows four contributors, each touching only their own files.

```bash
# Start on a sprint1 branch
git checkout -b sprint1/foundation main

# === Build everything first, THEN commit by owner ===

# Step 1: Commit M4's work (database + auth — these are root dependencies)
git add src/db/ src/auth/ drizzle/ src/middleware/auth*
git commit --author="ironhead2002 <nnr.rudra123@gmail.com>" \
  -m "feat(m4): database schema with point-in-time fields + auth system"

# Step 2: Commit M2's work (data ingestion + indicators + backtest scaffold)
git add services/quant/ src/services/ingestion* src/services/indicators*
git commit --author="afnan-mojumder <afnan.mojumder@gmail.com>" \
  -m "feat(m2): market data ingestion + technical indicator engine + backtest harness skeleton"

# Step 3: Commit M1's work (agent framework + technical agent)
git add src/agents/ src/orchestrator/
git commit --author="sharzilnfz <sharzilrs@gmail.com>" \
  -m "feat(m1): agent framework with base interface, stub agents + technical analyst agent"

# Step 4: Commit M3's work (dashboard + portfolio UI)
git add src/app/ src/components/ src/pages/
git commit --author="capitalD10 <unjurndaniel05@gmail.com>" \
  -m "feat(m3): dashboard shell + portfolio view"

# Push and open PR
git push -u origin sprint1/foundation
```

### Sprint 1 file-to-owner mapping

Use this to decide what gets staged in each commit:

| Owner | GitHub | Features | Likely directories / files |
|-------|--------|----------|---------------------------|
| **M4** | @ironhead2002 | Database schema, auth & session | `src/db/`, `drizzle/`, `src/auth/`, `src/middleware/auth*`, `.env.example` |
| **M2** | @afnan-mojumder | Market data ingestion, indicator engine, backtest harness | `services/quant/` (Python), `src/services/ingestion*`, `src/services/indicators*` |
| **M1** | @sharzilnfz | Agent framework + stubs, technical analyst agent | `src/agents/`, `src/orchestrator/`, agent schema/types |
| **M3** | @capitalD10 | Dashboard shell, portfolio view | `src/app/`, `src/components/`, `src/pages/`, styles |

> **Shared files** (e.g., `package.json`, `docker-compose.yml`, root config) — attribute to whoever's feature required the change. If ambiguous, give it to M4 (@ironhead2002, platform owner).

### If you need to split commits more granularly

Instead of one commit per member, you can do multiple commits per member to show a more realistic history:

```bash
# M4 does schema first, then auth separately
git add src/db/ drizzle/
git commit --author="ironhead2002 <nnr.rudra123@gmail.com>" \
  -m "feat(m4): database schema with point-in-time as_of fields"

git add src/auth/ src/middleware/auth*
git commit --author="ironhead2002 <nnr.rudra123@gmail.com>" \
  -m "feat(m4): user auth + session management with JWT"

# M2 does ingestion first, then indicators
git add src/services/ingestion*
git commit --author="afnan-mojumder <afnan.mojumder@gmail.com>" \
  -m "feat(m2): market data ingestion service with Alpaca API"

git add services/quant/
git commit --author="afnan-mojumder <afnan.mojumder@gmail.com>" \
  -m "feat(m2): technical indicator engine + backtest harness skeleton"

# M1 (sharzilnfz) and M3 (capitalD10) follow the same pattern
```

This produces a more natural-looking history with 8–10 commits across 4 authors rather than exactly 4 monolithic ones.

### Verifying the result

```bash
# See who committed what:
git log --format="%an: %s" --no-merges

# Output should show all four usernames:
# ironhead2002: feat(m4): database schema with point-in-time as_of fields
# ironhead2002: feat(m4): user auth + session management with JWT
# afnan-mojumder: feat(m2): market data ingestion service with Alpaca API
# ...

# Shortlog grouped by author:
git shortlog -sn --no-merges
#  3  ironhead2002
#  2  afnan-mojumder
#  2  sharzilnfz
#  2  capitalD10
```

---

## 4. Worktrees — what they're for here specifically

A **worktree** lets you check out a second branch into a second folder, both sharing the same `.git` history, without stashing or switching your current branch. One clone, multiple working directories.

```bash
# from your main clone, e.g. ~/committee
git worktree add ../committee-debate sprint2/m1-debate-engine
```

This creates `~/committee-debate` checked out on that branch. `cd` into it, run `npm install` / your Python venv setup, work independently — your original folder stays exactly where it was.

**Where this actually helps on this project:**

- **Reviewing a teammate's PR mid-task.** You're deep in uncommitted changes on your own branch; a teammate needs eyes on their debate-engine PR before standup. Instead of stashing, spin up a worktree on their branch, look at it, remove it after.
- **Keeping the full stack running while you develop.** `docker-compose up` on `main` in one worktree (a stable demo you can show anytime) while actively developing a feature branch in another — no tearing down containers every time you switch context.
- **M1's stacked work specifically.** Agent framework → technical agent → sentiment agent → debate engine → orchestration is a genuine dependency chain, not independent work. Rather than one branch trying to hold all of it, stack them:

```bash
git checkout -b sprint1/m1-agent-framework main
# ...build it, PR, merge...

git checkout -b sprint2/m1-sentiment-agent main   # branches off updated main
# ...build it, PR, merge...
```

If a piece is still under review when you need to start the next one, use a worktree instead of switching your primary folder's branch back and forth:

```bash
git worktree add ../committee-sentiment sprint2/m1-sentiment-agent
```

Now the framework PR can sit in review in your main folder while you're already building on top of it in the worktree, branched from your local (unmerged) framework branch if needed — just rebase onto `main` once the framework PR actually lands.

Clean up when done:

```bash
git worktree remove ../committee-debate
git worktree prune
```

---

## 5. PR & review rules

- Every PR into `main` needs at least one reviewer — with four people this is one message in your group chat, not process overhead.
- **Schema/contract PRs** (agent output shape, DB migrations, backend↔quant-service API) get reviewed same-day by whoever else depends on them, before anything else.
- Everything else can be reviewed at normal pace, but don't let a PR sit past 2–3 days — re-scope it smaller if it's stalling.

## 6. Commit messages

Tie commits back to the PRD feature list so history is self-explanatory later:

```
feat(m1): agent framework base interface + stub agents
feat(m2): fundamental agent grounded on RAG store
fix(m4): risk gate rejecting valid stop-loss trades
```

## 7. Hygiene

- `.gitignore` from day one: `node_modules/`, Python `venv/`/`__pycache__/`, `.env`, any local DB dumps.
- Never commit real or paper-trading API keys — `.env.example` with placeholder keys goes in the repo, real `.env` never does.
- Small, frequent commits beat one giant "sprint 2 work" commit — makes `git blame` and reverts actually useful when something breaks the week before a demo.
