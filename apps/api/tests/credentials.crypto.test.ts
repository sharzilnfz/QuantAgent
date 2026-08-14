import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  CredentialCryptoError,
  getEncryptionKey,
  keyTail,
  openCredentials,
  parseEncryptionKey,
  sealCredentials,
  type SealedCredentials,
} from "../src/credentials/crypto.js";

/**
 * Spec 03 §7 — "Credential crypto test (required by PRD Testing Decisions)".
 *
 * These are PURE: no Postgres, no Fastify, no network. They must run and pass
 * everywhere, because "the key never lands in the DB as plaintext" is the one
 * property of this feature that cannot be verified by reading the code alone.
 */

const KEY = randomBytes(32);

const PLAINTEXT = {
  alpacaKey: "PKTEST1234567890ABCD",
  alpacaSecret: "s3cr3t-alpaca-secret-value-9f2b41",
};

/** Flip one bit of a base64 blob — the minimum tamper GCM must still catch. */
function tamperBase64(b64: string, index = 0): string {
  const buf = Buffer.from(b64, "base64");
  buf[index] = buf[index]! ^ 0x01;
  return buf.toString("base64");
}

/** Everything that would actually be written to `alpaca_credentials`. */
function rawRow(sealed: SealedCredentials): Record<string, string> {
  return {
    user_id: "00000000-0000-4000-8000-000000000000",
    key_ciphertext: sealed.keyCiphertext,
    secret_ciphertext: sealed.secretCiphertext,
    iv: sealed.iv,
    auth_tag: sealed.authTag,
  };
}

describe("credential vault — key handling", () => {
  it("accepts a 32-byte base64 key", () => {
    expect(parseEncryptionKey(KEY.toString("base64"))).toHaveLength(32);
  });

  it("rejects a missing key", () => {
    expect(() => parseEncryptionKey("")).toThrow(CredentialCryptoError);
  });

  it("rejects a key of the wrong length", () => {
    expect(() => parseEncryptionKey(randomBytes(16).toString("base64"))).toThrow(
      /32 bytes/,
    );
  });

  it("resolves the configured CREDENTIAL_ENC_KEY", () => {
    // config.ts supplies a 32-byte test default, so the default-arg path of
    // sealCredentials/openCredentials is exercised too.
    expect(getEncryptionKey()).toHaveLength(32);
  });
});

describe("credential vault — stored row contains no plaintext", () => {
  const sealed = sealCredentials(PLAINTEXT, KEY);
  const row = rawRow(sealed);
  const serialisedRow = JSON.stringify(row);

  it("does not contain the plaintext key or secret anywhere in the row", () => {
    expect(serialisedRow).not.toContain(PLAINTEXT.alpacaKey);
    expect(serialisedRow).not.toContain(PLAINTEXT.alpacaSecret);
  });

  it("does not contain the plaintext in any common encoding", () => {
    for (const value of [PLAINTEXT.alpacaKey, PLAINTEXT.alpacaSecret]) {
      for (const encoding of ["base64", "hex", "base64url"] as const) {
        expect(serialisedRow).not.toContain(Buffer.from(value).toString(encoding));
      }
    }
  });

  it("does not contain the plaintext once the ciphertext is decoded", () => {
    const decoded = [
      Buffer.from(sealed.keyCiphertext, "base64").toString("latin1"),
      Buffer.from(sealed.secretCiphertext, "base64").toString("latin1"),
    ].join("|");
    expect(decoded).not.toContain(PLAINTEXT.alpacaKey);
    expect(decoded).not.toContain(PLAINTEXT.alpacaSecret);
  });

  it("stores two distinct 12-byte nonces and two 16-byte tags", () => {
    const ivs = Buffer.from(sealed.iv, "base64");
    const tags = Buffer.from(sealed.authTag, "base64");
    expect(ivs).toHaveLength(24);
    expect(tags).toHaveLength(32);
    // Nonce reuse under one key is a catastrophic GCM failure — assert never.
    expect(ivs.subarray(0, 12).equals(ivs.subarray(12, 24))).toBe(false);
  });

  it("produces a fresh nonce on every seal (no deterministic ciphertext)", () => {
    const again = sealCredentials(PLAINTEXT, KEY);
    expect(again.iv).not.toEqual(sealed.iv);
    expect(again.keyCiphertext).not.toEqual(sealed.keyCiphertext);
  });
});

