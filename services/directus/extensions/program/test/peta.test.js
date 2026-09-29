import assert from "node:assert/strict";
import test from "node:test";
import registerPeta from "../src/endpoints/peta/index.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cakupan = require("../../../analytics-shared/cakupan.cjs");
import { mountEndpoint } from "./helpers.js";

// Perilaku data (scope, kota null, kedaluwarsa WIB) diuji terhadap Postgres di test/pg/peta.test.js.
test("route peta di-mount lewat terjaga() peran provinsi/kabkota/umkm (01)", () => {
  const { routes } = mountEndpoint(registerPeta);
  assert.equal(routes.length, 1);
  const tanda = cakupan.tandaCakupan(routes[0].handler);
  assert.equal(tanda?.jenis, "terjaga");
  assert.deepEqual([...tanda.peran].sort(), ["kabkota", "provinsi", "umkm"]);
});
