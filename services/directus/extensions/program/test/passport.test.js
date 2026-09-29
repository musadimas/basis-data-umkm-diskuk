import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import registerPassport from "../src/endpoints/passport/index.js";
import { KODE_PATTERN, canonicalJson, hashPayload, newKode, publicKeyInfo, sign, signingKeys, verify } from "../src/endpoints/passport/signing.js";
import { mountEndpoint } from "./helpers.js";

/** Base64 of a fresh Ed25519 PEM, like the runtime secret PASSPORT_SIGNING_PRIVATE_KEY_B64. */
function ed25519Env() {
  const { privateKey } = crypto.generateKeyPairSync("ed25519");
  return { PASSPORT_SIGNING_PRIVATE_KEY_B64: Buffer.from(privateKey.export({ type: "pkcs8", format: "pem" })).toString("base64") };
}

const env = ed25519Env();
const payload = { kode: "TP0123456789", skor: { pasar: 50, finansial: 35 }, sertifikasi: ["halal"], usaha: { nama: "A" } };

test("canonical JSON ignores key order and undefined values", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } }), '{"a":{"d":[1,{"x":1,"y":2}]},"b":1}');
  assert.equal(hashPayload({ a: 1, b: 2 }), hashPayload({ b: 2, a: 1 }));
});

test("an Ed25519-signed passport verifies; any change to payload, code, kid or key does not", () => {
  const payloadHash = hashPayload(payload);
  const { kid, signature } = sign(env, payload.kode, payloadHash);
  assert.equal(signature.length, 86); // 64 bytes, base64url without padding
  const row = { kode: payload.kode, payload, payload_hash: payloadHash, signature, kid };
  assert.equal(verify(env, row), true);
  assert.equal(verify(env, { ...row, payload: { ...payload, skor: { pasar: 100, finansial: 35 } } }), false);
  assert.equal(verify(env, { ...row, kode: "TP9999999999" }), false);
  assert.equal(verify(env, { ...row, kid: "other000000000000" }), false);
  assert.equal(verify(ed25519Env(), row), false); // a different key never verifies
  assert.equal(verify(env, { ...row, signature: "AAAA" }), false);
  assert.equal(verify(env, { ...row, signature: "a".repeat(64) }), false); // legacy HMAC hex signatures fail
});

test("rotation: the previous key keeps verifying during the window, its kid is recorded", () => {
  const previous = ed25519Env();
  const rotatedEnv = { ...env, PASSPORT_SIGNING_PRIVATE_KEY_PREVIOUS_B64: previous.PASSPORT_SIGNING_PRIVATE_KEY_B64 };
  const keys = signingKeys(rotatedEnv);
  assert.ok(keys.previous);
  assert.notEqual(keys.previous.kid, keys.current.kid);
  const payloadHash = hashPayload(payload);
  const issued = sign(previous, payload.kode, payloadHash); // signed before the rotation
  assert.equal(verify(rotatedEnv, { kode: payload.kode, payload, payload_hash: payloadHash, ...issued }), true);
  const current = sign(env, payload.kode, payloadHash);
  assert.equal(verify(rotatedEnv, { kode: payload.kode, payload, payload_hash: payloadHash, ...current }), true);
});

test("the signing key comes from the runtime secret and fails loudly when missing", () => {
  assert.throws(() => signingKeys({}), (error) => error.statusCode === 503 && error.code === "PASSPORT_NOT_CONFIGURED");
  assert.throws(() => sign({}, payload.kode, "x"), (error) => error.code === "PASSPORT_NOT_CONFIGURED");
  // a non-Ed25519 key is refused, not silently accepted
  const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const rsaEnv = { PASSPORT_SIGNING_PRIVATE_KEY_B64: Buffer.from(rsa.export({ type: "pkcs8", format: "pem" })).toString("base64") };
  assert.throws(() => signingKeys(rsaEnv), (error) => error.code === "PASSPORT_NOT_CONFIGURED");
  const info = publicKeyInfo(env);
  assert.equal(info.jwk.kty, "OKP");
  assert.equal(info.jwk.crv, "Ed25519");
  assert.equal(info.sidikJari.length, 16);
});

test("passport codes are readable, unique and never contain I, L, O or U", () => {
  const codes = new Set(Array.from({ length: 500 }, newKode));
  assert.equal(codes.size, 500);
  for (const kode of codes) assert.match(kode, KODE_PATTERN);
});

test("verification is public; everything else requires a session", async () => {
  const { call, routes, queries } = mountEndpoint(registerPassport, { env });
  for (const { method, path } of routes.filter((route) => !route.path.startsWith("/verify"))) {
    const { nextError } = await call(method, path.replace(/:\w+/g, "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11"), { accountability: null, query: {} });
    assert.equal(nextError?.statusCode, 401, `${method} ${path}`);
  }
  const malformed = await call("GET", "/verify/not-a-code", { accountability: null });
  assert.equal(malformed.res.statusCode, 404);
  assert.equal(queries.length, 0);
});