describe("credential vault — round trip", () => {
  it("decrypts back to exactly the original key and secret", () => {
    const sealed = sealCredentials(PLAINTEXT, KEY);
    expect(openCredentials(sealed, KEY)).toEqual(PLAINTEXT);
  });

  it("round-trips through the configured server key (default arg path)", () => {
    expect(openCredentials(sealCredentials(PLAINTEXT))).toEqual(PLAINTEXT);
  });

  it("round-trips unicode and long values", () => {
    const odd = {
      alpacaKey: "ключ-🔑-KEY".padEnd(40, "x"),
      alpacaSecret: "sécret—value".repeat(10),
    };
    expect(openCredentials(sealCredentials(odd, KEY), KEY)).toEqual(odd);
  });

  it("exposes only the last 4 chars of the plaintext key as keyTail", () => {
    expect(keyTail(PLAINTEXT.alpacaKey)).toBe("ABCD");
    expect(keyTail(PLAINTEXT.alpacaKey)).toHaveLength(4);
    expect(PLAINTEXT.alpacaKey).not.toBe(keyTail(PLAINTEXT.alpacaKey));
  });
});

describe("credential vault — GCM integrity (tampering must throw)", () => {
  it("throws when the key auth tag is altered", () => {
    const sealed = sealCredentials(PLAINTEXT, KEY);
    const tampered = { ...sealed, authTag: tamperBase64(sealed.authTag, 0) };
    expect(() => openCredentials(tampered, KEY)).toThrow();
  });

  it("throws when the secret auth tag is altered", () => {
    const sealed = sealCredentials(PLAINTEXT, KEY);
    // Second tag lives at bytes 16..31 of the concatenated auth_tag column.
    const tampered = { ...sealed, authTag: tamperBase64(sealed.authTag, 16) };
    expect(() => openCredentials(tampered, KEY)).toThrow();
  });

  it("throws when the key ciphertext is altered", () => {
    const sealed = sealCredentials(PLAINTEXT, KEY);
    const tampered = {
      ...sealed,
      keyCiphertext: tamperBase64(sealed.keyCiphertext, 0),
    };
    expect(() => openCredentials(tampered, KEY)).toThrow();
  });

  it("throws when the secret ciphertext is altered", () => {
    const sealed = sealCredentials(PLAINTEXT, KEY);
    const tampered = {
      ...sealed,
      secretCiphertext: tamperBase64(sealed.secretCiphertext, 0),
    };
    expect(() => openCredentials(tampered, KEY)).toThrow();
  });

  it("throws when the iv is altered", () => {
    const sealed = sealCredentials(PLAINTEXT, KEY);
    const tampered = { ...sealed, iv: tamperBase64(sealed.iv, 0) };
    expect(() => openCredentials(tampered, KEY)).toThrow();
  });

  it("throws when decrypted with the wrong key", () => {
    const sealed = sealCredentials(PLAINTEXT, KEY);
    expect(() => openCredentials(sealed, randomBytes(32))).toThrow();
  });

  it("throws when the key and secret ciphertexts are swapped (AAD binding)", () => {
    const sealed = sealCredentials(
      { alpacaKey: "SAMELENGTHKEY000", alpacaSecret: "SAMELENGTHSEC000" },
      KEY,
    );
    const swapped = {
      ...sealed,
      keyCiphertext: sealed.secretCiphertext,
      secretCiphertext: sealed.keyCiphertext,
    };
    expect(() => openCredentials(swapped, KEY)).toThrow();
  });

  it("throws on a truncated iv or auth_tag column", () => {
    const sealed = sealCredentials(PLAINTEXT, KEY);
    expect(() =>
      openCredentials({ ...sealed, iv: Buffer.alloc(12).toString("base64") }, KEY),
    ).toThrow(CredentialCryptoError);
    expect(() =>
      openCredentials(
        { ...sealed, authTag: Buffer.alloc(16).toString("base64") },
        KEY,
      ),
    ).toThrow(CredentialCryptoError);
  });

  it("refuses to seal empty credentials", () => {
    expect(() =>
      sealCredentials({ alpacaKey: "", alpacaSecret: "x" }, KEY),
    ).toThrow(CredentialCryptoError);
  });
});
