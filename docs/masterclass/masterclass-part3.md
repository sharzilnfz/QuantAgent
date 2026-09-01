# 🎓 The Committee — Sprint 1 Masterclass (Part 3)

> Continues from [Part 2](./masterclass-part2.md) (Chapters 3–5)

---

# Chapter 6: Spec 06 — Agent Framework & Stubs

> **Owner**: M1 (Agent Architecture Lead)
> **Layer**: L2 (Agent)
> **Purpose**: The reusable base class for all agents, deterministic offline stubs, and the parallel runner
> **Files**: `apps/api/src/agents/`

## What This Spec Builds

Before the real AI agents are ready, the team needs a **framework** — the pipes and plumbing that any agent (real or fake) plugs into. This spec creates:

1. **`BaseAgent`** — an abstract class that every agent extends
2. **Stub agents** — deterministic fakes for testing (no LLM needed)
3. **`runAgents`** — the parallel orchestrator that runs agents concurrently
4. **Persistence** — saving run records and outputs to the database

Think of it like building a factory assembly line before you have the actual robots. The conveyor belts, quality check stations, and packaging boxes are ready — the robots just need to be plugged in.

## The Base Agent

### [src/agents/base.ts](../../apps/api/src/agents/base.ts)

```typescript
export abstract class BaseAgent {
  abstract readonly name: AgentName;

  /** Subclasses implement their logic here. */
  protected abstract run(input: AgentInput): Promise<AgentOutput>;

  /** Public entry point — wraps run() with timeout and validation. */
  async analyze(input: AgentInput): Promise<AgentOutput> {
    try {
      const output = await Promise.race([
        this.run(input),
        timeout(DEFAULT_AGENT_TIMEOUT_MS),   // 30 seconds
      ]);
      return AgentOutput.parse(output);      // Zod validation
    } catch (err) {
      if (err instanceof TimeoutError) {
        return NO_OPINION(this.name, "timeout");
      }
      return NO_OPINION(this.name, "error");
    }
  }
}
```

### 💡 What is an Abstract Class?

An **abstract class** is like a blueprint that says "every agent MUST have a `run()` method, but I don't define what it does." Each specific agent (Technical, Sentiment, Fundamental) provides its own implementation.

```typescript
// You CAN'T do this (abstract = can't instantiate directly):
const agent = new BaseAgent();  // ❌ Error!

// You CAN do this (concrete subclass):
class TechnicalAgent extends BaseAgent {
  readonly name = "technical";
  protected async run(input: AgentInput) {
    // ... technical analysis logic ...
  }
}
const agent = new TechnicalAgent();  // ✅
```

### 💡 The `analyze()` Method — Three Safety Nets

The `analyze()` method wraps every agent's `run()` with three layers of protection:

**Safety Net 1: Timeout**
```typescript
Promise.race([
  this.run(input),                    // The actual work
  timeout(DEFAULT_AGENT_TIMEOUT_MS),  // 30-second bomb
])
```

`Promise.race()` returns whichever finishes first. If `run()` takes too long (maybe the LLM API is slow), the timeout wins and the agent returns a neutral "no opinion" instead of hanging forever.

**Safety Net 2: Zod Validation**
```typescript
return AgentOutput.parse(output);
```

Even if `run()` returns something, it's validated against the `AgentOutput` schema. A malformed response (e.g., confidence of 1.5) is caught here.

**Safety Net 3: Error Catch → NO_OPINION**
```typescript
catch (err) {
  return NO_OPINION(this.name, "error");
}
```

Any uncaught error produces a neutral, zero-confidence output instead of crashing.

### The `NO_OPINION` Fallback

```typescript
export function NO_OPINION(agent: AgentName, reason: string): AgentOutput {
  return {
    agent,
    direction: "neutral",
    confidence: 0,
    rationale: `Agent could not produce an opinion: ${reason}`,
    evidence: {},
  };
}
```

This is the **dead man's switch**. If anything goes wrong — network error, bad LLM response, timeout — the agent says "I have no opinion" with zero confidence. The consensus layer (Sprint 2) will treat this as abstention.

## The Stub Agents

### [src/agents/stubs/](../../apps/api/src/agents/stubs/)

Before the real LLM-powered agents are built, the team needs something to test with. Stubs are **deterministic fakes** — given the same input, they always produce the same output.

### The FNV-1a Hash (Deterministic Randomness)

### [src/agents/stubs/seed.ts](../../apps/api/src/agents/stubs/seed.ts)

