import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption/decryption for Alpaca API keys.
 *
 * The encryption key comes from APP_ENCRYPTION_KEY env var (32-byte, base64).
 * Each encrypt call generates a fresh IV, ensuring ciphertext is unique even
 * for the same plaintext. The authTag provides integrity verification.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Parse the encryption key from the env var format `base64:...`.
 * Returns a 32-byte Buffer suitable for AES-256.
 */
export function parseEncryptionKey(raw: string): Buffer {
  const key = raw.startsWith("base64:")
    ? Buffer.from(raw.slice(7), "base64")
    : Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to exactly 32 bytes, got ${key.length}`
    );
  }
  return key;
}

export interface EncryptedPayload {
  ciphertext: string; // hex-encoded
  iv: string; // hex-encoded
  authTag: string; // hex-encoded
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns hex-encoded ciphertext, iv, and authTag for DB storage.
 */
export function encrypt(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt an AES-256-GCM encrypted payload back to plaintext.
 */
export function decrypt(payload: EncryptedPayload, key: Buffer): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "hex"));

  let plaintext = decipher.update(payload.ciphertext, "hex", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}
