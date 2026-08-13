# 🧰 The Committee — Tech Stack Crash Course

> **A beginner-friendly guide to every technology powering the QuantAgent codebase.**
> Each section explains: What is it? → Why do we use it? → How does it work? → Where is it used?

---

## Table of Contents

| # | Technology | Role in Project |
|---|-----------|-----------------|
| 1 | [TypeScript](#1-typescript) | The language everything is written in |
| 2 | [Node.js](#2-nodejs) | The JavaScript runtime (server-side) |
| 3 | [pnpm & Monorepos](#3-pnpm--monorepos) | Package manager & project structure |
| 4 | [Fastify](#4-fastify) | The API web framework |
| 5 | [Zod](#5-zod) | Runtime schema validation |
| 6 | [PostgreSQL](#6-postgresql) | The relational database |
| 7 | [Drizzle ORM](#7-drizzle-orm) | TypeScript ↔ Database bridge |
| 8 | [React](#8-react) | The frontend UI library |
| 9 | [Vite](#9-vite) | Frontend build tool & dev server |
| 10 | [TanStack Query](#10-tanstack-query-react-query) | Server-state management for React |
| 11 | [React Router](#11-react-router) | Client-side URL routing |
| 12 | [Tailwind CSS](#12-tailwind-css) | Utility-first CSS framework |
| 13 | [Recharts](#13-recharts) | React charting library |
| 14 | [Python, FastAPI, pandas, numpy](#14-python-fastapi-pandas-numpy) | The quant/indicator service |
| 15 | [Docker & Docker Compose](#15-docker--docker-compose) | Containerized deployment |
| 16 | [Vitest & Testing Library](#16-vitest--testing-library) | Testing framework |
| 17 | [External APIs: Alpaca & Anthropic](#17-external-apis-alpaca--anthropic) | Market data & LLM intelligence |
| 18 | [Supporting Cast](#18-supporting-cast) | bcrypt, dotenv, crypto, uuid, etc. |

---

# 1. TypeScript

## What Is It?

TypeScript is **JavaScript with types**. It's a superset of JavaScript — every valid JS file is valid TS, but TS adds a type system that catches bugs *before* you run your code.

## Why Do We Use It?

JavaScript is dynamically typed:
```javascript
// JavaScript — no errors until runtime
function add(a, b) { return a + b; }
add(5, "hello");  // Returns "5hello" — no error, just wrong!
```

TypeScript catches this at compile time:
```typescript
// TypeScript — error BEFORE you run it
function add(a: number, b: number): number { return a + b; }
add(5, "hello");  // ❌ Compile error: '"hello"' is not assignable to type 'number'
```

In a codebase with 40+ files and 4 team members, types are **documentation that the computer enforces**.

## Key Concepts Used in the Codebase

### Types & Interfaces

```typescript
// A type describes the SHAPE of data
type AuthUser = {
  id: string;
  email: string;
};

// An interface is similar but can be extended
interface PriceBar {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Usage: TypeScript enforces the shape
const user: AuthUser = { id: "abc", email: "test@x.com" };  // ✅
const user: AuthUser = { id: "abc" };  // ❌ Missing 'email'
```

### Generics — "Type Parameters"

```typescript
// A function that works with ANY type
function firstItem<T>(arr: T[]): T | undefined {
  return arr[0];
}

firstItem<string>(["a", "b"]);   // Returns string
firstItem<number>([1, 2, 3]);    // Returns number
```

Used heavily in React Query:
```typescript
useQuery<PortfolioState>({  // "This query returns a PortfolioState"
  queryKey: ["portfolio"],
  queryFn: () => api.portfolio(),
});
```

### Union Types & Literal Types

```typescript
// A value can be ONE of several types
type Direction = "bullish" | "bearish" | "neutral";

let d: Direction = "bullish";   // ✅
let d: Direction = "sideways";  // ❌ Not in the union
```

### `as const` — Readonly Tuples

```typescript
// Without 'as const': TypeScript sees string[]
const keys = ["auth", "me"];  // type: string[]

// With 'as const': TypeScript sees the exact values
const keys = ["auth", "me"] as const;  // type: readonly ["auth", "me"]
```

Used for React Query keys:
```typescript
export const queryKeys = {
  session: ["auth", "me"] as const,
  portfolio: ["portfolio"] as const,
};
```

### `async`/`await` — Handling Asynchronous Code

```typescript
// Promises represent a future value
// async/await makes them readable

// ❌ Hard to read (callback pyramid)
fetch("/api/data")
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));

// ✅ Easy to read (async/await)
async function getData() {
  try {
    const res = await fetch("/api/data");
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}
```

Every API handler, database query, and network call in the codebase uses `async`/`await`.

### Module System (`import`/`export`)

```typescript
// enums.ts — EXPORTING
export const Direction = z.enum(["bullish", "bearish", "neutral"]);

// agents.ts — IMPORTING
import { Direction } from "./enums";
```

The `export` keyword makes something available to other files. `import` brings it in. This is how the codebase is organized into small, focused files.

---

# 2. Node.js

## What Is It?

Node.js is a **JavaScript runtime** — it lets you run JavaScript outside a web browser. Before Node.js, JavaScript could only run in browsers. Node.js uses Chrome's V8 engine to run JS on servers.

## Why Do We Use It?

- **Same language** front and back: TypeScript on both sides
- **Non-blocking I/O**: Handles thousands of simultaneous connections efficiently
- **Massive ecosystem**: Over 2 million packages on npm
- **Perfect for APIs**: Fast for I/O-heavy tasks (database queries, HTTP requests)

## Key Concepts

### The Event Loop

Node.js runs on a **single thread** but handles concurrency through an event loop:

```
┌───────────────────────────┐
│       Your Code           │   "Start fetching from DB"
│  const data = await db()  │──────────►
│  console.log(data)        │           │
└───────────────────────────┘           │
                                        │  (DB is working...)
         Meanwhile, Node handles        │  (other requests keep flowing)
         other incoming requests        │
                                        │
┌───────────────────────────┐           │
│  Callback fires:          │◄──────────┘  "DB returned data"
│  data is now available    │
│  console.log(data) runs   │
└───────────────────────────┘
```

This is why `async`/`await` is everywhere — Node.js doesn't block while waiting for I/O.

### Built-in Modules Used in the Codebase

```typescript
import { randomUUID } from "node:crypto";       // Generate UUIDs for sessions
import { createCipheriv } from "node:crypto";    // AES encryption for credentials
import { readFileSync } from "node:fs";          // Read files from disk (cache)
import { join } from "node:path";                // Build file paths safely
```

The `node:` prefix explicitly imports Node.js built-in modules (vs. npm packages).

### `process.env` — Environment Variables

```typescript
const dbUrl = process.env.DATABASE_URL;          // Read from environment
const port = process.env.API_PORT ?? "3000";     // With fallback
```

Environment variables are key-value pairs set OUTSIDE the code (in `.env` files, Docker, or the shell). They configure the app without hardcoding secrets.

---

# 3. pnpm & Monorepos

## What Is pnpm?

**pnpm** (Performant npm) is a package manager — it installs, manages, and links JavaScript dependencies. It's an alternative to `npm` and `yarn`.

## Why pnpm Over npm?

| Feature | npm | pnpm |
|---------|-----|------|
| Disk usage | Copies packages to every project | Shares via symlinks (content-addressable store) |
| Install speed | Moderate | 2–3× faster |
| `node_modules` structure | Flat (allows phantom deps) | Strict (only declared deps are accessible) |
| Workspace support | Basic | First-class |

**Phantom dependency example**: With npm, if package A depends on package B, you can accidentally import B directly (even though YOUR project doesn't declare it). pnpm prevents this.

## Workspaces (The Monorepo Tool)

### [pnpm-workspace.yaml](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/pnpm-workspace.yaml)

```yaml
packages:
  - packages/*     # @committee/db, @committee/contracts
  - apps/api       # The Fastify backend
  - apps/web       # The React frontend
```

This tells pnpm: "These folders are all part of one project." Each has its own `package.json`, but they can reference each other:

```json
// apps/api/package.json
{
  "dependencies": {
    "@committee/contracts": "workspace:*",
    "@committee/db": "workspace:*"
  }
}
```

**`workspace:*`** means "use the local version from this monorepo, not a published npm package." When you change code in `packages/contracts`, `apps/api` sees the change immediately — no publishing step.

### Common pnpm Commands

```bash
pnpm install                          # Install all dependencies
pnpm --filter @committee/api dev      # Run dev server for just the API
pnpm --filter @committee/web build    # Build just the frontend
pnpm -r typecheck                     # Typecheck ALL packages recursively
```

---

# 4. Fastify

## What Is It?

Fastify is a **web framework for Node.js** — it handles incoming HTTP requests and sends responses. It's the backbone of the API server.

## Why Fastify Over Express?

| Feature | Express | Fastify |
|---------|---------|---------|
| Speed | ~15,000 req/s | ~75,000 req/s |
| Validation | DIY (middleware) | Built-in (JSON Schema) |
| TypeScript | Bolted on | First-class |
| Plugins | Middleware (leaky) | Encapsulated plugins |
| Logging | DIY | Built-in (pino) |

## Key Concepts

### Routes — Mapping URLs to Code

```typescript
// When someone sends GET /health, run this function
app.get("/health", async () => ({ status: "ok" }));

// When someone sends POST /auth/login with a JSON body, run this
app.post("/auth/login", async (request, reply) => {
  const { email, password } = request.body;
  // ... authenticate ...
  return reply.code(200).send({ user });
});
```

### Plugins — Modular Code Organization

```typescript
// Each domain area is a "plugin" — a self-contained module
export async function authPlugin(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => { /* ... */ });
  app.post("/auth/login",    async (request, reply) => { /* ... */ });
  app.post("/auth/logout",   async (request, reply) => { /* ... */ });
  app.get("/auth/me",        async (request, reply) => { /* ... */ });
}

// Registered in the composition root (app.ts)
await app.register(authPlugin);
await app.register(credentialsPlugin);
await app.register(ingestPlugin);
await app.register(portfolioPlugin);
await app.register(agentsPlugin);
```

**Encapsulation**: Plugins are isolated. An error handler registered inside `authPlugin` doesn't affect `portfolioPlugin`. This is a major advantage over Express middleware, which is global.

### Hooks (Lifecycle) — Running Code at Specific Points

```typescript
// preHandler runs BEFORE the route handler
app.get("/portfolio", {
  preHandler: requireAuth,        // Check auth FIRST
}, async (request, reply) => {
  // This only runs if requireAuth didn't reply with 401
  const portfolio = await getPortfolio(request.user.id);
  return portfolio;
});
```

Fastify's lifecycle:

```
Request In → onRequest → preParsing → preValidation → preHandler → HANDLER → onSend → onResponse
                                                         ↑
                                              requireAuth runs here
```

### The `request` and `reply` Objects

```typescript
app.post("/auth/login", async (request, reply) => {
  request.body;        // The parsed JSON body
  request.params;      // URL params (e.g., /users/:id → request.params.id)
  request.query;       // Query string (e.g., ?symbol=AAPL → request.query.symbol)
  request.cookies;     // Cookies sent by the browser
  request.headers;     // HTTP headers
  request.user;        // Custom property set by requireAuth

  reply.code(200);     // Set status code
  reply.send({ data }); // Send JSON response
  reply.setCookie("name", "value", options); // Set a cookie
  reply.clearCookie("name");                 // Remove a cookie
});
```

### Logging (pino)

Fastify uses **pino** — a very fast JSON logger:

```typescript
request.log.info({ symbol: "AAPL" }, "Ingesting prices");
// Output: {"level":30,"time":1706...,"symbol":"AAPL","msg":"Ingesting prices"}

request.log.error({ err: error.message }, "Session lookup failed");
```

JSON logs are machine-parseable — tools like Datadog and Grafana can search and filter them.

---

# 5. Zod

## What Is It?

Zod is a **schema validation library** for TypeScript. It lets you define data shapes and validate unknown data at runtime.

## Why Do We Use It?

TypeScript types disappear after compilation. At runtime, there's no guarantee that data from an API, a database, or an LLM matches the expected shape. Zod bridges this gap.

```typescript
// TypeScript type — gone at runtime
type User = { name: string; age: number };

// Zod schema — exists at runtime AND generates the TS type
const User = z.object({ name: z.string(), age: z.number() });
type User = z.infer<typeof User>;  // Same TypeScript type, auto-generated
```

## The Full Zod Toolkit (Used in the Codebase)

### Primitives

```typescript
z.string()                    // Any string
z.number()                    // Any number
z.boolean()                   // true or false
z.string().uuid()             // Must be a valid UUID format
z.string().email()            // Must be a valid email
z.string().datetime()         // Must be ISO-8601 datetime
z.string().min(1).max(2000)   // Length constraints
z.number().min(0).max(1)      // Range constraints (confidence)
z.number().int().positive()   // Must be positive integer
```

### Enums

```typescript
const Direction = z.enum(["bullish", "bearish", "neutral"]);
Direction.parse("bullish");    // ✅ "bullish"
Direction.parse("sideways");   // ❌ throws ZodError
```

### Objects

```typescript
const AgentOutput = z.object({
  agent: AgentName,
  direction: Direction,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(2000),
  evidence: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
});
```

### Arrays

```typescript
z.array(PriceBar)             // Array of PriceBar objects
z.array(z.string())           // Array of strings
```

### Nullable & Optional

```typescript
z.number().nullable()          // number | null  (value exists but is null)
z.unknown().optional()         // value might not exist at all (undefined)
```

### `.default()` — Provide Fallback

```typescript
z.record(z.string(), z.number()).default({})
// If the field is missing → use empty object {}
```

### `.pick()` — Select Specific Fields

```typescript
const PortfolioPoint = PortfolioState.pick({ asOf: true, equity: true });
// Only { asOf: string, equity: number } — used for the chart endpoint
```

### Parsing Methods

```typescript
// .parse() — throws on failure
const output = AgentOutput.parse(data);  // ✅ or throws ZodError

// .safeParse() — returns a result object (no throw)
const result = AgentOutput.safeParse(data);
if (result.success) {
  console.log(result.data);   // Validated data
} else {
  console.log(result.error);  // ZodError with details
}
```

### `zodToJsonSchema()` — For LLM Structured Output

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";

const jsonSchema = zodToJsonSchema(AgentOutput, "AgentOutput");
// Produces a JSON Schema object that Claude/GPT can use for structured output
```

### Where Zod Is Used in the Codebase

| Location | What It Validates |
|----------|-------------------|
| `packages/contracts` | Shared data shapes (AgentOutput, PriceBar, etc.) |
| `apps/api/src/config.ts` | Environment variables at boot |
| `apps/api/src/auth/schemas.ts` | Login/register request bodies |
| `apps/api/src/agents/base.ts` | Agent outputs before persistence |
| `apps/web/src/lib/api.ts` | API responses before rendering |

---

# 6. PostgreSQL

## What Is It?

PostgreSQL (Postgres) is an open-source **relational database**. Data is stored in tables with rows and columns, linked by foreign keys.

## Why PostgreSQL?

- **Rock solid**: 35+ years of development, used by Instagram, Spotify, Apple
- **Rich types**: UUID, JSONB, timestamptz, numeric, arrays, enums
- **Extensions**: pgvector (vector search for AI), pgcrypto (UUID generation)
- **ACID compliance**: Transactions are reliable (no half-written data)

## Key Concepts Used in the Codebase

### Tables, Columns, Rows

```
┌─────────────────────────────────────────────────────────┐
│                        users                             │
├────────────────┬──────────┬────────────────┬─────────────┤
│ id (uuid)      │ email    │ password_hash  │ created_at  │
├────────────────┼──────────┼────────────────┼─────────────┤
│ 550e8400-...   │ alice@.. │ $2a$10$xyz...  │ 2024-01-01  │
│ 6ba7b810-...   │ bob@..   │ $2a$10$abc...  │ 2024-01-02  │
└────────────────┴──────────┴────────────────┴─────────────┘
  ← column →       ← column →   ← column →     ← column →
  ↑ row ↑          ↑ row ↑
```

### Data Types Used

| Postgres Type | TypeScript Equivalent | Usage |
|---------------|----------------------|-------|
| `uuid` | `string` | Primary keys, session IDs |
| `text` | `string` | Emails, rationale, symbols |
| `numeric` | `number` (precise) | Prices, money, confidence |
| `timestamptz` | `Date` | All timestamps (UTC) |
| `jsonb` | `object` | Indicator values, agent payloads |
| `boolean` | `boolean` | Flags |
| Custom enums | String unions | Direction, timeframe, etc. |

### `timestamptz` — Timezone-Aware Timestamps

```sql
-- timestamptz stores everything in UTC internally
-- Displays in your local timezone
INSERT INTO events (ts) VALUES ('2024-01-05 16:00:00 America/New_York');
-- Stored as: 2024-01-05 21:00:00+00 (UTC)
```

**Why `timestamptz` over `timestamp`?** Without timezone info, `16:00:00` is ambiguous — 4 PM *where*? With `timestamptz`, the database always knows the absolute moment in time.

### `numeric` vs `real`/`float`

```sql
-- numeric: exact decimal arithmetic (for money)
SELECT 0.1::numeric + 0.2::numeric;  -- 0.3 ✅

-- real/float: approximate (for science, not money)
SELECT 0.1::real + 0.2::real;        -- 0.30000001192... ❌
```

### `jsonb` — Structured JSON in a Column

```sql
-- Store complex objects in a single column
INSERT INTO indicator_snapshots (indicators) VALUES
  ('{"rsi": 28.5, "macd": -0.42, "sma20": 189.5}'::jsonb);

-- Query inside the JSON
SELECT * FROM indicator_snapshots
WHERE (indicators->>'rsi')::numeric < 30;
```

### Indexes — Making Queries Fast

```sql
-- Without index: scan ALL rows (slow for millions of rows)
SELECT * FROM price_bars WHERE as_of <= '2024-01-05';

-- With index: jump directly to matching rows (fast)
CREATE INDEX price_bars_as_of_idx ON price_bars (as_of);
```

### Foreign Keys — Linking Tables

```sql
-- sessions.user_id REFERENCES users.id
-- This means: every session MUST belong to an existing user
-- ON DELETE CASCADE: if user is deleted, their sessions auto-delete

INSERT INTO sessions (user_id) VALUES ('nonexistent-uuid');
-- ❌ ERROR: violates foreign key constraint
```

### Unique Constraints

```sql
-- No duplicate (symbol, timeframe, ts) combinations
CONSTRAINT price_bars_symbol_tf_ts_uq UNIQUE (symbol, timeframe, ts)

-- Allows upsert: "insert or update if exists"
INSERT INTO price_bars (...) VALUES (...)
ON CONFLICT (symbol, timeframe, ts) DO UPDATE SET ...;
```

### Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid() for UUIDs
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector for AI embeddings (Sprint 3)
```

---

# 7. Drizzle ORM

## What Is It?

Drizzle is a **TypeScript ORM** (Object-Relational Mapper). It translates between TypeScript objects and SQL queries.

## Why Drizzle Over Prisma?

| Feature | Prisma | Drizzle |
|---------|--------|---------|
| Schema location | Separate `.prisma` file | TypeScript files |
| Query style | Method chaining | SQL-like syntax |
| Bundle size | ~10MB runtime | ~50KB |
| SQL knowledge required | Low | Medium |
| Type inference | Generated | Inferred from schema |
| Migration approach | Shadow database | SQL diff |

Drizzle was chosen because the team needs **fine-grained SQL control** for point-in-time queries while keeping type safety.

## How It Works

### 1. Define Tables in TypeScript

```typescript
// packages/db/src/schema/users.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 2. Generate Migrations

```bash
pnpm drizzle-kit generate
# Creates: migrations/0000_ancient_rictor.sql
# Contains: CREATE TABLE users (...); etc.
```

### 3. Run Migrations

```bash
pnpm drizzle-kit migrate
# Applies the SQL to your actual database
```

### 4. Query with Type Safety

```typescript
import { eq } from "drizzle-orm";
import { users } from "@committee/db/schema";

// SELECT id, email FROM users WHERE email = 'alice@example.com' LIMIT 1
const rows = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(eq(users.email, "alice@example.com"))
  .limit(1);

// TypeScript knows: rows is { id: string; email: string }[]
```

### 5. Insert Data

```typescript
// INSERT INTO users (email, password_hash) VALUES (...) RETURNING id, email
const inserted = await db
  .insert(users)
  .values({ email: "alice@example.com", passwordHash: "$2a$10$..." })
  .returning({ id: users.id, email: users.email });
```

### 6. Upsert (Insert or Update)

```typescript
// INSERT ... ON CONFLICT (symbol, timeframe, ts) DO UPDATE
await db
  .insert(priceBars)
  .values(bar)
  .onConflictDoUpdate({
    target: [priceBars.symbol, priceBars.timeframe, priceBars.ts],
    set: { open: bar.open, high: bar.high, /* ... */ },
  });
```

### 7. Joins

```typescript
// SELECT ... FROM sessions JOIN users ON sessions.user_id = users.id
const rows = await db
  .select({
    sessionId: sessions.id,
    email: users.email,
  })
  .from(sessions)
  .innerJoin(users, eq(sessions.userId, users.id))
  .where(eq(sessions.id, sessionId));
```

### 8. Inferred Types

```typescript
// Drizzle automatically infers row types from your schema
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

type User = InferSelectModel<typeof users>;
// = { id: string; email: string; passwordHash: string; createdAt: Date }

type NewUser = InferInsertModel<typeof users>;
// = { id?: string; email: string; passwordHash: string; createdAt?: Date }
// (id and createdAt are optional because they have defaults)
```

---

# 8. React

## What Is It?

React is a **JavaScript library for building user interfaces**. It lets you break your UI into reusable **components** and manages efficiently updating the DOM when data changes.

## Why React?

- **Component model**: Build UIs from small, reusable pieces
- **Declarative**: Describe *what* the UI should look like, not *how* to update it
- **Ecosystem**: Largest frontend ecosystem (libraries, tools, community)
- **One-way data flow**: Data flows down from parent to child (predictable)

## Key Concepts

### Components — Building Blocks

```typescript
// A component is a function that returns JSX (HTML-like syntax)
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-4">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

// Usage: like custom HTML tags
<StatTile label="Cash" value="$75,000.00" />
<StatTile label="Equity" value="$100,000.00" />
```

### Props — Data Flowing Down

```typescript
// Parent passes data to children via "props" (properties)
function KpiRow({ portfolio }: { portfolio: PortfolioResponse }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <StatTile label="Cash" value={formatMoney(portfolio.cash)} />
      <StatTile label="Equity" value={formatMoney(portfolio.equity)} />
    </div>
  );
}
```

### `useState` — Component Memory

```typescript
function LoginPage() {
  // state variable + updater function
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <input
      value={email}
      onChange={(e) => setEmail(e.target.value)}  // Update state on every keystroke
    />
  );
}
```

When `setEmail("alice@...")` is called, React **re-renders** the component with the new value.

### `useEffect` — Side Effects

```typescript
function ThemeProvider({ children }) {
  const [systemIsDark, setSystemIsDark] = useState(false);

  useEffect(() => {
    // This runs AFTER the component renders
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemIsDark(e.matches);
    media.addEventListener("change", onChange);

    // Cleanup function: runs when component unmounts
    return () => media.removeEventListener("change", onChange);
  }, []); // Empty array = run once on mount
}
```

### `useContext` — Sharing Data Without Prop Drilling

```typescript
// Create a context
const ThemeContext = createContext<ThemeValue | null>(null);

// Provider wraps the app
function ThemeProvider({ children }) {
  const value = { resolved: "dark", toggle: () => { /* ... */ } };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Any nested component can access the theme
function ThemeToggle() {
  const { resolved, toggle } = useContext(ThemeContext);
  return <button onClick={toggle}>{resolved === "dark" ? "☀️" : "🌙"}</button>;
}
```

### JSX — HTML in JavaScript

```typescript
// JSX looks like HTML but compiles to JavaScript
<div className="flex gap-2">        {/* className, not class */}
  <p>{user.email}</p>               {/* {} = JavaScript expression */}
  {isActive && <span>Active</span>} {/* Conditional rendering */}
  {items.map(item => (              /* Loops */
    <li key={item.id}>{item.name}</li>
  ))}
</div>
```

---

# 9. Vite

## What Is It?

Vite is a **frontend build tool and dev server**. It bundles your TypeScript/React code into optimized JavaScript that browsers can run.

## Why Vite Over Webpack?

| Feature | Webpack | Vite |
|---------|---------|------|
| Dev server start | 10–30 seconds | <1 second |
| Hot Module Replacement | Seconds | Instant |
| Configuration | Complex | Minimal |
| Build engine | Webpack | Rollup + ESBuild |

## How It Works

### Development Mode (`pnpm dev`)

```
Browser ←→ Vite Dev Server ←→ Your Source Files
              │
              ├── Serves files on-demand (no pre-bundling)
              ├── Transforms TypeScript → JavaScript instantly (ESBuild)
              └── Hot Module Replacement (HMR): edit a file → see changes instantly
```

**ESBuild** is a bundler written in Go that's 10–100× faster than JavaScript-based bundlers.

### Production Build (`pnpm build`)

```
Source Files → Rollup → Optimized bundle (minified, tree-shaken, code-split)
                          └── dist/
                              ├── index.html
                              ├── assets/index-abc123.js  (all JS, minified)
                              └── assets/index-def456.css (all CSS, minified)
```

### The Proxy (Dev Only)

```typescript
// vite.config.ts
server: {
  proxy: {
    "/api": {
      target: "http://localhost:3000",   // Forward to Fastify
      rewrite: (p) => p.replace(/^\/api/, ""),
    },
  },
}
```

In development: Browser → `localhost:5173/api/portfolio` → Vite proxy → `localhost:3000/portfolio`.

This avoids **CORS** (Cross-Origin Resource Sharing) issues — the browser thinks it's talking to the same server.

---

# 10. TanStack Query (React Query)

## What Is It?

TanStack Query (formerly React Query) is a **server-state management library** for React. It handles fetching, caching, synchronizing, and updating data from your API.

## Why Do We Use It?

Without it, every component that needs data must manually manage: loading state, error state, caching, refetching, deduplication, and race conditions. TanStack Query handles ALL of this.

## Core Concepts

### `useQuery` — Fetch and Cache Data

```typescript
function PortfolioPage() {
  const { data, isPending, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["portfolio"],                    // Cache key
    queryFn: ({ signal }) => api.portfolio(signal), // Fetcher
    staleTime: 30_000,                          // Fresh for 30 seconds
  });

  if (isPending) return <Skeleton />;           // First load
  if (isError) return <ErrorState error={error} />;
  return <KpiRow portfolio={data} />;           // Render data
}
```

### Query Keys — The Cache Address

```typescript
const queryKeys = {
  session: ["auth", "me"],
  portfolio: ["portfolio"],
  portfolioHistory: ["portfolio", "history"],
  latestAgentOutput: (symbol: string) => ["agents", "latest", symbol],
};
```

Each unique key = one cached entry. `["agents", "latest", "AAPL"]` and `["agents", "latest", "MSFT"]` are cached separately.

### `useMutation` — Send Data to the Server

```typescript
function LoginPage() {
  const login = useMutation({
    mutationFn: (creds) => api.login(creds),
    onSuccess: (user) => {
      // Update the session cache immediately (no refetch needed)
      queryClient.setQueryData(["auth", "me"], user);
    },
  });

  const handleSubmit = () => {
    login.mutate({ email, password });
  };

  return (
    <button disabled={login.isPending} onClick={handleSubmit}>
      {login.isPending ? <Spinner /> : "Sign in"}
    </button>
  );
}
```

### Stale Time & Refetching

```
Fresh (0–30s)  →  Stale (30s+)  →  Background refetch  →  Fresh again
     │                │                    │
     │                │                    └── isFetching = true
     │                │                        (show stale data + spinner)
     │                └── Data is "stale" but still shown
     └── Data is fresh, no refetch needed
```

---

# 11. React Router

## What Is It?

React Router handles **client-side routing** — mapping URLs to React components without full page reloads.

## How It Works

```typescript
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<RequireAuth />}>           {/* Layout route = wrapper */}
    <Route path="/" element={<PortfolioPage />} />
  </Route>
  <Route path="*" element={<Navigate to="/" />} /> {/* Catch-all */}
</Routes>
```

| URL | Component Rendered |
|-----|--------------------|
| `/login` | `<LoginPage />` |
| `/` | `<RequireAuth>` → `<AppLayout>` → `<PortfolioPage />` |
| `/anything-else` | Redirects to `/` |

### Key Hooks

```typescript
const navigate = useNavigate();
navigate("/login", { replace: true });  // Go to /login (replace history entry)

const location = useLocation();
location.pathname;  // Current URL path

// <NavLink> highlights the active route
<NavLink to="/" className={({ isActive }) => isActive ? "bg-blue" : ""}>
  Portfolio
</NavLink>
```

### `<Outlet />` — Where Child Routes Render

```typescript
function AppLayout({ user }) {
  return (
    <div className="flex">
      <Sidebar />
      <main>
        <Outlet />  {/* ← PortfolioPage renders HERE */}
      </main>
    </div>
  );
}
```

---

# 12. Tailwind CSS

## What Is It?

Tailwind is a **utility-first CSS framework**. Instead of writing CSS rules, you apply small utility classes directly in your HTML/JSX.

## Why Tailwind?

```html
<!-- Traditional CSS: write a class, then define its styles elsewhere -->
<div class="portfolio-card">...</div>
<!-- portfolio-card { padding: 1rem; background: white; border-radius: 0.5rem; } -->

<!-- Tailwind: styles are right in the markup -->
<div class="p-4 bg-white rounded-lg">...</div>
```

Benefits:
- No naming things (`card-wrapper-inner-container`?)
- No switching between HTML and CSS files
- Dead CSS is automatically removed (tree-shaking)
- Responsive design with prefixes: `sm:`, `md:`, `lg:`

## Common Utility Classes Used

```html
<!-- Layout -->
<div class="flex items-center gap-2">          <!-- Flexbox row, centered, 8px gap -->
<div class="grid grid-cols-3 gap-4">           <!-- 3-column grid -->
<div class="min-h-screen">                     <!-- Full viewport height -->

<!-- Spacing -->
<div class="p-4">     <!-- padding: 1rem (16px) -->
<div class="px-6">    <!-- padding-left + padding-right: 1.5rem -->
<div class="mt-2">    <!-- margin-top: 0.5rem -->
<div class="space-y-4"> <!-- 1rem gap between children (vertical) -->

<!-- Typography -->
<p class="text-sm text-ink-2">       <!-- Small text, secondary color -->
<h1 class="text-lg font-semibold">  <!-- Large text, semi-bold -->
<span class="truncate">             <!-- Truncate with ellipsis -->

<!-- Sizing -->
<div class="w-full max-w-6xl">      <!-- Full width, max 72rem -->
<div class="h-5 w-5">               <!-- 20px × 20px (icons) -->

<!-- Visual -->
<div class="rounded-xl border border-hairline bg-surface">
<div class="animate-pulse">          <!-- Loading shimmer -->

<!-- Responsive (mobile-first) -->
<div class="px-4 sm:px-6 lg:px-8">  <!-- More padding on larger screens -->
<div class="hidden lg:inline">       <!-- Only visible on large screens -->

<!-- Interactive -->
<button class="active:scale-[0.97]">  <!-- Slight press effect -->
<a class="[@media(hover:hover)]:hover:bg-surface-well">  <!-- Hover only on devices with a mouse -->
```

## Custom Design Tokens

The codebase extends Tailwind with CSS custom properties:

```typescript
// tailwind.config.ts
colors: {
  surface: {
    DEFAULT: "var(--surface-1)",    // bg-surface
    well: "var(--surface-2)",       // bg-surface-well
  },
  ink: {
    DEFAULT: "var(--ink-1)",        // text-ink
    2: "var(--ink-2)",              // text-ink-2
    3: "var(--ink-3)",              // text-ink-3
  },
}
```

Components use semantic names: `bg-surface`, `text-ink-2`, `text-delta-pos`. Light/dark mode switches the CSS variable values — all components update automatically.

---

# 13. Recharts

## What Is It?

Recharts is a **React charting library** built on D3. It renders SVG charts with React components.

## Where It's Used

The portfolio value chart on the dashboard:

```typescript
<AreaChart data={points} width={600} height={260}>
  <XAxis dataKey="asOf" tickFormatter={formatDayShort} />
  <YAxis tickFormatter={formatMoneyCompact} />
  <Tooltip content={<CustomTooltip />} />
  <Area
    dataKey="equity"
    stroke="var(--series-1)"        // Blue line
    fill="var(--series-1)"          // Blue fill
    fillOpacity={0.1}               // Subtle fill
  />
</AreaChart>
```

Recharts is chosen because it's **composable** (each element is a React component) and works naturally with React's rendering model.

---

# 14. Python, FastAPI, pandas, numpy

## Why a Separate Python Service?

TypeScript is great for APIs and UIs. Python is great for **math**. The quant service handles number-crunching that would be painful in TypeScript:

```python
# Python + pandas: 2 lines for a 14-period RSI
delta = closes.diff()
rsi = 100 - (100 / (1 + delta.where(delta > 0, 0).ewm(span=14).mean()
                           / (-delta).where(delta < 0, 0).ewm(span=14).mean()))
```

```typescript
// TypeScript equivalent: 30+ lines of manual array manipulation
// Not shown because it's painful 😅
```

## FastAPI

FastAPI is a **modern Python web framework** — the Python equivalent of Fastify:

```python
from fastapi import FastAPI
app = FastAPI()

@app.post("/indicators")
def compute(request: IndicatorRequest):
    # Process and return
    return {"indicators": result}
```

- **Automatic validation** via Pydantic (Python's Zod equivalent)
- **Auto-generated API docs** at `/docs`
- **Async support** for non-blocking I/O
- **Very fast** (one of the fastest Python frameworks)

## pandas

**pandas** is the Python data manipulation library. Its core data structure is the **DataFrame** — a table (like a spreadsheet):

```python
import pandas as pd

# Create a DataFrame from price bars
df = pd.DataFrame([
    {"ts": "2024-01-01", "close": 150.0},
    {"ts": "2024-01-02", "close": 152.5},
    {"ts": "2024-01-03", "close": 148.0},
])

# Compute a 2-day rolling average
df["sma2"] = df["close"].rolling(window=2).mean()
# [NaN, 151.25, 150.25]  ← first value is NaN (warm-up)

# Compute percentage change
df["returns"] = df["close"].pct_change()
# [NaN, 0.0167, -0.0295]
```

## numpy

**numpy** is the numerical computing foundation. pandas is built on top of it:

```python
import numpy as np

prices = np.array([150.0, 152.5, 148.0, 155.0])
np.mean(prices)     # 151.375
np.std(prices)      # 2.586...
np.max(prices)      # 155.0
```

---

# 15. Docker & Docker Compose

## What Is Docker?

Docker packages your application into a **container** — a lightweight, standalone package that includes everything needed to run: code, runtime, libraries, and settings.

```
Traditional deployment:          Docker deployment:
  "It works on my machine"       "It works in the container"
  Different Node versions         Same environment everywhere
  Missing system libraries        Everything bundled
  Manual configuration            Automated setup
```

## The Dockerfiles

Each app has a Dockerfile:

```dockerfile
# apps/api/Dockerfile
FROM node:22-slim AS base        # Start from Node.js 22 image
RUN corepack enable               # Enable pnpm
WORKDIR /repo                     # Set working directory

# Install dependencies (cached layer)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

EXPOSE 3000                        # The API listens on port 3000
CMD ["pnpm", "--filter", "@committee/api", "dev"]
```

## Docker Compose — Running Multiple Services

```yaml
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16    # PostgreSQL with pgvector extension
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: committee
      POSTGRES_USER: committee
      POSTGRES_PASSWORD: committee

  api:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    ports: ["3000:3000"]
    depends_on: [db]                 # Start DB before API
    environment:
      DATABASE_URL: postgres://committee:committee@db:5432/committee

  web:
    build: { context: ., dockerfile: apps/web/Dockerfile }
    ports: ["5173:5173"]

  quant:
    build: { context: ., dockerfile: apps/quant/Dockerfile }
    ports: ["8000:8000"]
```

One command starts everything: `docker compose up`

---

# 16. Vitest & Testing Library

## Vitest — The Test Runner

Vitest is a **testing framework** built on Vite. It's the replacement for Jest in Vite-based projects.

```typescript
// tests/auth.test.ts
import { describe, it, expect } from "vitest";

describe("authenticate", () => {
  it("rejects an unknown email", async () => {
    await expect(
      authenticate("nobody@example.com", "password123")
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("rejects a wrong password", async () => {
    await expect(
      authenticate("alice@example.com", "wrongpassword")
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
```

### Key Functions

```typescript
describe("group name", () => { /* ... */ });  // Group related tests
it("should do X", () => { /* ... */ });       // Single test case
expect(value).toBe(expected);                 // Exact match
expect(value).toEqual({ a: 1 });              // Deep object match
expect(fn).toThrow(ErrorType);                // Expect an error
expect(value).toBeTruthy();                   // Not null/undefined/false
```

## Testing Library — Testing React Components

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("shows the login form", () => {
  render(<LoginPage />);

  // Find elements by their accessible role
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
});

it("submits the form", async () => {
  const user = userEvent.setup();
  render(<LoginPage />);

  await user.type(screen.getByLabelText("Email"), "alice@example.com");
  await user.type(screen.getByLabelText("Password"), "hunter42!");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  // Assert that the login API was called...
});
```

**Philosophy**: Test the way a real user would interact — by labels, buttons, and visible text — not by CSS classes or component internals.

---

# 17. External APIs: Alpaca & Anthropic

## Alpaca Markets API — Stock Market Data

**What**: A broker API that provides real-time and historical stock market data, plus paper trading.

**How it's used**: The ingest module fetches historical price bars:

```
GET https://data.alpaca.markets/v2/stocks/AAPL/bars
  ?timeframe=1Day
  &start=2024-01-01
  &end=2024-06-01
  &limit=10000

Headers:
  APCA-API-KEY-ID: your_key
  APCA-API-SECRET-KEY: your_secret

Response:
{
  "bars": [
    { "t": "2024-01-02T05:00:00Z", "o": 185.20, "h": 186.10, "l": 184.50, "c": 185.90, "v": 45123000 },
    { "t": "2024-01-03T05:00:00Z", "o": 185.90, "h": 187.00, "l": 183.20, "c": 184.10, "v": 52340000 },
    ...
  ],
  "next_page_token": "QUFQTHwy..."    ← pagination token for more results
}
```

**Rate limits**: Free tier = 200 requests/minute. The client handles 429 responses with backoff.

## Anthropic Claude API — LLM Intelligence

**What**: Claude is an AI assistant by Anthropic. The technical agent uses it for generating prose explanations.

**How it's used**: The LLM client sends structured requests:

```
POST https://api.anthropic.com/v1/messages

Headers:
  x-api-key: your_api_key
  content-type: application/json
  anthropic-version: 2023-06-01

Body:
{
  "model": "claude-haiku-4-5",
  "system": "You are a technical analyst...",
  "messages": [{ "role": "user", "content": "Analyze AAPL: RSI=28.5, MACD=-0.42..." }],
  "tools": [{
    "name": "emit_agent_output",
    "input_schema": { /* AgentOutput JSON Schema */ }
  }],
  "tool_choice": { "type": "tool", "name": "emit_agent_output" }
}

Response:
{
  "content": [{
    "type": "tool_use",
    "name": "emit_agent_output",
    "input": {
      "agent": "technical",
      "direction": "bullish",
      "confidence": 0.72,
      "rationale": "RSI at 28.5 indicates oversold conditions...",
      "evidence": { "rsi": 28.5, "macd": -0.42 }
    }
  }]
}
```

**Forced tool calling** constrains the LLM to output structured JSON instead of free-form text.

---

# 18. Supporting Cast

### bcryptjs — Password Hashing
```typescript
import bcrypt from "bcryptjs";
const hash = await bcrypt.hash("mypassword", 10);  // Hash with 10 rounds
const match = await bcrypt.compare("mypassword", hash);  // true
```

### dotenv — Load `.env` Files
```typescript
import { config } from "dotenv";
config();  // Reads .env file into process.env
// .env: DATABASE_URL=postgres://...
// process.env.DATABASE_URL → "postgres://..."
```

### Node.js `crypto` — Encryption & Random Values
```typescript
import { randomUUID, createCipheriv, randomBytes } from "node:crypto";
randomUUID();            // "550e8400-e29b-41d4-a716-446655440000"
randomBytes(12);         // 12 random bytes for AES nonce
createCipheriv("aes-256-gcm", key, iv);  // AES encryption
```

### `@fastify/cookie` — Cookie Parsing
```typescript
await app.register(cookie);
// Now request.cookies is available
// reply.setCookie("name", "value", options) works
```

### PostCSS + Autoprefixer — CSS Processing
PostCSS processes CSS through plugins. Autoprefixer adds vendor prefixes:
```css
/* You write: */
.card { backdrop-filter: blur(10px); }

/* Autoprefixer outputs: */
.card { -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
```

### `clsx` / `cn()` — Conditional CSS Classes
```typescript
function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
// cn("px-3", isActive && "bg-blue", disabled && "opacity-50")
// → "px-3 bg-blue" (when active, not disabled)
```

---

## 🗺️ Technology Map: Where Everything Lives

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser                                   │
│  React · React Router · TanStack Query · Tailwind · Recharts    │
│  Vite (dev server + build)                                       │
│                         │                                        │
│                    fetch("/api/...")                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────────────────┐
│                     Fastify API (Node.js)                        │
│  TypeScript · Zod · bcrypt · @fastify/cookie · node:crypto       │
│  Drizzle ORM                                                     │
│         │                                        │               │
│    SQL queries                              HTTP to quant        │
│         │                                        │               │
└─────────┼────────────────────────────────────────┼──────────────┘
          │                                        │
┌─────────▼──────────┐              ┌──────────────▼──────────────┐
│    PostgreSQL       │              │   Python Quant Service       │
│  pgcrypto · pgvector│              │   FastAPI · pandas · numpy   │
│  Drizzle migrations │              │   uvicorn                    │
└────────────────────┘              └─────────────────────────────┘

All wrapped in: Docker Compose containers
All managed by: pnpm workspaces (monorepo)
All tested by:  Vitest + Testing Library
```

---

> 🧰 **You now have a working understanding of every technology in the stack.**
> Go back to the masterclass to see how they all work together:
>
> [Part 1: Big Picture, Database, Contracts](file:///Users/sharzilnafis/.gemini/antigravity-cli/brain/a8bc2f12-6b2f-4eec-ae60-135bffce8126/masterclass-part1.md) ·
> [Part 2: Auth, Ingestion, Indicators](file:///Users/sharzilnafis/.gemini/antigravity-cli/brain/a8bc2f12-6b2f-4eec-ae60-135bffce8126/masterclass-part2.md) ·
> [Part 3: Agents, Dashboard, Summary](file:///Users/sharzilnafis/.gemini/antigravity-cli/brain/a8bc2f12-6b2f-4eec-ae60-135bffce8126/masterclass-part3.md)