```typescript
export function fnv1a(input: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return hash >>> 0; // Force unsigned 32-bit
}
```

### 💡 Why Not `Math.random()`?

`Math.random()` gives a different number every time. For testing, you need **reproducibility** — run the test 100 times, get the same result 100 times.

FNV-1a is a hash function: the same string always produces the same number. By hashing `"technical:AAPL:2024-01-05"`, you get a deterministic "random-looking" number that's consistent across test runs.

### The Stub Technical Agent

```typescript
class StubTechnicalAgent extends BaseAgent {
  readonly name = "technical" as const;

  protected async run(input: AgentInput): Promise<AgentOutput> {
    const seed = fnv1a(`${this.name}:${input.symbol}:${input.decisionTs}`);
    const directions: Direction[] = ["bullish", "bearish", "neutral"];
    const direction = directions[seed % 3];
    const confidence = (seed % 100) / 100;

    return {
      agent: this.name,
      direction,
      confidence,
      rationale: `Stub ${this.name} analysis for ${input.symbol}`,
      evidence: {},
    };
  }
}
```

The same symbol + date always gives the same direction and confidence. Perfect for testing the runner, persistence, and UI without needing an LLM.

## The Parallel Runner

### [src/agents/runner.ts](../../apps/api/src/agents/runner.ts)

```typescript
export async function runAgents(
  input: AgentInput,
  agents: BaseAgent[],
  options: RunOptions,
): Promise<AgentOutput[]> {
  const runId = randomUUID();

  // 1. Create the run record (status: "running")
  await persistence.createRun({
    id: runId,
    symbol: input.symbol,
    timeframe: input.timeframe,
    decisionTs: input.decisionTs,
  });

  // 2. Run ALL agents in parallel
  const results = await Promise.allSettled(
    agents.map(agent => agent.analyze(input))
  );

  // 3. Collect outputs (fulfilled → output, rejected → NO_OPINION)
  const outputs = results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return NO_OPINION(agents[i].name, "unhandled rejection");
  });

  // 4. Save each output to the database
  for (const output of outputs) {
    await persistence.saveOutput(runId, output);
  }

  // 5. Mark the run as completed
  await persistence.finishRun(runId, "completed");

  return outputs;
}
```

### 💡 `Promise.allSettled()` vs `Promise.all()`

```typescript
// Promise.all() — if ANY one fails, EVERYTHING fails
await Promise.all([agentA(), agentB(), agentC()]);
// If agentB throws, you lose agentA and agentC's results too!

// Promise.allSettled() — captures each result independently
await Promise.allSettled([agentA(), agentB(), agentC()]);
// Returns: [
//   { status: "fulfilled", value: outputA },
//   { status: "rejected",  reason: error  },  ← agentB failed
//   { status: "fulfilled", value: outputC },
// ]
```

This is critical because agents are **independent**. If the sentiment agent's API is down, the technical agent's output should still be captured.

## The Persistence Seam

### [src/agents/persistence.ts](../../apps/api/src/agents/persistence.ts)

```typescript
export interface AgentPersistence {
  createRun(run: NewRun): Promise<void>;
  saveOutput(runId: string, output: AgentOutput): Promise<void>;
  finishRun(runId: string, status: "completed" | "failed"): Promise<void>;
}

// Production: writes to Postgres via Drizzle
export class DrizzleAgentPersistence implements AgentPersistence { /* ... */ }

// Tests: stores in-memory
export class InMemoryAgentPersistence implements AgentPersistence { /* ... */ }
```

Another **seam** (like the price bar store). Tests use the in-memory version so they don't need a database.

## The Agent Routes

### [src/agents/plugin.ts](../../apps/api/src/agents/plugin.ts)

### `GET /agents/latest?symbol=AAPL`
```
→ requireAuth
→ Query: latest agent_output for this user + symbol
→ Return AgentOutput or null
```

Used by the dashboard to show the most recent analysis.

### `POST /agents/run`
```
Body: { symbol: "AAPL", timeframe: "1Day" }
→ requireAuth
→ Fetch bars from DB (with as_of <= now)
→ Get latest indicators
→ Build AgentInput
→ runAgents([technicalAgent, ...])
→ Return array of AgentOutputs
```

Triggers a full committee run.

---

# Chapter 7: Spec 07 — Technical Analyst Agent

> **Owner**: M1 (Agent Architecture Lead)
> **Layer**: L2 (Agent)
> **Purpose**: The first real agent — combining deterministic indicator analysis with LLM narration
> **Files**: `apps/api/src/agents/technical/`

