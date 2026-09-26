import { DURATION_UNITS, SESSION_IDLE_DEFAULT, SESSION_MAX_AGE_DEFAULT } from "../constants.js";
import { rows } from "./common.js";

// The policy lives on Directus' own session rows: directus_sessions.date_created and
// .date_updated (migration 20260926C-add-session-policy-to-directus-sessions).

/** Parses a duration such as "30m", "8h", "90s" or plain milliseconds; null when invalid. */
export function durationMs(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const ms = Number(match[1]) * DURATION_UNITS[match[2] || "ms"];
  return ms > 0 ? ms : null;
}

export function sessionIdleMs(env) {
  return durationMs(env?.AUTH_SESSION_IDLE_TIMEOUT) ?? durationMs(SESSION_IDLE_DEFAULT);
}

export function sessionMaxAgeMs(env) {
  return durationMs(env?.AUTH_SESSION_MAX_AGE) ?? durationMs(SESSION_MAX_AGE_DEFAULT);
}

/** "ok", "idle" (no request within the idle timeout) or "expired" (older than the max age). */
export function sessionVerdict(session, env, now = Date.now()) {
  if (now - new Date(session.date_created).getTime() >= sessionMaxAgeMs(env)) return "expired";
  if (now - new Date(session.date_updated).getTime() >= sessionIdleMs(env)) return "idle";
  return "ok";
}

export async function readSession(database, token) {
  const result = await database.raw(
    "SELECT date_created, date_updated FROM directus_sessions WHERE token = ?",
    [token],
  );
  return rows(result)[0] ?? null;
}

/**
 * On refresh Directus inserts a new session row (date_created defaults to now) and links the
 * previous row to it via next_token. Copy the original start time so refreshing never
 * extends the absolute lifetime.
 */
export async function carrySessionStart(database, newToken) {
  await database.raw(
    `UPDATE directus_sessions AS current
        SET date_created = previous.date_created
       FROM directus_sessions AS previous
      WHERE current.token = ? AND previous.next_token = current.token`,
    [newToken],
  );
}

export async function touchSession(database, token) {
  await database.raw("UPDATE directus_sessions SET date_updated = NOW() WHERE token = ?", [token]);
}

/** Ends the Directus session, so the token stops working everywhere. */
export async function revokeSession(database, token) {
  await database.raw("DELETE FROM directus_sessions WHERE token = ?", [token]);
}
