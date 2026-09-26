import { sanitizeError } from "./auth.js";

export { routeGuard, sanitizeError } from "./auth.js";

export function rows(result) {
  return result?.rows ?? result ?? [];
}

export function noStore(res) {
  res.setHeader("Cache-Control", "private, no-store");
}

/** Request error with a stable code; sendError returns it to the client as-is. */
export class ProgramError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "ProgramError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function sendError(res, logger, error) {
  noStore(res);
  if (error instanceof ProgramError) {
    res.status(error.statusCode).json({ errors: [{ message: error.message, extensions: { code: error.code } }] });
    return;
  }
  logger.error(sanitizeError(error), "Program endpoint failed");
  res.status(500).json({ errors: [{ message: "The request could not be processed.", extensions: { code: "INTERNAL_SERVER_ERROR" } }] });
}