## The Architecture: Two Brains, One Output

The Technical Agent has a split-brain architecture that enforces **Law 2 (Facts vs. Narration)**:

```
                    ┌─────────────────────┐
                    │   Indicator Values   │
                    │  (from L1/database)  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                                  ▼
    ┌─────────────────┐              ┌──────────────────┐
    │   CLASSIFIER    │              │   LLM NARRATOR   │
    │  (TypeScript)   │              │   (Claude API)   │
    │                 │              │                   │
    │  IF rsi < 30    │              │  "Given these     │
    │    → oversold   │              │   facts, explain  │
    │  IF macd cross  │              │   what's likely   │
    │    → bearish    │              │   happening..."   │
    │                 │              │                   │
    │  Outputs:       │              │  Outputs:         │
    │  - direction    │              │  - rationale      │
    │  - confidence   │              │  - direction*     │
    │  - evidence     │              │  - confidence*    │
    └────────┬────────┘              └────────┬─────────┘
             │                                │
             └──────────┬─────────────────────┘
                        ▼
              ┌─────────────────┐
              │   BLEND & MERGE │
              │                 │
              │  direction ← CLASSIFIER (always wins)
              │  evidence  ← CLASSIFIER (always wins)
              │  confidence← blend(classifier, LLM)
              │  rationale ← LLM
              └─────────────────┘
```

**The classifier's facts always overwrite the LLM's output.** If the LLM says RSI is 65 but the classifier computed RSI as 28, the final output says 28. The LLM provides prose explanation; the classifier provides ground truth.

## The Deterministic Classifier

### [src/agents/technical/classify.ts](../../apps/api/src/agents/technical/classify.ts)

This file contains pure TypeScript rules — no AI, no randomness, no network calls:

```typescript
export interface MechanicalRead {
  direction: Direction;
  strength: number;      // 0–1 confidence
  score: number;         // raw signed score (-N to +N)
  evidence: Record<string, number | string | boolean>;
}

export function classify(facts: IndicatorFacts): MechanicalRead {
  let score = 0;
  const evidence: Record<string, number | string | boolean> = {};

  // ── RSI Rules ──
  if (facts.rsi !== null) {
    evidence.rsi = facts.rsi;
    if (facts.rsi < 30) {
      score += 1;                          // Oversold → bullish signal
      evidence.rsi_signal = "oversold";
    } else if (facts.rsi > 70) {
      score -= 1;                          // Overbought → bearish signal
      evidence.rsi_signal = "overbought";
    }
  }

  // ── MACD Rules ──
  if (facts.macd !== null && facts.macdSignal !== null) {
    evidence.macd = facts.macd;
    evidence.macdSignal = facts.macdSignal;
    if (facts.macd > facts.macdSignal) {
      score += 1;                          // Bullish crossover
      evidence.macd_signal = "bullish_cross";
    } else {
      score -= 1;                          // Bearish crossover
      evidence.macd_signal = "bearish_cross";
    }
  }

  // ── Bollinger Band Rules ──
  if (facts.close !== null && facts.bbLower !== null && facts.bbUpper !== null) {
    evidence.bbUpper = facts.bbUpper;
    evidence.bbLower = facts.bbLower;
    if (facts.close < facts.bbLower) {
      score += 1;                          // Below lower band → oversold
      evidence.bb_signal = "below_lower";
    } else if (facts.close > facts.bbUpper) {
      score -= 1;                          // Above upper band → overbought
      evidence.bb_signal = "above_upper";
    }
  }

  // ── SMA Rules ──
  if (facts.sma20 !== null && facts.sma50 !== null) {
    evidence.sma20 = facts.sma20;
    evidence.sma50 = facts.sma50;
    if (facts.sma20 > facts.sma50) {
      score += 1;                          // Golden cross → bullish
      evidence.sma_signal = "golden_cross";
    } else {
      score -= 1;                          // Death cross → bearish
      evidence.sma_signal = "death_cross";
    }
  }

  // ── Map score to direction ──
  const direction: Direction =
    score > 0 ? "bullish" :
    score < 0 ? "bearish" :
    "neutral";

  // ── Map absolute score to strength (0–1) ──
  const maxPossible = 4; // RSI + MACD + BB + SMA
  const strength = Math.min(Math.abs(score) / maxPossible, 1);

  return { direction, strength, score, evidence };
}
```

### 💡 How the Scoring Works

Each indicator contributes ±1 to the score. With 4 indicators:

