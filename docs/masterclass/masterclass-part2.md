# 🎓 The Committee — Sprint 1 Masterclass (Part 2)

> Continues from [Part 1](file:///Users/sharzilnafis/.gemini/antigravity-cli/brain/a8bc2f12-6b2f-4eec-ae60-135bffce8126/masterclass-part1.md) (Chapters 0–2)

---

# Chapter 3: Spec 03 — Auth & Session Management

> **Owner**: M4 (Platform Engineer)
> **Layer**: Cross-cutting
> **Purpose**: User registration, login, session cookies, and encrypted credential storage
> **Files**: `apps/api/src/auth/`, `apps/api/src/credentials/`

## What This Spec Builds

Before anyone can use the dashboard, they need to:
1. **Register** an account (email + password)
2. **Log in** (receive a session cookie)
3. **Optionally store Alpaca API keys** (encrypted at rest)

Every other protected route (`/portfolio`, `/ingest/prices`, `/agents/run`) uses the `requireAuth` guard this spec creates.

## The Authentication Flow (Step by Step)

```
Browser                         API Server                     Database
   │                               │                              │
   │  POST /auth/register          │                              │
   │  { email, password }          │                              │
   │──────────────────────────────>│                              │
   │                               │  Hash password (bcrypt)      │
   │                               │  INSERT INTO users           │
   │                               │─────────────────────────────>│
   │                               │  Create session (UUID)       │
   │                               │  INSERT INTO sessions        │
   │                               │─────────────────────────────>│
   │  Set-Cookie: committee_session│                              │
   │  { user: { id, email } }     │                              │
   │<──────────────────────────────│                              │
   │                               │                              │
   │  GET /portfolio               │                              │
   │  Cookie: committee_session=X  │                              │
   │──────────────────────────────>│                              │
   │                               │  SELECT session + user       │
   │                               │  WHERE session.id = X        │
   │                               │─────────────────────────────>│
   │                               │  request.user = { id, email }│
   │                               │  → proceed to route handler  │
   │  { cash, equity, ... }       │                              │
   │<──────────────────────────────│                              │
```

## The Config System

### [src/config.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/config.ts)

```typescript
const EnvSchema = z.object({
  DATABASE_URL: z.string().default("postgres://committee:committee@localhost:5432/committee"),
  CREDENTIAL_ENC_KEY: z.string().default(isTest ? Buffer.alloc(32).toString("base64") : ""),
  SESSION_TTL: z.coerce.number().int().positive().default(604800),
  ALPACA_KEY: z.string().default(""),
  ALPACA_SECRET: z.string().default(""),
  // ... more env vars
});

export const config = EnvSchema.parse(process.env);
```

### 💡 Fail-Fast Configuration

This code runs at **import time** — before any route handler processes a request. If `DATABASE_URL` is missing and there's no default, the server won't start. This is intentional: it's better to crash immediately at boot than to silently serve errors for hours.

`z.coerce.number()` converts string environment variables (`"604800"`) to actual numbers (`604800`). Environment variables are always strings — Zod handles the conversion and validation.

`SESSION_TTL` defaults to `604800` seconds = **7 days**.

## Password Hashing & Authentication

### [src/auth/service.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/auth/service.ts)

### 💡 How Password Hashing Works

When a user registers with password `"mypassword123"`, we DON'T store it. We hash it:

```
"mypassword123"  →  bcrypt($2a$10$c5ium...)  →  Store the hash
```

When they log in, we hash what they typed and compare:
```
"mypassword123"  →  bcrypt  →  "$2a$10$c5ium..."
                                    ↕ compare
Database has:                  "$2a$10$c5ium..."
                                    = MATCH ✅
```

**bcrypt** is special because it's intentionally **slow**. Each hash takes ~100ms. That's fine for one login, but an attacker trying millions of passwords would need years.

```typescript
const BCRYPT_ROUNDS = 10; // 2^10 = 1024 iterations of the core function

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
```

### The Anti-Timing-Attack: Dummy Hash

```typescript
const DUMMY_HASH = "$2a$10$c5iumPvU28bj/KDbtYRS1OYX4qjtvbHR75iaO.dolNCz/ABwGOSz6";

export async function authenticate(email: string, password: string): Promise<PublicUser> {
  const rows = await db.select(/* ... */).where(eq(users.email, email));
  const row = rows[0];

  // ALWAYS compare — even when the user doesn't exist!
  const ok = await bcrypt.compare(password, row?.passwordHash ?? DUMMY_HASH);

  if (!row || !ok) throw new InvalidCredentialsError();
  return { id: row.id, email: row.email };
}
```

### 💡 Why the Dummy Hash?

Without it, an attacker could measure response times:
- Email exists → bcrypt runs (100ms)
- Email doesn't exist → no bcrypt (1ms)

The 99ms difference tells them "this email is registered!" — that's **user enumeration**. By always running bcrypt (against a dummy hash when the user doesn't exist), both paths take ~100ms. The attacker can't tell the difference.

