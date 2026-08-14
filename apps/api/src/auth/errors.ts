/**
 * OWNER: M4 (spec 03). Typed domain errors for the auth/credential surface.
 *
 * Deliberately message-poor: these strings can reach a log line, so they must
 * never carry an email, password, session id or API key.
 */

export class DuplicateEmailError extends Error {
  constructor() {
    super("email_already_registered");
    this.name = "DuplicateEmailError";
  }
}

/** Thrown for BOTH "no such user" and "wrong password" — no user enumeration. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("invalid_credentials");
    this.name = "InvalidCredentialsError";
  }
}
