import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "@committee/db/schema";

import { getDb } from "./db.js";
import { DuplicateEmailError, InvalidCredentialsError } from "./errors.js";
import type { PublicUser } from "./schemas.js";

/**
 * OWNER: M4 (spec 03) — user registration + password verification.
 *
 * bcrypt (via `bcryptjs`) is the hashing choice allowed by spec 03 §2
 * ("argon2 (or bcrypt)"); argon2 is intentionally not a dependency because it
 * needs a native build in this toolchain.
 */

const BCRYPT_ROUNDS = 10;

/**
 * A real bcrypt hash of a throwaway string. When an email doesn't exist we
 * still run one full bcrypt comparison against this so a missing account and a
 * wrong password cost the same wall-clock time — closing the timing side
 * channel that would otherwise re-open user enumeration.
 */
const DUMMY_HASH =
  "$2a$10$c5iumPvU28bj/KDbtYRS1OYX4qjtvbHR75iaO.dolNCz/ABwGOSz6";

/** Hash a plaintext password. The plaintext is never stored or logged. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Create a user. Throws `DuplicateEmailError` if the email is taken — the one
 * place where "this email exists" is intentionally observable (409), because a
 * registration form cannot function otherwise.
 */
export async function registerUser(
  email: string,
  password: string,
): Promise<PublicUser> {
  const db = await getDb();
  const passwordHash = await hashPassword(password);

  const inserted = await db
    .insert(users)
    .values({ email, passwordHash })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email });

  const user = inserted[0];
  if (!user) throw new DuplicateEmailError();

  return user;
}

/**
 * Verify email + password.
 *
 * Throws the SAME `InvalidCredentialsError` for an unknown email and a bad
 * password (spec 03 §5: generic error, no user enumeration). Comparison is
 * done by bcrypt's own constant-time verify.
 */
export async function authenticate(
  email: string,
  password: string,
): Promise<PublicUser> {
  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const row = rows[0];
  const ok = await bcrypt.compare(password, row?.passwordHash ?? DUMMY_HASH);

  if (!row || !ok) throw new InvalidCredentialsError();

  return { id: row.id, email: row.email };
}