### The Error: No User Enumeration

```typescript
export class InvalidCredentialsError extends Error {
  constructor() {
    super("invalid_credentials");  // Same message for BOTH cases
  }
}
```

Wrong email? `"invalid_credentials"`. Wrong password? `"invalid_credentials"`. Same error, same status code (401), same response time. An attacker learns nothing.

## Server-Side Session Management

### [src/auth/session.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/auth/session.ts)

### Creating a Session

```typescript
export const SESSION_COOKIE = "committee_session";

export async function createSession(userId: string) {
  const sessionId = randomUUID();      // e.g., "550e8400-e29b-41d4-a716-446655440000"
  const expiresAt = ttlFromNow();      // now + 7 days
  await db.insert(sessions).values({ id: sessionId, userId, expiresAt });
  return { sessionId, expiresAt };
}
```

The session ID is a random UUID — **opaque and unpredictable**. It carries NO information about the user. Compare this to a JWT, which contains the user ID encoded inside it. The opaque ID means: even if an attacker intercepts the cookie, they can't extract the user ID from it.

### Cookie Flags (The Security Controls)

```typescript
export function sessionCookieOptions() {
  return {
    httpOnly: true,                                  // JavaScript can't read it
    secure: config.NODE_ENV === "production",        // HTTPS only in production
    sameSite: "lax" as const,                        // CSRF protection
    path: "/",                                       // Sent on all routes
    maxAge: config.SESSION_TTL,                      // Browser-side TTL
  };
}
```

| Flag | What It Does | Why |
|------|-------------|-----|
| `httpOnly` | JavaScript can't access `document.cookie` | Prevents XSS attacks from stealing sessions |
| `secure` | Cookie only sent over HTTPS | Prevents eavesdropping on the wire |
| `sameSite: "lax"` | Only sent on same-site requests + top-level navigations | Prevents CSRF attacks |
| `path: "/"` | Sent on every API call | The whole API needs the session |

### Resolving a Session (Rolling Expiry)

```typescript
export async function resolveSession(rawSessionId: string | undefined) {
  // 1. Format check: MUST be a valid UUID
  if (!rawSessionId || !UUID_RE.test(rawSessionId)) return null;

  // 2. Database lookup: join sessions + users
  const rows = await db.select(/* ... */)
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, rawSessionId));

  // 3. Expiry check: delete if expired
  if (row.expiresAt.getTime() <= Date.now()) {
    await destroySession(row.sessionId);
    return null;
  }

  // 4. Rolling expiry: extend TTL if we're past the skew threshold
  const next = ttlFromNow(); // now + 7 days
  if (next.getTime() - expiresAt.getTime() > REFRESH_SKEW_MS) { // > 60 seconds
    await db.update(sessions).set({ expiresAt: next });
  }

  return { sessionId, user, expiresAt };
}
```

### 💡 What is Rolling Expiry?

Without rolling expiry, a user who logged in on Monday would be forcibly logged out on the following Monday, even if they used the app every day.

