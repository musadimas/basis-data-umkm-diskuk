import assert from "node:assert/strict";
import test from "node:test";
import registerPassport from "../src/endpoints/passport/index.js";
import { KODE_PATTERN, canonicalJson, hashPayload, newKode, sign, signingKey, verify } from "../src/endpoints/passport/signing.js";
import { mountEndpoint } from "./helpers.js";

const env = { SECRET: "unit-test-secret" };
const payload = { kode: "TP0123456789", skor: { pasar: 50, finansial: 35 }, sertifikasi: ["halal"], usaha: { nama: "A" } };

test("canonical JSON ignores key order and undefined values", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } }), '{"a":{"d":[1,{"x":1,"y":2}]},"b":1}');
  assert.equal(hashPayload({ a: 1, b: 2 }), hashPayload({ b: 2, a: 1 }));
});

test("a signed passport verifies; any change to payload, code or key does not", () => {
  const payloadHash = hashPayload(payload);
  const row = { kode: payload.kode, payload, payload_hash: payloadHash, signature: sign(env, payload.kode, payloadHash) };
  assert.equal(verify(env, row), true);
  assert.equal(verify(env, { ...row, payload: { ...payload, skor: { pasar: 100, finansial: 35 } } }), false);
  assert.equal(verify(env, { ...row, kode: "TP9999999999" }), false);
  assert.equal(verify({ SECRET: "other" }, row), false);
  assert.equal(verify(env, { ...row, signature: "zz" }), false);
});

test("the signing key comes from PASSPORT_SIGNING_SECRET, else is derived from SECRET", () => {
  assert.equal(signingKey({ PASSPORT_SIGNING_SECRET: "x".repeat(32), SECRET: "s" }), "x".repeat(32));
  assert.notEqual(signingKey(env), env.SECRET);
  assert.throws(() => signingKey({}), (error) => error.code === "PASSPORT_NOT_CONFIGURED");
});

test("passport codes are readable and unique enough", () => {
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
