import { eq } from "drizzle-orm";
import { alpacaCredentials } from "@committee/db/schema";

import { getDb } from "../auth/db.js";
import {
  keyTail,
  openCredentials,
  sealCredentials,
  type PlaintextCredentials,
} from "./crypto.js";

/**
 * OWNER: M4 (spec 03) — persistence side of the Alpaca credential vault.
 *
 * Everything that crosses the DB boundary here is ciphertext. The plaintext
 * key/secret exist only as function arguments/returns inside this process and
 * are never logged, never serialised into a response, and never stored.
 */

export interface CredentialStatus {
  connected: boolean;
  /** Last 4 chars of the plaintext key, or null when nothing is stored. */
  keyTail: string | null;
}

/**
 * Encrypt and store (or replace) a user's Alpaca credentials.
 * `alpaca_credentials.user_id` is UNIQUE, so re-saving overwrites in place.
 */
export async function storeCredentials(
  userId: string,
  plaintext: PlaintextCredentials,
): Promise<void> {
  const sealed = sealCredentials(plaintext);
  const db = await getDb();

  await db
    .insert(alpacaCredentials)
    .values({ userId, ...sealed })
    .onConflictDoUpdate({
      target: alpacaCredentials.userId,
      set: {
        keyCiphertext: sealed.keyCiphertext,
        secretCiphertext: sealed.secretCiphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
      },
    });
}

/**
 * Decrypt a user's credentials for server-side use (the Sprint-3 execution
 * layer). Returns null when the user has none stored; THROWS if a stored row
 * fails GCM integrity — a tampered row must never degrade to "no credentials".
 */
export async function loadCredentials(
  userId: string,
): Promise<PlaintextCredentials | null> {
  const db = await getDb();
  const rows = await db
    .select({
      keyCiphertext: alpacaCredentials.keyCiphertext,
      secretCiphertext: alpacaCredentials.secretCiphertext,
      iv: alpacaCredentials.iv,
      authTag: alpacaCredentials.authTag,
    })
    .from(alpacaCredentials)
    .where(eq(alpacaCredentials.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return openCredentials(row);
}

/**
 * Masked status for the UI.
 *
 * DEVIATION NOTE (spec 03 §4 says keyTail is "computed at store time"): spec
 * 01's `alpaca_credentials` table has no `key_tail` column and schema changes
 * are out of scope for this spec, so the tail is derived on read by decrypting
 * server-side and taking the last 4 chars. Same value, same 4-char exposure
 * ceiling, no schema change. If a stored-tail column is ever added, switch to
 * reading it here — the response shape does not change.
 */
export async function getCredentialStatus(
  userId: string,
): Promise<CredentialStatus> {
  const plaintext = await loadCredentials(userId);
  if (!plaintext) return { connected: false, keyTail: null };
  return { connected: true, keyTail: keyTail(plaintext.alpacaKey) };
}
