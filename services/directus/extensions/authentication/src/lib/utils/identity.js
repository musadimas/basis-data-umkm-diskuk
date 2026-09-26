import crypto from "node:crypto";
import { NIB_RE } from "../constants.js";
import { rows } from "./common.js";

export function isNib(identifier) {
  return NIB_RE.test(identifier);
}

/** NIB → email of the active account linked to that business; null unless exactly one match. */
export async function resolveNibEmail(database, nib) {
  const result = await database.raw(
    `SELECT u.email
       FROM directus_users u
       JOIN usaha b ON b.id = u.usaha
      WHERE b.nib = ? AND u.status = 'active' AND u.email IS NOT NULL
      LIMIT 2`,
    [nib],
  );
  const list = rows(result);
  return list.length === 1 ? list[0].email : null;
}

/** Unregistered email so an unknown NIB takes the same failure path as an unknown email. */
export function unmatchedEmail() {
  return `nib-${crypto.randomUUID()}@unmatched.invalid`;
}

/**
 * Maps what the user typed in the "email or NIB" field to the email Directus looks up.
 * A NIB becomes the linked account's email, or an unmatched address so it fails exactly
 * like an unknown email; anything else is passed through for Directus to validate.
 */
export async function resolveLoginEmail(database, value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!isNib(trimmed)) return value;
  return (await resolveNibEmail(database, trimmed)) || unmatchedEmail();
}