**Rolling expiry** means: every time you use the app, your session gets extended by another 7 days. You're only logged out if you're **inactive** for 7 days.

The `REFRESH_SKEW_MS = 60_000` (60 seconds) prevents excessive database writes — if you make 50 API calls in one minute, only the first one updates the expiry.

## The Auth Guard: `requireAuth`

### [src/auth/require-auth.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/auth/require-auth.ts)

```typescript
export async function requireAuth(request, reply) {
  let session;
  try {
    session = await resolveSession(request.cookies[SESSION_COOKIE]);
  } catch (err) {
    request.log.error({ err: err.message }, "session lookup failed — failing closed");
    return unauthorized();
  }

  if (!session) return unauthorized();

  request.user = session.user;
  reply.setCookie(SESSION_COOKIE, session.sessionId, sessionCookieOptions());
}
```

### 💡 What Does "Fail Closed" Mean?

Two options when something goes wrong:
- **Fail open**: "I couldn't check, so I'll let you through" (DANGEROUS ❌)
- **Fail closed**: "I couldn't check, so you're denied" (SAFE ✅)

This guard **fails closed**: if the database is down, if the session lookup throws, if anything goes wrong → 401 Unauthorized. No ambiguity, no guessing.

**Every protected route** uses this guard:
```typescript
app.get("/portfolio", { preHandler: requireAuth }, async (request, reply) => {
  // request.user is guaranteed to exist here
});
```

## Log Redaction

### [src/auth/redaction.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/auth/redaction.ts)

```typescript
export function installSensitiveErrorHandler(app) {
  app.setErrorHandler(function sensitiveErrorHandler(err, request, reply) {
    request.log.error({
      url: request.url,
      method: request.method,
      statusCode: err.statusCode ?? 500,
      errName: err.name,
      // NOTE: NO request.body, NO err.message (might contain a password)
    }, "request failed on a sensitive route (body intentionally not logged)");

    return reply.code(statusCode >= 500 ? 500 : statusCode)
                .send({ error: statusCode >= 500 ? "internal_error" : "invalid_request" });
  });
}
```

### 💡 Why Redact Logs?

Imagine a user accidentally types their password in the email field. A validation error might produce: `"'p@ssw0rd123' is not a valid email"`. If that gets logged, the password is now sitting in a log file. `installSensitiveErrorHandler` prevents this by never logging the request body on auth/credential routes.

## The Credential Vault

### [src/credentials/crypto.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/credentials/crypto.ts)

This module encrypts Alpaca API keys before storing them. Here's the conceptual flow:

```
User sends:  { alpacaKey: "AK12345", alpacaSecret: "SK67890" }
                          ↓
Vault encrypts each field independently:
  key    → AES-256-GCM(plaintext, encKey, nonce1, aad="alpaca:key")    → ciphertext1
  secret → AES-256-GCM(plaintext, encKey, nonce2, aad="alpaca:secret") → ciphertext2
                          ↓
Database stores:
  key_ciphertext:    base64(ciphertext1)
  secret_ciphertext: base64(ciphertext2)
  iv:                base64(nonce1 + nonce2)         ← concatenated
  auth_tag:          base64(tag1 + tag2)             ← concatenated
```

### 💡 Why Two Independent Nonces?

AES-GCM with the same key and same nonce on two different plaintexts is **catastrophically insecure** — it leaks the XOR of the two plaintexts. Since we encrypt two fields (key and secret), each gets its own random nonce.

The spec has only ONE `iv` column, so the two 12-byte nonces are concatenated into 24 bytes: `nonce1 || nonce2`.

### 💡 What is AAD (Additional Authenticated Data)?

AAD = `"alpaca:key"` and `"alpaca:secret"`. It's extra data mixed into the authentication tag. If someone swapped the `key_ciphertext` and `secret_ciphertext` columns in the database, decryption would fail (because the AAD wouldn't match). It binds each ciphertext to its semantic role.

### The `keyTail` Function

```typescript
export function keyTail(alpacaKey: string): string {
  return alpacaKey.slice(-4); // Last 4 characters only
}
```