| Score | Direction | Strength | Meaning |
|-------|-----------|----------|---------|
| +4 | bullish | 1.0 | ALL indicators agree → buy |
| +2 | bullish | 0.5 | Most indicators lean bullish |
| 0 | neutral | 0.0 | Mixed signals, no edge |
| -2 | bearish | 0.5 | Most indicators lean bearish |
| -4 | bearish | 1.0 | ALL indicators agree → sell |

**Example**: AAPL has RSI=28 (oversold, +1), MACD above signal (+1), price above upper BB (-1), golden cross (+1). Score = +2 → bullish, strength = 0.5.

## The LLM Client

### [src/agents/technical/llm-client.ts](../../apps/api/src/agents/technical/llm-client.ts)

```typescript
export interface LlmClient {
  completeStructured(params: {
    system: string;
    user: string;
    schema: JsonSchema;
  }): Promise<unknown>;
}

export class AnthropicLlmClient implements LlmClient {
  async completeStructured(params) {
    const response = await fetch(anthropicUrl, {
      method: "POST",
      headers: { "x-api-key": config.ANTHROPIC_API_KEY },
      body: JSON.stringify({
        model: config.LLM_CHEAP_MODEL,           // "claude-haiku-4-5"
        system: params.system,
        messages: [{ role: "user", content: params.user }],
        tools: [{
          name: "emit_agent_output",
          description: "Emit the structured agent output",
          input_schema: params.schema,              // JSON Schema from contracts!
        }],
        tool_choice: { type: "tool", name: "emit_agent_output" },  // FORCED
      }),
    });
    // Extract the tool call's input → that's the structured output
  }
}
```

### 💡 What is Forced Tool Calling?

Normally, an LLM returns free-form text. But we need structured JSON. The trick:

1. Define a "tool" called `emit_agent_output` with the `AgentOutput` JSON Schema
2. Tell the LLM: `tool_choice: { type: "tool", name: "emit_agent_output" }` — "You MUST call this tool"
3. The LLM responds with a tool call containing structured JSON that matches our schema

It's like telling a student: "Write your answer on THIS specific form" instead of "write whatever you want."

### The Prompt

### [src/agents/technical/prompt.ts](../../apps/api/src/agents/technical/prompt.ts)

```typescript
export const TECHNICAL_SYSTEM_PROMPT = `
You are a technical analyst on the committee. Your job is to:
1. Read the pre-computed indicator values (RSI, MACD, Bollinger Bands, SMAs)
2. Provide a direction (bullish/bearish/neutral)
3. Provide a confidence (0.0 to 1.0)
4. Write a clear, concise rationale explaining your analysis

IMPORTANT:
- You MUST use the emit_agent_output tool to respond
- Your direction and confidence should align with the mechanical indicators
- The evidence values you provide will be OVERWRITTEN by computed facts
- Focus your rationale on explaining WHY the indicators suggest this direction
`;
```

The prompt explicitly tells the LLM that its evidence will be overwritten. This sets expectations and focuses the LLM on what it's good at (explanation) rather than what it's bad at (math).

## The Technical Agent: Putting It All Together

### [src/agents/technical/agent.ts](../../apps/api/src/agents/technical/agent.ts)

```typescript
export class TechnicalAgent extends BaseAgent {
  readonly name = "technical" as const;

  protected async run(input: AgentInput): Promise<AgentOutput> {
    // 1. Get the latest indicator snapshot (respecting point-in-time)
    const snapshot = await resolveSnapshot(input);

    // 2. CLASSIFIER: deterministic TypeScript rules
    const mechanical = classify({
      rsi: snapshot?.rsi ?? null,
      macd: snapshot?.macd ?? null,
      macdSignal: snapshot?.macdSignal ?? null,
      bbUpper: snapshot?.bbUpper ?? null,
      bbLower: snapshot?.bbLower ?? null,
      sma20: snapshot?.sma20 ?? null,
      sma50: snapshot?.sma50 ?? null,
      close: lastBar?.close ?? null,
    });

    // 3. LLM NARRATOR: generate explanation
    const prompt = buildTechnicalUserPrompt(input, mechanical);
    const modelOutput = await this.llmClient.completeStructured({
      system: TECHNICAL_SYSTEM_PROMPT,
      user: prompt,
      schema: AgentOutputJsonSchema,
    });

    // 4. Parse and validate the LLM's response
    const parsed = AgentOutput.safeParse(modelOutput);
    if (!parsed.success) return NO_OPINION("technical", "invalid_llm_response");

    // 5. BLEND confidence
    const agree = parsed.data.direction === mechanical.direction;
    const confidence = blendConfidence(
      mechanical.strength,
      parsed.data.confidence,
      agree,
    );

    // 6. ASSEMBLE final output — classifier facts OVERWRITE LLM evidence
    return {
      agent: "technical",
      direction: mechanical.direction,       // ← CLASSIFIER wins
      confidence,                            // ← BLENDED
      rationale: parsed.data.rationale,      // ← LLM narration
      evidence: {
        ...parsed.data.evidence,             // LLM's evidence (base layer)
        ...mechanical.evidence,              // CLASSIFIER overwrites (top layer)
      },
    };
  }
}
```

