import crypto from "node:crypto";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { sanitizeError } = cakupan;

export function rows(result) {
  return result?.rows ?? result ?? [];
}

/** Perbandingan rahasia job/callback yang timing-safe; beda panjang → false, bukan 500. */
export function samaRahasia(diberikan, diharapkan) {
  if (typeof diberikan !== "string" || typeof diharapkan !== "string") return false;
  if (diberikan.length === 0 || diharapkan.length === 0) return false;
  const a = Buffer.from(diberikan);
  const b = Buffer.from(diharapkan);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Text for an HTML page or mail body: every value that did not come from our own templates. */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
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
  // Module Cakupan Pemanggil (01 langkah 2) melempar CakupanError berbentuk
  // DirectusError (name + status/statusCode + code); hormati statusnya supaya
  // tidak diratakan menjadi 500.
  if (error?.name === "DirectusError" && Number.isInteger(error?.status ?? error?.statusCode)) {
    const status = error.status ?? error.statusCode;
    const code = typeof error.code === "string" ? error.code : "FORBIDDEN";
    res.status(status).json({ errors: [{ message: error.message, extensions: { code } }] });
    return;
  }
  // foreign_key_violation: the body referenced a file, user or item that does not exist.
  if (error?.code === "23503") {
    res.status(400).json({ errors: [{ message: "A referenced item does not exist.", extensions: { code: "INVALID_REFERENCE" } }] });
    return;
  }
  logger.error(sanitizeError(error), "Program endpoint failed");
  res.status(500).json({ errors: [{ message: "The request could not be processed.", extensions: { code: "INTERNAL_SERVER_ERROR" } }] });
}
