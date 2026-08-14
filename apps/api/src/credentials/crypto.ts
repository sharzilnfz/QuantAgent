import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { config } from "../config.js";

/**
 * OWNER: M4 (spec 03 §4 "Crypto contract") — AES-256-GCM vault for Alpaca keys.
 *
 * PURE MODULE: nothing here touches the database, Fastify or the network, so
 * the required crypto tests (raw row holds no plaintext / round-trip / tamper
 * detection) run without any infrastructure.
 *
 * ── Why two nonces behind one `iv` column ──────────────────────────────────
 * Spec 01's `alpaca_credentials` gives us four columns: `key_ciphertext`,
 * `secret_ciphertext`, `iv`, `auth_tag` — but we encrypt TWO independent
 * plaintexts. Reusing one nonce for both under the same key is a catastrophic
 * GCM misuse (it leaks the XOR of the plaintexts and burns the auth key).
 *
 * So we generate a distinct 12-byte nonce per field and store them CONCATENATED
 * in the single `iv` column (24 bytes -> base64); likewise the two 16-byte GCM
 * tags are concatenated into `auth_tag` (32 bytes -> base64). The column
 * contract is honoured, nonces are never reused, and both tags are verified.
 *
 * Each field is additionally bound to its slot with GCM additional
 * authenticated data ("alpaca:key" / "alpaca:secret"), so a row whose key and
 * secret ciphertexts were swapped fails authentication instead of silently
 * decrypting to the wrong field.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

const AAD_KEY = Buffer.from("alpaca:key", "utf8");
const AAD_SECRET = Buffer.from("alpaca:secret", "utf8");

/** The four ciphertext columns of `alpaca_credentials`, all base64. */
export interface SealedCredentials {
  keyCiphertext: string;
  secretCiphertext: string;
  iv: string;
  authTag: string;
}

export interface PlaintextCredentials {
  alpacaKey: string;
  alpacaSecret: string;
}

export class CredentialCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialCryptoError";
  }
}

let cachedKey: Buffer | null = null;

/**
 * Decode `CREDENTIAL_ENC_KEY` (base64, exactly 32 bytes) once.
 * Resolved lazily so importing this module never crashes a process that has no
 * key configured — only actually using the vault does.
 */
export function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  cachedKey = parseEncryptionKey(config.CREDENTIAL_ENC_KEY);
  return cachedKey;
}

/** Exported for tests: validate/decode an arbitrary base64 key. */
export function parseEncryptionKey(base64Key: string): Buffer {
  if (!base64Key) {
    throw new CredentialCryptoError(
      "CREDENTIAL_ENC_KEY is not set — the credential vault cannot operate.",
    );
  }
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== KEY_BYTES) {
    throw new CredentialCryptoError(
      `CREDENTIAL_ENC_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}.`,
    );
  }
  return key;
}

interface SealedField {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

function encryptField(plaintext: string, key: Buffer, aad: Buffer): SealedField {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function decryptField(field: SealedField, key: Buffer, aad: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, field.iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(field.authTag);
  return Buffer.concat([
    decipher.update(field.ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Encrypt a key/secret pair into the four DB columns.
 * The returned object contains NO plaintext.
 */
export function sealCredentials(
  plaintext: PlaintextCredentials,
  key: Buffer = getEncryptionKey(),
): SealedCredentials {
  if (!plaintext.alpacaKey || !plaintext.alpacaSecret) {
    throw new CredentialCryptoError("alpacaKey and alpacaSecret are required.");
  }

  const sealedKey = encryptField(plaintext.alpacaKey, key, AAD_KEY);
  const sealedSecret = encryptField(plaintext.alpacaSecret, key, AAD_SECRET);

  return {
    keyCiphertext: sealedKey.ciphertext.toString("base64"),
    secretCiphertext: sealedSecret.ciphertext.toString("base64"),
    iv: Buffer.concat([sealedKey.iv, sealedSecret.iv]).toString("base64"),
    authTag: Buffer.concat([sealedKey.authTag, sealedSecret.authTag]).toString(
      "base64",
    ),
  };
}

/**
 * Decrypt a stored row back to plaintext. Server-side only, on demand, for the
 * execution layer (Sprint 3).
 *
 * THROWS on any integrity failure — wrong key, truncated/edited ciphertext, a
 * flipped bit in either auth tag, or swapped key/secret columns. Callers must
 * treat a throw as "credentials unusable", never as "empty credentials".
 */
export function openCredentials(
  sealed: SealedCredentials,
  key: Buffer = getEncryptionKey(),
): PlaintextCredentials {
  const ivs = Buffer.from(sealed.iv, "base64");
  const tags = Buffer.from(sealed.authTag, "base64");

  if (ivs.length !== IV_BYTES * 2) {
    throw new CredentialCryptoError("stored iv has an unexpected length");
  }
  if (tags.length !== TAG_BYTES * 2) {
    throw new CredentialCryptoError("stored auth_tag has an unexpected length");
  }

  const alpacaKey = decryptField(
    {
      ciphertext: Buffer.from(sealed.keyCiphertext, "base64"),
      iv: ivs.subarray(0, IV_BYTES),
      authTag: tags.subarray(0, TAG_BYTES),
    },
    key,
    AAD_KEY,
  );

  const alpacaSecret = decryptField(
    {
      ciphertext: Buffer.from(sealed.secretCiphertext, "base64"),
      iv: ivs.subarray(IV_BYTES, IV_BYTES * 2),
      authTag: tags.subarray(TAG_BYTES, TAG_BYTES * 2),
    },
    key,
    AAD_SECRET,
  );

  return { alpacaKey, alpacaSecret };
}

/**
 * Last 4 characters of the PLAINTEXT key — computed at store time and the only
 * fragment ever safe to show (spec 03 §4). Never expose more.
 */
export function keyTail(alpacaKey: string): string {
  return alpacaKey.slice(-4);
}

/** Small helper used by tests to compare buffers without a timing leak. */
export function buffersEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