### 💡 Confidence Blending

```typescript
function blendConfidence(
  mechanicalStrength: number,  // 0–1 from classifier
  modelConfidence: number,     // 0–1 from LLM
  agree: boolean,              // did they pick the same direction?
): number {
  if (agree) {
    // Both agree → boost confidence (weighted toward classifier)
    return 0.7 * mechanicalStrength + 0.3 * modelConfidence;
  } else {
    // They disagree → reduce confidence significantly
    return 0.5 * mechanicalStrength;
  }
}
```

The classifier gets 70% weight because it's deterministic and verifiable. The LLM gets 30% because it might notice patterns the rules miss. When they disagree, confidence is halved — disagreement = uncertainty.

---

# Chapter 8: Spec 08 — Dashboard Shell & Portfolio View

> **Owner**: M3 (Frontend Engineer)
> **Layer**: UI
> **Purpose**: The React application shell, portfolio dashboard, and agent activity display
> **Files**: `apps/web/`

## The Frontend Stack

| Tool | Purpose | Why This Choice |
|------|---------|----------------|
| **React 18** | UI framework | Component model, ecosystem |
| **Vite** | Build tool & dev server | Fast HMR, ESBuild |
| **TanStack Query** | Server state management | Caching, revalidation, loading states |
| **React Router v7** | Client-side routing | URL-based navigation |
| **Recharts** | Chart library | React-native, composable |
| **Tailwind CSS** | Utility-first CSS | Rapid styling via classes |

## The Design Token System

### [src/index.css](../../apps/web/src/index.css)

Instead of hardcoding colors like `bg-blue-500` everywhere, the app uses **CSS custom properties** (design tokens):

```css
:root {
  /* surfaces */
  --surface-page: #f9f9f7;    /* Page background */
  --surface-1: #fcfcfb;       /* Card background */
  --surface-2: #f2f1ed;       /* Inset/well background */

  /* ink (text) */
  --ink-1: #0b0b0b;           /* Primary text */
  --ink-2: #52514e;           /* Secondary text */
  --ink-3: #898781;           /* Tertiary text */

  /* financial semantics */
  --delta-pos: #006300;        /* Positive P&L (green) */
  --delta-neg: #d03b3b;        /* Negative P&L (red) */

  /* agent stance */
  --status-good: #0ca30c;     /* Bullish */
  --status-critical: #d03b3b; /* Bearish */
  --status-neutral: #898781;  /* Neutral */
}

.dark {
  --surface-page: #0d0d0d;    /* Dark mode overrides */
  --surface-1: #1a1a19;
  /* ... */
}
```

### 💡 Why Design Tokens?

Components use **semantic names** instead of raw colors:
```html
<!-- ❌ Bad: what does blue-500 mean here? -->
<div class="bg-blue-500 text-gray-900">

<!-- ✅ Good: roles are clear -->
<div class="bg-surface text-ink">
```

To switch between light and dark mode, you just toggle the `.dark` class on `<html>` — all components automatically update because they reference variables, not hardcoded colors.

## The Application Entry Point

### [src/main.tsx](../../apps/web/src/main.tsx)

```typescript
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>              {/* Light/dark mode context */}
      <QueryClientProvider>      {/* TanStack Query cache */}
        <BrowserRouter>          {/* URL routing */}
          <AppRoutes />          {/* Route table */}
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
```

### 💡 The Provider Pattern (Nesting = Composition)

Each `<Provider>` wraps the app and gives its children access to shared state:
- `ThemeProvider` → any component can call `useTheme()` to get/toggle the theme
- `QueryClientProvider` → any component can use `useQuery()` to fetch data
- `BrowserRouter` → any component can use `useNavigate()` for routing

## The Route Table

### [src/App.tsx](../../apps/web/src/App.tsx)

```typescript
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>           {/* Auth guard wrapper */}
        <Route path="/" element={<PortfolioPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
```