The dashboard shows "Connected ···WXYZ" — only the last 4 characters of the API key, so the user can confirm which key is stored without exposing it.

## The Auth Routes

### [src/auth/plugin.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/auth/plugin.ts)

The four auth routes:

### `POST /auth/register`
```
Body: { email: "alice@example.com", password: "hunter42!" }
→ Validate with Zod (RegisterBody)
→ hashPassword → INSERT users
→ createSession → SET COOKIE
→ 201 { user: { id, email } }
→ 409 if email taken
```

### `POST /auth/login`
```
Body: { email: "alice@example.com", password: "hunter42!" }
→ Validate with Zod (LoginBody)
→ authenticate (bcrypt compare, dummy hash)
→ createSession → SET COOKIE
→ 200 { user: { id, email } }
→ 401 if invalid (same error for wrong email OR wrong password)
```

### `POST /auth/logout`
```
→ Read session cookie
→ destroySession (DELETE FROM sessions)
→ clearCookie
→ 204 (no body)
```

**Not behind `requireAuth`!** A dead session must still clear the cookie, not bounce with 401.

### `GET /auth/me`
```
→ requireAuth guard
→ 200 { user: request.user }
```

---

# Chapter 4: Spec 04 — Market Data Ingestion

> **Owner**: M2 (Data & Quant Engineer)
> **Layer**: L0 (Data)
> **Purpose**: Fetch price bars from Alpaca's API, compute `as_of`, and store them in the database
> **Files**: `apps/api/src/ingest/`

## What This Spec Builds

This is the data pipeline that feeds everything else. Without price data, there's nothing for indicators to compute, nothing for agents to analyze, and nothing for the dashboard to display.

```
Alpaca Market Data API  →  Normalize  →  Compute as_of  →  Store in price_bars
```

## The `as_of` Rules Engine

### [src/ingest/as-of.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/ingest/as-of.ts)

This is the **most critical file in the ingest module**. It answers: "When did this data become knowable?"

### 💡 The Two Rules

**Rule 1: Hourly bars** → `as_of = ts + 1 hour`
```
A 1-hour bar starting at 10:00 AM is complete at 11:00 AM.
  ts    = 2024-01-05T15:00:00Z (10 AM ET)
  as_of = 2024-01-05T16:00:00Z (11 AM ET)
```

**Rule 2: Daily bars** → `as_of = 4:00 PM Eastern Time on that market date`
```
The US stock market closes at 4:00 PM ET (Eastern Time).
  ts    = 2024-01-05T00:00:00Z (the market date)
  as_of = 2024-01-05T21:00:00Z (4 PM ET = 9 PM UTC, in winter)
  as_of = 2024-01-05T20:00:00Z (4 PM ET = 8 PM UTC, in summer/DST)
```

### 💡 Why DST Matters

Eastern Time is UTC-5 in winter and UTC-4 in summer. The market always closes at 4:00 PM **local** time. So:
- January (EST): 4 PM ET = 21:00 UTC
- July (EDT): 4 PM ET = 20:00 UTC

The code uses the IANA timezone `America/New_York` to handle this correctly. Getting this wrong by even one hour would mean the system thinks it can "see" a bar an hour early — a subtle but devastating look-ahead bug.

### The Future-Bar Drop

```typescript
// Bars where as_of > now are DROPPED, not clamped
if (asOf > now) {
  // This bar isn't complete yet! Skip it.
  continue;
}
```

If the current time is 2:30 PM ET and we're fetching daily bars, today's bar isn't complete yet (market closes at 4 PM). The bar is **dropped entirely** — not stored with a "best guess" close price. This prevents the system from acting on incomplete data.

## The Alpaca Client

### [src/ingest/alpaca-client.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/ingest/alpaca-client.ts)

This module fetches data from Alpaca's REST API. Let's look at its key design decisions:

### Retry with Exponential Backoff

