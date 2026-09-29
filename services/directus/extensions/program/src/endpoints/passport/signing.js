/**
 * Talent Passport signatures (Y04/M6-01): the canonical payload is hashed with SHA-256 and signed
 * with Ed25519 over "<kode>.<hash>". Unlike the earlier HMAC design this is asymmetric — anyone
 * holding the public key can verify a passport, and nobody without the private key can forge one.
 *
 * The private key comes from the runtime secret PASSPORT_SIGNING_PRIVATE_KEY_B64 (base64 of the
 * PEM; generate with `openssl genpkey -algorithm ed25519 | base64 | tr -d '\n'`). kid identifies
 * the active key so rotation is auditable: PASSPORT_SIGNING_KID when set, else a fingerprint of
 * the public key. PASSPORT_SIGNING_PRIVATE_KEY_PREVIOUS_B64 optionally keeps the previous key
 * verifying during a rotation window; passports signed by any other key are invalid and must be
 * re-issued (verification never trusts a key outside the runtime secrets).
 *
 * One code only: the brief contract names the QR payload `qr_talent_passport_code`, the legacy
 * plan stored it as `passport_kode`, and the canonical column is `talent_passport.kode` — the API
 * exposes the same value as `qrTalentPassportCode` (always equal to `kode`); there is no second,
 * independently generated code anywhere in this module.
 */
import crypto from "node:crypto";
import { ProgramError } from "../../lib/utils/http.js";

// Crockford base32 without I, L, O, U: easy to read aloud and type from a printed card.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const KODE_PATTERN = /^TP[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$/;
const message = (kode, payloadHash) => `${kode}.${payloadHash}`;

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

export function hashPayload(payload) {
  return crypto.createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

function loadPrivateKey(value) {
  if (!value) return null;
  let key;
  try {
    key = crypto.createPrivateKey(Buffer.from(String(value), "base64").toString("utf8"));
  } catch {
    return null;
  }
  return key.asymmetricKeyType === "ed25519" ? key : null;
}

function kidOf(privateKey) {
  const publicKey = crypto.createPublicKey(privateKey);
  return crypto
    .createHash("sha256")
    .update(publicKey.export({ format: "der", type: "spki" }))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Active (and optional previous) signing key(s). Throws 503 PASSPORT_NOT_CONFIGURED when no usable
 * Ed25519 key is configured — issuing AND verifying both fail loudly instead of guessing.
 */
export function signingKeys(env) {
  const privateKey = loadPrivateKey(env?.PASSPORT_SIGNING_PRIVATE_KEY_B64);
  if (!privateKey) throw new ProgramError(503, "PASSPORT_NOT_CONFIGURED", "Passport signing is not configured.");
  const current = { kid: env?.PASSPORT_SIGNING_KID || kidOf(privateKey), privateKey };
  const previousKey = loadPrivateKey(env?.PASSPORT_SIGNING_PRIVATE_KEY_PREVIOUS_B64);
  const previous = previousKey ? { kid: env?.PASSPORT_SIGNING_KID_PREVIOUS || kidOf(previousKey), privateKey: previousKey } : null;
  return { current, previous };
}

/** Ed25519 signature (base64url) of "<kode>.<payloadHash>", plus the kid that signed it. */
export function sign(env, kode, payloadHash) {
  const { current } = signingKeys(env);
  return {
    kid: current.kid,
    signature: crypto.sign(null, Buffer.from(message(kode, payloadHash)), current.privateKey).toString("base64url"),
  };
}

/**
 * True when the stored payload still hashes to payload_hash and the signature verifies against a
 * configured key (current, or the previous one while its kid is still on the row). Unconfigured
 * signing propagates the 503 instead of reporting the passport as tampered.
 */
export function verify(env, { kode, payload, payload_hash: payloadHash, signature, kid }) {
  const keys = signingKeys(env);
  if (hashPayload(payload) !== payloadHash) return false;
  const given = Buffer.from(String(signature ?? ""), "base64url");
  for (const key of [keys.current, keys.previous]) {
    if (!key) continue;
    if (kid && kid !== key.kid) continue;
    const publicKey = crypto.createPublicKey(key.privateKey);
    if (given.length === 64 && crypto.verify(null, Buffer.from(message(kode, payloadHash)), publicKey, given)) return true;
  }
  return false;
}

/** Public half of the active key (JWK + short fingerprint) so third parties can verify too. */
export function publicKeyInfo(env) {
  const { current } = signingKeys(env);
  const publicKey = crypto.createPublicKey(current.privateKey);
  return {
    kid: current.kid,
    jwk: publicKey.export({ format: "jwk" }),
    sidikJari: crypto
      .createHash("sha256")
      .update(publicKey.export({ format: "der", type: "spki" }))
      .digest("hex")
      .slice(0, 16),
  };
}

export function newKode() {
  let kode = "TP";
  for (let index = 0; index < 10; index += 1) kode += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return kode;
}