Three routes:
1. `/login` → Login/Register page (public)
2. `/` → Portfolio dashboard (protected)
3. `*` → Anything else redirects to `/`

The `RequireAuth` component is a **layout route** — it wraps protected routes with an authentication check:

```typescript
export function RequireAuth() {
  const session = useSession();

  if (session.isPending) return <FullPageLoader />;        // Still checking...
  if (session.isError || !session.data) return <Navigate to="/login" />;  // Not logged in

  return <AppLayout user={session.data} />;                // ✅ Authenticated
}
```

## The API Client Layer

### [src/lib/api.ts](../../apps/web/src/lib/api.ts)

This module handles all HTTP communication with the backend:

```typescript
export const api = {
  me(signal?) { /* GET /api/auth/me */ },
  login(credentials) { /* POST /api/auth/login */ },
  register(credentials) { /* POST /api/auth/register */ },
  logout() { /* POST /api/auth/logout */ },
  portfolio(signal?) { /* GET /api/portfolio */ },
  portfolioHistory(signal?) { /* GET /api/portfolio/history */ },
  latestAgentOutput(symbol, signal?) { /* GET /api/agents/latest?symbol=X */ },
  watchlist(signal?) { /* GET /api/watchlist */ },
};
```

### 💡 Contract Validation on the Frontend

```typescript
async portfolio(signal?) {
  const payload = await request("/portfolio", { signal });
  return parseContract(PortfolioState, payload, "/portfolio");
}

function parseContract(schema, payload, path) {
  try {
    return schema.parse(payload);  // Zod validation!
  } catch {
    throw contractError(path);     // "API returned invalid data"
  }
}
```

Even the **frontend** validates API responses with Zod! If the API sends malformed data, the frontend throws a clean error instead of silently rendering garbage. This is Law 3 in action — validate at every boundary.

### The Vite Proxy

```typescript
// vite.config.ts
server: {
  proxy: {
    "/api": {
      target: "http://localhost:3000",
      rewrite: (p) => p.replace(/^\/api/, ""),
    },
  },
}
```

In development, the frontend runs on `localhost:5173` and the API on `localhost:3000`. The proxy rewrites `/api/portfolio` → `http://localhost:3000/portfolio`, solving CORS issues during development.

## TanStack Query (React Query) — Smart Data Fetching

### [src/lib/queries.ts](../../apps/web/src/lib/queries.ts)

### 💡 What Problem Does React Query Solve?

Without React Query, every component fetches data manually:
```typescript
// ❌ Manual: lots of boilerplate, no caching, no coordination
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  fetch("/api/portfolio")
    .then(res => res.json())
    .then(setData)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);
```

With React Query:
```typescript
// ✅ React Query: automatic caching, loading states, error handling
const { data, isPending, isError, error, refetch } = useQuery({
  queryKey: ["portfolio"],
  queryFn: ({ signal }) => api.portfolio(signal),
});
```

React Query handles:
- **Caching** — the portfolio data is cached for 30 seconds
- **Background refetching** — stale data is refreshed automatically
- **Loading states** — `isPending`, `isError`, `isFetching`
- **Deduplication** — if 3 components need portfolio data, only 1 request fires
- **Abort signals** — navigating away cancels pending requests

### The Custom Hooks

```typescript
// Session check — cached for 5 minutes (login status doesn't change often)
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,          // ["auth", "me"]
    queryFn: ({ signal }) => api.me(signal),
    staleTime: 5 * 60_000,               // 5 minutes
  });
}

// Portfolio data — cached for 30 seconds (default staleTime)
export function usePortfolio() {
  return useQuery({
    queryKey: queryKeys.portfolio,        // ["portfolio"]
    queryFn: ({ signal }) => api.portfolio(signal),
  });
}

// Logout — clears ALL cached data and redirects
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api.logout(),
    onSettled: () => {
      queryClient.clear();               // Wipe all cached data
      navigate("/login", { replace: true });
    },
  });
}
```

## The Portfolio Page (Main Dashboard)

### [src/routes/PortfolioPage.tsx](../../apps/web/src/routes/PortfolioPage.tsx)

The dashboard is composed of four sections:

```
┌──────────────────────────────────────────────────────┐
│  KPI Row: Cash | Equity | Unrealized P&L             │
├──────────────────────────────────┬───────────────────┤
│                                  │                   │
│  Portfolio Value Chart           │  Agent Activity    │
│  (Equity over time, area chart)  │  (Latest analysis  │
│                                  │   for selected     │
│                                  │   watchlist symbol) │
│                                  │                   │
├──────────────────────────────────┴───────────────────┤
│  Positions Table: Symbol | Qty | Market Value | P&L  │
└──────────────────────────────────────────────────────┘
```