```typescript
async function getJsonWithRetry(url, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, { headers: authHeaders });

    if (response.status === 429) {          // Rate limited
      const retryAfter = response.headers.get("Retry-After");
      await sleep(retryAfter ? parseInt(retryAfter) * 1000 : delay);
      continue;
    }
    if (response.status >= 500) {           // Server error
      await sleep(delay + jitter);          // Wait before retry
      delay *= 2;                            // Double the wait (exponential)
      continue;
    }
    return response.json();                  // Success!
  }
  throw new Error("Max retries exceeded");
}
```

### 💡 What is Exponential Backoff?

When a server says "I'm busy" (429) or "I have an error" (500), you should retry. But hammering it immediately makes things worse. Exponential backoff spaces out retries:

```
Attempt 1: wait 500ms
Attempt 2: wait 1,000ms    (doubled)
Attempt 3: wait 2,000ms    (doubled again)
Attempt 4: wait 4,000ms
Attempt 5: wait 8,000ms    → give up
```

**Jitter** adds randomness so that if 100 clients all retry at the same time, they don't all hit the server simultaneously.

### Date Range Chunking

Alpaca can't return 10 years of data in one request. The client splits long ranges into chunks:
- Daily bars: 5-year chunks
- Hourly bars: 90-day chunks

```typescript
const CHUNK_DAYS = {
  "1Day": 365 * 5,  // 5 years per chunk
  "1Hour": 90,       // 90 days per chunk
};
```

Each chunk is paginated (Alpaca returns a `next_page_token` for more results), with a safety cap of 200 pages per chunk to prevent infinite loops.

### On-Disk Response Cache

### [src/ingest/fs-cache.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/ingest/fs-cache.ts)

During development, you don't want to hit Alpaca's API every time you restart the server. The `FsResponseCache` stores API responses on disk:

```typescript
class FsResponseCache {
  async get(key: string): Promise<AlpacaBarsResponse | null> {
    // Read from .cache/alpaca/{key}.json if it exists
  }
  async set(key: string, value: AlpacaBarsResponse): Promise<void> {
    // Write to .cache/alpaca/{key}.json
  }
}
```

The key is derived from the request parameters (symbol, timeframe, dates), so the same request always hits the cache.

## The Price Normalization Pipeline

### [src/ingest/prices.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/ingest/prices.ts)

This is the orchestration file that ties everything together:

```
1. fetchBarsDetailed()
   ├── AlpacaClient.getBars()        ← raw JSON from Alpaca
   └── normalizeBars()               ← transform to our schema
        ├── Parse numbers             ← Alpaca returns some as strings
        ├── computeAsOf()             ← apply the as_of rules
        ├── Drop future bars          ← if as_of > now
        ├── Sort by ts ascending      ← guarantee ordering
        └── PriceBar.parse()          ← validate against Zod schema

2. upsertBars()
   ├── store.existingKeys()          ← check what's already in DB
   └── store.upsert()               ← ON CONFLICT DO UPDATE
```

### 💡 What is an Upsert?

"Upsert" = UPDATE + INSERT. If the bar already exists (same `symbol + timeframe + ts`), update it. If it doesn't exist, insert it.

```sql
INSERT INTO price_bars (symbol, timeframe, ts, open, high, low, close, volume, as_of)
VALUES ('AAPL', '1Day', '2024-01-05', 148, 152, 146, 150, 5000000, '2024-01-05 21:00:00')
ON CONFLICT (symbol, timeframe, ts) DO UPDATE SET
  open = EXCLUDED.open,
  high = EXCLUDED.high,
  -- ...
```

This makes ingestion **idempotent** — running it twice with the same data produces the same result. You can safely re-ingest without creating duplicates.

## The Store Seam

### [src/ingest/store.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/ingest/store.ts)

Two implementations of `PriceBarStore`:

```typescript
interface PriceBarStore {
  existingKeys(symbol: string, timeframe: string): Promise<Set<string>>;
  upsert(bars: PriceBar[]): Promise<void>;
}

class InMemoryPriceBarStore implements PriceBarStore { /* for tests */ }
class DrizzlePriceBarStore implements PriceBarStore { /* for production */ }
```

