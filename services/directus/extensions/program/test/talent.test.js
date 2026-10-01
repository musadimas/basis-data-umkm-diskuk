import assert from "node:assert/strict";
import test from "node:test";
import registerTalent from "../src/endpoints/talent/index.js";
import { mountEndpoint } from "./helpers.js";

const ID = "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11";

// Scope, alur pengajuan, Berita Acara, dan duplikat diuji terhadap Postgres di test/pg/talent.test.js.
test("every talent route rejects anonymous and wrong-role callers before database access", async () => {
  const { call, routes, queries } = mountEndpoint(registerTalent);
  assert.equal(routes.length, 9);
  for (const { method, path } of routes) {
    const url = path.replace(/:\w+/g, ID);
    const anonymous = await call(method, url, { accountability: null });
    assert.equal(anonymous.nextError?.statusCode, 401, `${method} ${path}`);
    const wrongRole = await call(method, url, { accountability: { user: "u1", role: "other" } });
    assert.equal(wrongRole.nextError?.statusCode, 403, `${method} ${path}`);
  }
  assert.equal(queries.length, 0);
});

test("semua route talent bertanda terjaga dengan peran yang tepat (01)", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const cakupan = require("../../../analytics-shared/cakupan.cjs");
  const { routes } = mountEndpoint(registerTalent);
  assert.equal(routes.length, 9);
  const peranUntuk = (method, path) => {
    const route = routes.find((r) => r.method === method && r.path === path);
    return cakupan.tandaCakupan(route.handler);
  };
  const ekspektasi = [
    ["GET", "/usaha/:usahaId", ["kabkota", "provinsi"]],
    ["GET", "/pengajuan", ["kabkota", "provinsi"]],
    ["POST", "/pengajuan", ["kabkota", "provinsi"]],
    ["PATCH", "/pengajuan/:id", ["kabkota", "provinsi"]],
    ["POST", "/pengajuan/:id/hitung-skor", ["kabkota", "provinsi"]],
    ["POST", "/pengajuan/:id/ajukan", ["kabkota", "provinsi"]],
    ["POST", "/pengajuan/:id/tolak", ["provinsi"]],
    ["GET", "/berita-acara", ["kabkota", "provinsi"]],
    ["POST", "/berita-acara", ["provinsi"]],
  ];
  for (const [method, path, peran] of ekspektasi) {
    const tanda = peranUntuk(method, path);
    assert.equal(tanda?.jenis, "terjaga", `${method} ${path}`);
    assert.deepEqual([...tanda.peran].sort(), peran, `${method} ${path}`);
  }
});
