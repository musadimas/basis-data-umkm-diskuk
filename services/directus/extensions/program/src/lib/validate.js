import { ProgramError } from "./utils/http.js";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalid = (field) => new ProgramError(400, "INVALID_PAYLOAD", `The field "${field}" is not valid.`);

export function uuidParam(value, code = "INVALID_ID") {
  if (!UUID.test(value ?? "")) throw new ProgramError(400, code, "The id is not valid.");
  return value;
}

export function optionalUuid(body, field) {
  const value = body[field];
  if (value === undefined || value === null || value === "") return null;
  if (!UUID.test(String(value))) throw invalid(field);
  return String(value);
}

export function optionalNumber(body, field, { min = -Infinity, max = Infinity } = {}) {
  const value = body[field];
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw invalid(field);
  return number;
}

export function optionalText(body, field, maxLength) {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > maxLength) throw invalid(field);
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function flag(body, field) {
  const value = body[field];
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") throw invalid(field);
  return value;
}

export function oneOf(body, field, choices, fallback) {
  const value = body[field] ?? fallback;
  if (!choices.includes(value)) throw invalid(field);
  return value;
}

/** Request body as a plain object; anything else is a 400. */
export function objectBody(req) {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProgramError(400, "INVALID_PAYLOAD", "The request body must be a JSON object.");
  }
  return body;
}