### Loading State Handling

Every section handles three states: **loading**, **error**, and **empty**:

```typescript
{portfolio.isPending ? (
  <KpiRowSkeleton />                    // Gray shimmer boxes
) : portfolio.isError ? (
  <ErrorState
    title="Couldn't load your portfolio"
    detail={portfolio.error.message}
    onRetry={() => portfolio.refetch()}  // Retry button
  />
) : portfolio.data ? (
  <KpiRow portfolio={portfolio.data} /> // Actual content
) : (
  <EmptyState
    title="No portfolio snapshot yet"
    detail="Cash, equity and P&L will appear here..."
  />
)}
```

### 💡 Why the `Stale` Wrapper?

```typescript
<Stale isStale={portfolio.isFetching}>
  <KpiRow portfolio={portfolio.data} />
</Stale>
```

`isFetching` is true when React Query is refetching in the background (you already have stale data, but fresh data is loading). The `<Stale>` component applies a slight opacity reduction — the user sees the old data but knows it's refreshing.

## The Agent Activity Card

### [src/components/agents/AgentActivityCard.tsx](../../apps/web/src/components/agents/AgentActivityCard.tsx)

This renders the latest agent output:

```
┌──────────────────────────────┐
│  ● Bullish     ████████░░ 72%│  DirectionBadge + ConfidenceMeter
│                              │
│  RSI at 28.5 suggests the    │  Rationale (LLM-generated text)
│  stock is oversold. MACD     │
│  crossover confirms upward   │
│  momentum...                 │
│                              │
│  ▶ Evidence                  │  EvidenceDisclosure (collapsible)
│    rsi: 28.5                 │
│    macd: 0.42                │
│    sma_signal: golden_cross  │
└──────────────────────────────┘
```

### The Direction Badge

```typescript
function DirectionBadge({ direction }: { direction: Direction }) {
  const styles = {
    bullish:  "bg-status-good/10 text-status-good",     // Green
    bearish:  "bg-status-critical/10 text-status-critical", // Red
    neutral:  "bg-status-neutral/10 text-status-neutral",   // Gray
  };

  const icons = {
    bullish:  "↑",
    bearish:  "↓",
    neutral:  "→",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[direction]}`}>
      {icons[direction]} {direction}
    </span>
  );
}
```

### The Confidence Meter

```typescript
function ConfidenceMeter({ confidence }: { confidence: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-meter-track">
      <div
        className="h-full rounded-full bg-meter-fill transition-all duration-300"
        style={{ width: `${Math.round(confidence * 100)}%` }}
      />
    </div>
  );
}
```

A horizontal bar that fills proportionally to confidence. At 72% confidence, the bar is 72% full.

## The Theme System

### [src/theme/ThemeProvider.tsx](../../apps/web/src/theme/ThemeProvider.tsx)

Three theme modes:
- **`"light"`** — always light
- **`"dark"`** — always dark
- **`"system"`** — follows the OS preference

```typescript
export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readStoredPreference);
  const [systemIsDark, setSystemIsDark] = useState(prefersDark);

  // Listen for OS theme changes
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", (e) => setSystemIsDark(e.matches));
  }, []);

  // Resolve: if preference is "system", follow OS
  const resolved = preference === "system"
    ? (systemIsDark ? "dark" : "light")
    : preference;

  // Apply the class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);
}
```

### 💡 Flash-Free Dark Mode

Notice this script in `index.html`:
```html
<script>
  (function () {
    var stored = localStorage.getItem('committee.theme');
    var dark = stored === 'dark' || (/* ... system check ... */);
    document.documentElement.classList.toggle('dark', dark);
  })();
