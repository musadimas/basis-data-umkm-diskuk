// ALTCHA verification for the public programme forms (katalog LOI, klinik tickets). Challenges
// come from the authentication bundle's GET /v1/auth/captcha/challenge, so this must derive the
// same HMAC key and share its single-use store (auth_captcha_used). The algorithm, TTL and key
// label mirror authentication/src/lib/constants.js; test/captcha.test.js checks they match.
import crypto from "node:crypto";
import { pbkdf2, verifySolution } from "altcha/lib";
import { ProgramError, rows } from "./utils/http.js";

export const CAPTCHA_ALGORITHM = "PBKDF2/SHA-256";
export const CAPTCHA_TTL_SECONDS = 300;
export const CAPTCHA_MAX_PAYLOAD_LENGTH = 4096;
export const CAPTCHA_SECRET_LABEL = "diskuk-auth-captcha-v1";

function captchaSecret(env) {
  const explicit = env?.ALTCHA_HMAC_SECRET;
  if (explicit && String(explicit).length >= 16) return String(explicit);
  const base = env?.SECRET;
  if (!base) throw new ProgramError(503, "CAPTCHA_NOT_CONFIGURED", "Captcha is not configured.");
  return crypto.createHmac("sha256", String(base)).update(CAPTCHA_SECRET_LABEL).digest("hex");
}

function decodePayload(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > CAPTCHA_MAX_PAYLOAD_LENGTH) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    const { challenge, solution } = parsed ?? {};
    const parameters = challenge?.parameters;
    if (!parameters || typeof parameters !== "object") return null;
    if (typeof challenge.signature !== "string" || !/^[0-9a-f]{32,128}$/i.test(challenge.signature)) return null;
    if (parameters.algorithm !== CAPTCHA_ALGORITHM || !Number.isSafeInteger(parameters.expiresAt)) return null;
    if (!solution || !Number.isSafeInteger(solution.counter) || typeof solution.derivedKey !== "string") return null;
    return {
      challenge: { parameters, signature: challenge.signature },
      solution: { counter: solution.counter, derivedKey: solution.derivedKey, time: Number(solution.time) || undefined },
    };
  } catch {
    return null;
  }
}

/** Verifies and consumes a captcha payload; throws 400 CAPTCHA_INVALID otherwise. */
export async function requireCaptcha(database, env, raw, now = Date.now()) {
  const invalid = new ProgramError(400, "CAPTCHA_INVALID", "The captcha is missing, expired or already used.");
  const decoded = decodePayload(raw);
  if (!decoded) throw invalid;
  const expiresAtMs = decoded.challenge.parameters.expiresAt * 1000;
  if (expiresAtMs <= now || expiresAtMs > now + (CAPTCHA_TTL_SECONDS + 60) * 1000) throw invalid;
  let result;
  try {
    result = await verifySolution({
      challenge: decoded.challenge,
      solution: decoded.solution,
      deriveKey: pbkdf2.deriveKey,
      hmacSignatureSecret: captchaSecret(env),
    });
  } catch {
    throw invalid;
  }
  if (!result.verified || result.expired) throw invalid;
  const inserted = await database.raw(
    `INSERT INTO auth_captcha_used (signature, expires_at) VALUES (?, to_timestamp(?))
     ON CONFLICT (signature) DO NOTHING RETURNING signature`,
    [decoded.challenge.signature.toLowerCase(), decoded.challenge.parameters.expiresAt],
  );
  if (!rows(inserted).length) throw invalid;
}