### 💡 What is a Seam?

A **seam** is a boundary where you can swap one implementation for another. In tests, you use `InMemoryPriceBarStore` (fast, no database needed). In production, you use `DrizzlePriceBarStore` (writes to Postgres). The code that calls the store doesn't know or care which one it's using.

This pattern is fundamental to testable architecture.

## The Ingest CLI

### [src/ingest/cli.ts](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/api/src/ingest/cli.ts)

A command-line tool for manual ingestion:

```bash
npx tsx src/ingest/cli.ts --symbols AAPL,MSFT --from 2023-01-01 --to 2024-01-01
```

This bypasses the API and directly calls the ingest pipeline. Useful for initial data loading or debugging.

---

# Chapter 5: Spec 05 — Technical Indicator Engine

> **Owner**: M2 (Data & Quant Engineer)
> **Layer**: L1 (Signal)
> **Purpose**: Compute RSI, MACD, Bollinger Bands, and Moving Averages from raw price bars
> **Files**: `apps/quant/` (Python service)

## Why a Separate Python Service?

The main API is written in TypeScript/Node.js — great for web servers but weak for numerical computing. Python has **pandas** and **numpy** — battle-tested libraries purpose-built for number crunching with 30+ years of optimization.

The two services communicate via HTTP:

```
apps/api (TypeScript)  ──HTTP──>  apps/quant (Python/FastAPI)
   "Give me indicators       "Here are the computed
    for AAPL daily bars"       RSI, MACD, BB, SMAs"
```

## The Python Service Architecture

```
apps/quant/
├── main.py              ← FastAPI app with /indicators endpoint
├── indicators.py        ← Pure functions computing each indicator
├── requirements.txt     ← pandas, numpy, fastapi, uvicorn
└── tests/
    └── test_indicators.py
```

## The Indicators Explained

### 💡 RSI (Relative Strength Index) — "Is the stock overbought or oversold?"

RSI measures momentum on a scale of 0–100.

```
RSI > 70  →  "Overbought" (price might fall — bearish signal)
RSI < 30  →  "Oversold"   (price might rise — bullish signal)
RSI 30-70 →  "Neutral zone"
```

**How it's computed** (14-period default):

```python
def compute_rsi(closes: pd.Series, period: int = 14) -> pd.Series:
    delta = closes.diff()                    # Price change each bar
    gain = delta.where(delta > 0, 0)         # Keep only positive changes
    loss = (-delta).where(delta < 0, 0)      # Keep only negative changes (as positive)

    avg_gain = gain.ewm(span=period).mean()  # Smoothed average of gains
    avg_loss = loss.ewm(span=period).mean()  # Smoothed average of losses

    rs = avg_gain / avg_loss                 # Relative Strength
    rsi = 100 - (100 / (1 + rs))            # Scale to 0-100
    return rsi
```

**Example**: If AAPL went up 10 out of the last 14 days by an average of $2, and down 4 days by an average of $1, the RS = (10×$2)/(4×$1) = 5. RSI = 100 - 100/(1+5) = 83.3 → **overbought**.

**Warm-up**: RSI needs 14 bars of history. The first 13 bars return `null`.

### 💡 MACD (Moving Average Convergence Divergence) — "Is momentum shifting?"

MACD tracks the relationship between two moving averages:

```
MACD Line    = EMA(12) - EMA(26)     ← fast EMA minus slow EMA
Signal Line  = EMA(9) of MACD Line   ← smoothed MACD

Bullish cross: MACD crosses ABOVE signal → momentum turning positive
Bearish cross: MACD crosses BELOW signal → momentum turning negative
```

**EMA** = Exponential Moving Average. Unlike a simple average, it gives more weight to recent prices:

```python
def compute_macd(closes: pd.Series):
    ema12 = closes.ewm(span=12).mean()
    ema26 = closes.ewm(span=26).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9).mean()
    return macd_line, signal_line
```

