/**
 * Error shaped like a DirectusError (duck-typed: name + code + status) so the Directus
 * error handler serializes it with the right status instead of a generic 500.
 */
export class AuthError extends Error {
  constructor(status, code, message = "The request could not be processed.") {
    super(message);
    this.name = "DirectusError";
    this.status = status;
    this.code = code;
    this.extensions = {};
  }
}

/** Identical to Directus' InvalidCredentialsError: never reveals why a login failed. */
export function invalidCredentials() {
  return new AuthError(401, "INVALID_CREDENTIALS", "Invalid user credentials.");
}
