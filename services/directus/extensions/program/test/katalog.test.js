import assert from "node:assert/strict";
import test from "node:test";
import registerKatalog from "../src/endpoints/katalog/index.js";
import { mountEndpoint } from "./helpers.js";

const ID = "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11";

test("management routes require a session; only the letter-of-intent form is public", async () => {
  const { call, routes, queries } = mountEndpoint(registerKatalog, { env: { SECRET: "x" } });
  assert.equal(routes.length, 8);
  for (const { method, path } of routes) {
    if (method === "POST" && path === "/loi") continue;
    const { nextError } = await call(method, path.replace(/:\w+/g, ID), { accountability: null, query: { usaha: ID } });
    assert.equal(nextError?.statusCode, 401, `${method} ${path}`);
  }
  assert.equal(queries.length, 0);
});

test("the public letter of intent validates input and the captcha before touching products", async () => {
  const { call, queries } = mountEndpoint(registerKatalog, { env: { SECRET: "x" } });
  const valid = { produk: ID, nama: "Pembeli", email: "beli@contoh.id", pesan: "Minat" };
  for (const body of [
    { ...valid, email: "bukan-email" },
    { ...valid, nama: "" },
    { ...valid, pesan: "x".repeat(2001) },
    { ...valid, telepon: "call me" },
    { ...valid, produk: "x" },
  ]) {
    const { res } = await call("POST", "/loi", { accountability: null, body });
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
  const { res } = await call("POST", "/loi", { accountability: null, body: { ...valid, captcha: "bogus" } });
  assert.equal(res.body.errors[0].extensions.code, "CAPTCHA_INVALID");
  assert.equal(queries.length, 0);
});

test("product payloads are validated before any query", async () => {
  const { call, queries } = mountEndpoint(registerKatalog);
  const valid = { usaha: ID, nama: "Keripik", foto: [] };
  for (const patch of [
    { nama: "" },
    { kategori: "senjata" },
    { videoUrl: "http://example.com/v" },
    { videoUrl: "javascript:alert(1)" },
    { kbli: "ABC" },
    { tkdnPersen: 120 },
    { moq: 0 },
    { foto: [ID, ID, ID, ID, ID, "x"] },
    { pdnDeklarasi: "ya" },
  ]) {
    const { res } = await call("POST", "/produk", { body: { ...valid, ...patch } });
    assert.equal(res.statusCode, 400, JSON.stringify(patch));
  }
  const reject = await call("POST", `/produk/${ID}/kurasi`, { body: { keputusan: "ditolak" } });
  assert.equal(reject.res.body.errors[0].extensions.code, "CATATAN_WAJIB");
  assert.equal(queries.length, 0);
});
