import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { alpacaCredentials } from "../../db/schema.js";
import { encrypt, decrypt, parseEncryptionKey } from "../../lib/crypto.js";
import { config } from "../../config.js";
import { createModuleLogger } from "../../lib/logger.js";

const logger = createModuleLogger("credentials");

/**
 * Store (or update) a user's Alpaca API credentials, encrypted at rest.
 *
 * The API key and secret are encrypted separately but share the same IV
 * for simplicity (each still gets unique ciphertext due to different plaintext).
 * On update, the old row is replaced entirely.
 */
export async function storeAlpacaCredentials(
  userId: string,
  apiKey: string,
  apiSecret: string,
  isPaper: boolean = true
) {
  const encKey = parseEncryptionKey(config.APP_ENCRYPTION_KEY);

  const encryptedKey = encrypt(apiKey, encKey);
  const encryptedSecret = encrypt(apiSecret, encKey);

  // Use the IV + authTag from the key encryption for storage.
  // The secret gets its own IV+authTag internally, but we store them concatenated.
  await db
    .insert(alpacaCredentials)
    .values({
      userId,
      keyCiphertext: encryptedKey.ciphertext,
      secretCiphertext: encryptedSecret.ciphertext,
      iv: JSON.stringify({ key: encryptedKey.iv, secret: encryptedSecret.iv }),
      authTag: JSON.stringify({
        key: encryptedKey.authTag,
        secret: encryptedSecret.authTag,
      }),
      isPaper,
    })
    .onConflictDoUpdate({
      target: alpacaCredentials.userId,
      set: {
        keyCiphertext: encryptedKey.ciphertext,
        secretCiphertext: encryptedSecret.ciphertext,
        iv: JSON.stringify({
          key: encryptedKey.iv,
          secret: encryptedSecret.iv,
        }),
        authTag: JSON.stringify({
          key: encryptedKey.authTag,
          secret: encryptedSecret.authTag,
        }),
        isPaper,
      },
    });

  logger.info({ userId, isPaper }, "Alpaca credentials stored");
}

/**
 * Retrieve and decrypt a user's Alpaca API credentials.
 * Returns null if no credentials are stored.
 * Never expose through client-facing endpoints.
 */
export async function getDecryptedAlpacaCredentials(userId: string) {
  const [row] = await db
    .select()
    .from(alpacaCredentials)
    .where(eq(alpacaCredentials.userId, userId))
    .limit(1);

  if (!row) return null;

  const encKey = parseEncryptionKey(config.APP_ENCRYPTION_KEY);
  const ivs = JSON.parse(row.iv) as { key: string; secret: string };
  const tags = JSON.parse(row.authTag) as { key: string; secret: string };

  const apiKey = decrypt(
    { ciphertext: row.keyCiphertext, iv: ivs.key, authTag: tags.key },
    encKey
  );
  const apiSecret = decrypt(
    {
      ciphertext: row.secretCiphertext,
      iv: ivs.secret,
      authTag: tags.secret,
    },
    encKey
  );

  return { apiKey, apiSecret, isPaper: row.isPaper };
}

/**
 * Check whether a user has Alpaca credentials configured.
 * Returns { configured: boolean } — never returns the actual keys.
 */
export async function getAlpacaCredentialStatus(userId: string) {
  const [row] = await db
    .select({ userId: alpacaCredentials.userId })
    .from(alpacaCredentials)
    .where(eq(alpacaCredentials.userId, userId))
    .limit(1);

  return { configured: !!row };
}
