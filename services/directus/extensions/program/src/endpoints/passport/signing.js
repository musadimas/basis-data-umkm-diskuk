/**
 * Talent Passport signatures. The signed payload is serialised canonically (sorted keys), hashed
 * with SHA-256 and signed with HMAC-SHA256 over "<kode>.<hash>". HMAC detects tampering by
 * anyone without the server key; it is not non-repudiation (that would need an Ed25519 key pair).
 */
import crypto from "node:crypto";
import { ProgramError } from "../../lib/utils/http.js";

const KEY_LABEL = "diskuk-talent-passport-v1";
// Crockford base32 without I, L, O, U: easy to read aloud and type from a printed card.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const KODE_PATTERN = /^TP[0-9A-HJKMNP-TV-Z]{10}$/;

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function signingKey(env) {
  const explicit = env?.PASSPORT_SIGNING_SECRET;
  if (explicit && String(explicit).length >= 32) return String(explicit);
  if (!env?.SECRET) throw new ProgramError(503, "PASSPORT_NOT_CONFIGURED", "Passport signing is not configured.");
  return crypto.createHmac("sha256", String(env.SECRET)).update(KEY_LABEL).digest("hex");
}

export function hashPayload(payload) {
  return crypto.createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

export function sign(env, kode, payloadHash) {
  return crypto.createHmac("sha256", signingKey(env)).update(`${kode}.${payloadHash}`).digest("hex");
}

/** True when the stored payload still hashes to payload_hash and the signature matches. */
export function verify(env, { kode, payload, payload_hash: payloadHash, signature }) {
  const recomputed = hashPayload(payload);
  if (recomputed !== payloadHash) return false;
  const expected = Buffer.from(sign(env, kode, recomputed), "hex");
  const given = Buffer.from(String(signature), "hex");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export function newKode() {
  let kode = "TP";
  for (let index = 0; index < 10; index += 1) kode += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return kode;
}