</script>
```

This runs **before React loads**, setting the theme class immediately. Without this, users would see a flash of light mode before dark mode kicks in (the infamous "FOUT" — Flash of Unstyled Theme).

## The UI Primitives

### Skeleton Loading States

```typescript
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-surface-well", className)} />
  );
}
```

Gray shimmer boxes that match the shape of the real content:
```typescript
<KpiRowSkeleton />  // Three shimmer tiles matching the KPI layout
<Skeleton className="h-[260px] w-full" />  // Chart placeholder
```

### Error States with Retry

```typescript
export function ErrorState({ title, detail, onRetry }) {
  return (
    <div className="rounded-xl border p-6 text-center">
      <h3>{title}</h3>
      <p>{detail}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}
```

### The `cn()` Helper

```typescript
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
```

A tiny utility for conditional CSS classes:
```typescript
cn("px-3 py-2", isActive && "bg-surface-well", disabled && "opacity-50")
// → "px-3 py-2 bg-surface-well" (if active, not disabled)
```

---

# Chapter 9: Follow-Ups & Known Bugs

### [specs/sprint-1/FOLLOW-UPS.md](../../specs/sprint-1/FOLLOW-UPS.md)

The team maintains a living document of known issues:

| Issue | Status | Impact |
|-------|--------|--------|
| Portfolio history endpoint returns empty | Expected | Chart says "not enough history" |
| Unrealized P&L not in PortfolioState | Design gap | KPI tile shows "Not reported" |
| Indicator warm-up for <50 bars | Expected | Indicators show null |
| Stub agents are deterministic fakes | Expected | Replace with real LLM agents |
| Signals & Debate pages disabled | Planned | Show "Soon" badge |

---

# Chapter 10: Summary — The Full Picture

## Data Flow: End to End

```
  Alpaca API                                                    Browser
     │                                                            │
     │  1. Fetch prices                                           │
     ▼                                                            │
┌──────────┐                                                      │
│ Ingest   │ as_of rules, normalization, upsert                   │
│ (Spec 04)│──────► price_bars table                              │
└──────────┘           │                                          │
                       │  2. Compute indicators                   │
                       ▼                                          │
               ┌──────────────┐                                   │
               │ Quant Service│ RSI, MACD, BB, SMA                │
               │  (Spec 05)   │──────► indicator_snapshots table  │
               └──────────────┘           │                       │
                                          │  3. Run agents        │
                                          ▼                       │
                              ┌──────────────────┐                │
                              │ Agent Framework   │                │
                              │   (Spec 06)       │                │
                              │                   │                │
                              │ ┌───────────────┐ │                │
                              │ │ Technical     │ │                │
                              │ │ Agent (07)    │ │                │
                              │ │ classify()    │ │                │
                              │ │ + LLM narrate │ │                │
                              │ └───────┬───────┘ │                │
                              │         │         │                │
                              │ agent_runs +      │                │
                              │ agent_outputs     │                │
                              └────────┬──────────┘                │
                                       │                          │
                                       │  4. API serves data      │
                                       ▼                          │
                              ┌──────────────────┐                │
                              │  Fastify API     │                │
                              │  Auth (Spec 03)  │◄───────────────┤
                              │  Portfolio       │  GET /portfolio │
                              │  Agents          │  GET /agents/..│
                              └──────────────────┘  POST /auth/.. │
                                                         │        │
                                                         │        │
                                                         ▼        │
                                                  ┌────────────┐  │
                                                  │  React App  │  │
                                                  │  (Spec 08)  │──┘
                                                  │             │
                                                  │  Dashboard  │
                                                  │  KPI Row    │
                                                  │  Chart      │
                                                  │  Agent Card │
                                                  │  Positions  │
                                                  └────────────┘
```

## The Three Laws, Enforced Everywhere

| Law | Where Enforced | How |
|-----|---------------|-----|
| **Point-in-Time** | `as_of` on every fact table | `WHERE as_of <= decision_ts` |
| | `as-of.ts` in ingest | Future bars dropped, not clamped |
| | `agent_runs.decision_ts` | Temporal boundary for all queries |
| **Facts vs. Narration** | `classify.ts` | TypeScript rules compute direction |
| | `agent.ts` | Classifier evidence overwrites LLM |
| | Frontend | "Not reported" instead of summing P&L |
| **Schema-First** | `AgentOutput.parse()` | Every agent output Zod-validated |
| | Frontend `parseContract()` | API responses validated client-side |
| | `NO_OPINION()` | Invalid output → neutral, not crash |

## What Sprint 2 Brings

- **L3 Consensus**: 2-of-3 majority check + structured debate when agents disagree
- **L4 Risk**: Deterministic rules engine (position limits, drawdown circuit breaker)
- **Orchestrator**: Full pipeline from data → agents → debate → risk → (Sprint 3) execution

---

> 🎓 **You've completed the Sprint 1 Masterclass!**
>
> You now understand every table, every service, every route, every component,
> every React hook, every security decision, and every architectural invariant
> in the QuantAgent codebase.
>
> [← Part 1: Big Picture, Database, Contracts](./masterclass-part1.md)
> [← Part 2: Auth, Ingestion, Indicators](./masterclass-part2.md)