**Warm-up**: MACD needs 26 bars + 9 bars for the signal = 35 bars minimum.

### 💡 Bollinger Bands — "Is the price stretched too far from normal?"

Bollinger Bands create a channel around the moving average:

```
Upper Band = SMA(20) + 2 × StdDev(20)     ← 2 standard deviations above
Middle     = SMA(20)                        ← 20-day simple moving average
Lower Band = SMA(20) - 2 × StdDev(20)     ← 2 standard deviations below

Price above upper → "Overbought" (might fall back)
Price below lower → "Oversold" (might bounce up)
```

```python
def compute_bollinger(closes: pd.Series, period: int = 20, num_std: int = 2):
    sma = closes.rolling(window=period).mean()
    std = closes.rolling(window=period).std()
    upper = sma + (num_std * std)
    lower = sma - (num_std * std)
    return upper, lower
```

**Warm-up**: Needs 20 bars.

### 💡 SMA (Simple Moving Average) — "What's the average price over N days?"

```python
sma20 = closes.rolling(window=20).mean()  # Average of last 20 closes
sma50 = closes.rolling(window=50).mean()  # Average of last 50 closes
```

**SMA cross signals:**
- Price > SMA(20) → short-term bullish
- SMA(20) > SMA(50) → medium-term bullish ("golden cross")
- SMA(20) < SMA(50) → medium-term bearish ("death cross")

## The FastAPI Endpoint

### [main.py](file:///Users/sharzilnafis/Desktop/Project/QuantAgent/apps/quant/main.py)

```python
@app.post("/indicators")
def compute_indicators(request: IndicatorRequest):
    """
    Receives: { bars: [...], symbol: "AAPL", timeframe: "1Day" }
    Returns:  { indicators: { rsi: 45.2, macd: -0.3, ... }, asOf: "..." }
    """
    df = pd.DataFrame(request.bars)
    df["close"] = df["close"].astype(float)

    result = {
        "rsi": compute_rsi(df["close"]).iloc[-1],
        "macd": compute_macd(df["close"])[0].iloc[-1],
        "macdSignal": compute_macd(df["close"])[1].iloc[-1],
        "bbUpper": compute_bollinger(df["close"])[0].iloc[-1],
        "bbLower": compute_bollinger(df["close"])[1].iloc[-1],
        "sma20": df["close"].rolling(20).mean().iloc[-1],
        "sma50": df["close"].rolling(50).mean().iloc[-1],
    }

    # Replace NaN (warm-up period) with None (JSON null)
    for key, value in result.items():
        if pd.isna(value):
            result[key] = None

    return { "indicators": result, "asOf": request.bars[-1]["asOf"] }
```

### 💡 The Point-in-Time Handshake

The `asOf` in the response is **the `asOf` of the last input bar**. This preserves the chain of custody:

```
Price bar (asOf = Jan 5 9PM) → Indicator computed from it → asOf = Jan 5 9PM
```

The indicator inherits the point-in-time timestamp of its input data. It's not allowed to be "newer" than the data it was computed from.

## How the API Calls the Quant Service

The API's agent framework calls the Python service to get indicators:

```typescript
// In apps/api/src/agents/technical/snapshots.ts
const response = await fetch(`${config.QUANT_SERVICE_URL}/indicators`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ bars, symbol, timeframe }),
});
const data = await response.json();
// data.indicators = { rsi: 45.2, macd: -0.3, ... }
```

Or, indicators might already be cached in `indicator_snapshots`:
```sql
SELECT * FROM indicator_snapshots
WHERE symbol = 'AAPL' AND timeframe = '1Day'
AND as_of <= :decisionTs
ORDER BY ts DESC LIMIT 1
```

---

> **Continue to [Part 3](file:///Users/sharzilnafis/.gemini/antigravity-cli/brain/a8bc2f12-6b2f-4eec-ae60-135bffce8126/masterclass-part3.md) for Specs 06–08 (Agent Framework, Technical Analyst, Dashboard & Frontend)**
