# 03 — User Auth & Session Management (M4, platform)

> Secure registration, login, persistent sessions, and **encrypted-at-rest storage of Alpaca API
> credentials**. Gates every private route in the system.
> PRD user stories: #1, #2, #3.

## 1. Context & Goal

The dashboard (08) and every portfolio/agent route need an authenticated user. This spec delivers
register/login/logout, cookie-backed sessions that survive reloads, and the encrypted vault for a user's
Alpaca paper-trading keys. The credential crypto is explicitly tested — leaking or plaintext-storing a
key is a hard failure.

"Done" means: a user can register, log in, stay logged in across a reload, save Alpaca keys that land in
the DB as ciphertext, and later decrypt them server-side for the execution layer (Sprint 3) — with the
plaintext never returned to the client and never logged.

## 2. Scope

**In scope**
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- Session management: server-side `sessions` rows + httpOnly, secure, sameSite cookie; expiry + refresh.
- Password hashing with `argon2` (or `bcrypt`).
- Alpaca credential vault: `POST /credentials` (store), `GET /credentials/status` (present? masked
  tail only) — AES-256-GCM encryption using a server key from env (`CREDENTIAL_ENC_KEY`).
- Auth middleware/preHandler that other routes reuse to require a session.

**Non-goals**
- No OAuth/social login, no email verification, no password reset (out of MVP).
- No Alpaca API *calls* — you store/decrypt keys; spec (Sprint 3) uses them.
- No UI — spec 08 builds the login form against these routes.

## 3. Dependencies

- Spec **01** (`users`, `sessions`, `alpaca_credentials` tables). Blocks on it.
- Env: `CREDENTIAL_ENC_KEY` (32-byte, base64), `SESSION_TTL`.

## 4. Interface & Contracts

```
POST /auth/register  { email, password }              -> 201 { user: {id,email} } + Set-Cookie session
POST /auth/login     { email, password }              -> 200 { user } + Set-Cookie session
POST /auth/logout                                      -> 204, clears cookie + deletes session row
GET  /auth/me                                          -> 200 { user } | 401
POST /credentials    { alpacaKey, alpacaSecret }       -> 204 (stored encrypted)  [auth required]
GET  /credentials/status                               -> 200 { connected: bool, keyTail: "…ABCD" }  [auth required]
```

- Request/response bodies validated with Zod (shapes live in `apps/api`, not `packages/contracts` —
  they're API-local, not cross-service).
- `requireAuth` Fastify preHandler: resolves session cookie → `request.user`, else 401. Exported for
  reuse by spec 08's portfolio routes and later specs.

**Crypto contract:** AES-256-GCM. Store `key_ciphertext`, `secret_ciphertext`, `iv`, `auth_tag` per
spec 01's columns. Decrypt only server-side, on demand, for the execution layer. `keyTail` is the last
4 chars of the *plaintext* key, computed at store time and safe to show; never expose more.

## 5. Implementation notes

- Sessions: opaque random id in the cookie → `sessions` row; do **not** put user data in the cookie.
  Rolling expiry (refresh `expires_at` on activity) up to `SESSION_TTL`.
- Cookie flags: `httpOnly`, `secure` (in prod), `sameSite=lax`, path `/`.
- Never log request bodies for `/auth/*` or `/credentials`. Redact in any logger config.
- Fail closed: a malformed/expired session → 401, not a silent empty user.
- Constant-time password comparison via the hashing lib's verify; generic error on bad
  email-or-password (no user-enumeration).

## 6. Acceptance criteria

- [ ] Register → login → `GET /auth/me` returns the user; logout invalidates the session (subsequent
      `/auth/me` is 401).
- [ ] Session persists across a simulated reload (cookie replay) until expiry.
- [ ] Passwords stored only as argon2/bcrypt hashes; never plaintext, never logged.
- [ ] `POST /credentials` writes ciphertext + iv + auth_tag; DB row has no plaintext key/secret.
- [ ] Server can round-trip decrypt to the original key/secret.
- [ ] `GET /credentials/status` returns `connected` + masked tail only.
- [ ] `requireAuth` preHandler exported and rejects missing/expired sessions with 401.

## 7. Tests

- Auth flow integration: register/login/me/logout happy path + wrong-password 401 + duplicate-email 409.
- **Credential crypto test (required by PRD Testing Decisions):** store keys, read the raw DB row and
  assert it does not contain the plaintext; decrypt and assert it equals the original; tampering with
  `auth_tag`/ciphertext makes decryption throw (GCM integrity).
- Session expiry test: an expired session row yields 401.
- Log-redaction test: `/credentials` and `/auth/*` bodies do not appear in captured logs.

## 8. Files & Definition of Done

- `apps/api/src/auth/` (routes, service, crypto util, `requireAuth`), `apps/api/src/credentials/`.
- **DoD:** all criteria met, crypto + flow tests green, no secret ever logged or returned in plaintext,
  `requireAuth` reusable by spec 08. Merged to a feature branch off `main`.
