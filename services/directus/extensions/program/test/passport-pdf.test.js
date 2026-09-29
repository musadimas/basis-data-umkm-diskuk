import assert from "node:assert/strict";
import test from "node:test";
import registerPassport from "../src/endpoints/passport/index.js";
import { mountEndpoint } from "./helpers.js";

const USAHA = "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11";

// Isi dan scope PDF diuji terhadap Postgres di test/pg/passport-pdf.test.js.
test("anonymous request to PDF endpoints is rejected with 401 before any query", async () => {
  const { call, queries } = mountEndpoint(registerPassport);
  for (const path of ["/pdf/summary", "/pdf/katalog"]) {
    const { nextError } = await call("GET", path, { accountability: null, query: { usaha: USAHA } });
    assert.equal(nextError.statusCode, 401, path);
  }
  assert.equal(queries.length, 0);
});

test("semua route passport bertanda terjaga/publik dengan peran yang tepat (01)", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const cakupan = require("../../../analytics-shared/cakupan.cjs");
  const routes = new Map();
  const { default: registerPassport } = await import("../src/endpoints/passport/index.js");
  registerPassport(
    {
      get: (path, fn) => routes.set(`GET ${path}`, fn),
      post: (path, fn) => routes.set(`POST ${path}`, fn),
    },
    { database: { raw: async () => ({ rows: [] }) }, env: {}, logger: { error: () => {} } },
  );
  const ekspektasi = [
    ["GET", "/verify/:kode", "publik", []],
    ["GET", "/pdf/summary", "terjaga", ["kabkota", "provinsi", "umkm"]],
    ["GET", "/pdf/katalog", "terjaga", ["kabkota", "provinsi", "umkm"]],
    ["GET", "/", "terjaga", ["kabkota", "provinsi", "umkm"]],
    ["POST", "/", "terjaga", ["provinsi"]],
    ["POST", "/:id/cabut", "terjaga", ["provinsi"]],
  ];
  for (const [method, path, jenis, peran] of ekspektasi) {
    const tanda = cakupan.tandaCakupan(routes.get(`${method} ${path}`));
    assert.equal(tanda?.jenis, jenis, `${method} ${path}`);
    assert.deepEqual([...(tanda.peran ?? [])].sort(), peran, `${method} ${path}`);
  }
});
