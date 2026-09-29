import crypto from "node:crypto";
import { createChallenge, verifySolution, pbkdf2 } from "altcha/lib";
import {
  CAPTCHA_ALGORITHM,
  CAPTCHA_MAX_PAYLOAD_LENGTH,
  CAPTCHA_SECRET_LABEL,
  CAPTCHA_TTL_SECONDS,
} from "../constants.js";
import { rows } from "./common.js";
import { captchaCost } from "./env.js";
import { AuthError } from "./errors.js";

/**
 * Captcha HMAC key. When ALTCHA_HMAC_SECRET is unset it is derived from the Directus SECRET
 * with a dedicated label, so the captcha key never equals the JWT signing key.
 */
export function captchaSecret(env) {
  const explicit = env?.ALTCHA_HMAC_SECRET;
  if (explicit && String(explicit).length >= 16) return String(explicit);
  const base = env?.SECRET;
  if (!base) throw new AuthError(503, "CAPTCHA_NOT_CONFIGURED", "Captcha is not configured.");
  return crypto.createHmac("sha256", String(base)).update(CAPTCHA_SECRET_LABEL).digest("hex");
}

export async function issueChallenge(env, now = Date.now()) {
  return createChallenge({
    algorithm: CAPTCHA_ALGORITHM,
    cost: captchaCost(env),
    deriveKey: pbkdf2.deriveKey,
    hmacSignatureSecret: captchaSecret(env),
    expiresAt: new Date(now + CAPTCHA_TTL_SECONDS * 1000),
  });
}

/** Parses the widget payload (base64 JSON `{ challenge, solution }`); null when malformed. */
export function decodePayload(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > CAPTCHA_MAX_PAYLOAD_LENGTH) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    const challenge = parsed?.challenge;
    const solution = parsed?.solution;
    const parameters = challenge?.parameters;
    if (!parameters || typeof parameters !== "object") return null;
    if (typeof challenge.signature !== "string" || !/^[0-9a-f]{32,128}$/i.test(challenge.signature)) return null;
    if (parameters.algorithm !== CAPTCHA_ALGORITHM) return null;
    if (!Number.isSafeInteger(parameters.expiresAt)) return null;
    if (!solution || !Number.isSafeInteger(solution.counter) || typeof solution.derivedKey !== "string") return null;
    return {
      challenge: { parameters, signature: challenge.signature },
      solution: { counter: solution.counter, derivedKey: solution.derivedKey, time: Number(solution.time) || undefined },
    };
  } catch {
    return null;
  }
}

/**
 * Verifies an ALTCHA payload and marks it as used (single use).
 * Returns `{ ok: true }` or `{ ok: false, reason }`; the reason is for audit/logging only
 * and must not be sent to the client on the login path.
 */
export async function consumeCaptcha(database, env, raw, now = Date.now()) {
  const decoded = decodePayload(raw);
  if (!decoded) return { ok: false, reason: raw ? "CAPTCHA_MALFORMED" : "CAPTCHA_MISSING" };
  const expiresAtMs = decoded.challenge.parameters.expiresAt * 1000;
  if (expiresAtMs <= now) return { ok: false, reason: "CAPTCHA_EXPIRED" };
  // A challenge that outlives the server TTL was not issued by this server.
  if (expiresAtMs > now + (CAPTCHA_TTL_SECONDS + 60) * 1000) return { ok: false, reason: "CAPTCHA_INVALID" };
  let result;
  try {
    result = await verifySolution({
      challenge: decoded.challenge,
      solution: decoded.solution,
      deriveKey: pbkdf2.deriveKey,
      hmacSignatureSecret: captchaSecret(env),
    });
  } catch {
    return { ok: false, reason: "CAPTCHA_INVALID" };
  }
  if (result.expired) return { ok: false, reason: "CAPTCHA_EXPIRED" };
  if (!result.verified) return { ok: false, reason: "CAPTCHA_INVALID" };
  try {
    const inserted = await database.raw(
      `INSERT INTO auth_captcha_used (signature, expires_at)
       VALUES (?, to_timestamp(?))
       ON CONFLICT (signature) DO NOTHING
       RETURNING signature`,
      [decoded.challenge.signature.toLowerCase(), decoded.challenge.parameters.expiresAt],
    );
    if (!rows(inserted).length) return { ok: false, reason: "CAPTCHA_REPLAYED" };
  } catch (error) {
    if (error?.code === "42P01") {
      // Table auth_captcha_used does not exist yet (pre-migration DB)
      return { ok: true };
    }
    throw error;
  }
  return { ok: true };
}

export async function purgeExpiredCaptcha(database) {
  try {
    await database.raw("DELETE FROM auth_captcha_used WHERE expires_at < NOW()");
  } catch (error) {
    if (error?.code === "42P01") return;
    throw error;
  }
}
