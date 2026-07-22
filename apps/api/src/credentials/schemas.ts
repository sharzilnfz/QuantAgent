import { z } from "zod";

/**
 * OWNER: M4 (spec 03). API-local body schema for the credential vault.
 * Bounded lengths keep a hostile payload from becoming a giant ciphertext row.
 */
export const StoreCredentialsBody = z.object({
  alpacaKey: z.string().trim().min(8).max(256),
  alpacaSecret: z.string().trim().min(8).max(256),
});
export type StoreCredentialsBody = z.infer<typeof StoreCredentialsBody>;
