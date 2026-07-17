import { hash, verify } from "argon2";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users, refreshTokens } from "../../db/schema.js";
import { config } from "../../config.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("auth");

// ─── Password hashing ──────────────────────────────────────────────────────

/** Hash a password with argon2id (recommended for passwords). */
export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** Verify a password against its argon2id hash. */
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  return verify(hash, password);
}

// ─── JWT helpers ────────────────────────────────────────────────────────────

export interface TokenPayload {
  userId: string;
  email: string;
}

/**
 * Parse a TTL string like "15m", "30d", "2h" into seconds.
 */
function parseTtl(ttl: string): number {
  const match = ttl.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      throw new Error(`Unknown TTL unit: ${unit}`);
  }
}

/** Issue a short-lived access token (held in frontend memory). */
export function issueAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: parseTtl(config.ACCESS_TOKEN_TTL),
  });
}

/** Verify and decode an access token. */
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as TokenPayload;
}

/** Issue a refresh token (stored as hash in DB, sent as httpOnly cookie). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

/** SHA-256 hash a refresh token for DB storage. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── User management ────────────────────────────────────────────────────────

export async function createUser(email: string, password: string) {
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning({ id: users.id, email: users.email, createdAt: users.createdAt });

  logger.info({ userId: user.id, email }, "User registered");
  return user;
}

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user ?? null;
}

export async function findUserById(id: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ?? null;
}

// ─── Refresh token rotation ─────────────────────────────────────────────────

/**
 * Store a hashed refresh token in the DB.
 * Returns the expiration date for cookie `maxAge`.
 */
export async function storeRefreshToken(userId: string, token: string) {
  const tokenHash = hashToken(token);
  const ttlSeconds = parseTtl(config.REFRESH_TOKEN_TTL);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return { expiresAt, ttlSeconds };
}

/**
 * Validate and rotate a refresh token.
 * - Finds the matching un-revoked token
 * - Revokes it (one-time use)
 * - Issues a new refresh token
 * Returns the user + new tokens, or null if invalid.
 */
export async function rotateRefreshToken(oldToken: string) {
  const oldHash = hashToken(oldToken);

  // Find the token row
  const [tokenRow] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, oldHash),
        isNull(refreshTokens.revokedAt)
      )
    )
    .limit(1);

  if (!tokenRow) {
    logger.warn("Refresh token not found or already revoked");
    return null;
  }

  // Check expiry
  if (tokenRow.expiresAt < new Date()) {
    logger.warn({ userId: tokenRow.userId }, "Refresh token expired");
    return null;
  }

  // Revoke old token
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, tokenRow.id));

  // Find user
  const user = await findUserById(tokenRow.userId);
  if (!user) return null;

  // Issue new tokens
  const newRefreshToken = generateRefreshToken();
  const { expiresAt, ttlSeconds } = await storeRefreshToken(
    user.id,
    newRefreshToken
  );

  const accessToken = issueAccessToken({ userId: user.id, email: user.email });

  logger.info({ userId: user.id }, "Refresh token rotated");

  return { user, accessToken, refreshToken: newRefreshToken, expiresAt, ttlSeconds };
}

/**
 * Revoke all refresh tokens for a user (used on logout).
 */
export async function revokeAllUserTokens(userId: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt))
    );

  logger.info({ userId }, "All refresh tokens revoked");
}
