import { z } from "zod";

/**
 * OWNER: M4 (spec 03). API-local request/response shapes.
 *
 * These deliberately live in `apps/api` and NOT in `packages/contracts`
 * (spec 03 §4): they are transport details of this service, not a
 * cross-service contract. `packages/contracts` stays reserved for shapes that
 * more than one service must agree on.
 */

/** Emails are compared case-insensitively; normalise once, at the edge. */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(320);

export const RegisterBody = z.object({
  email,
  // 8 is the floor for new passwords. Login deliberately does NOT re-apply it
  // (an existing weak password must still be able to fail closed, not 400).
  password: z.string().min(8).max(200),
});
export type RegisterBody = z.infer<typeof RegisterBody>;

export const LoginBody = z.object({
  email,
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof LoginBody>;

/** The only user shape ever sent to a client. Never includes the hash. */
export const PublicUser = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});
export type PublicUser = z.infer<typeof PublicUser>;
