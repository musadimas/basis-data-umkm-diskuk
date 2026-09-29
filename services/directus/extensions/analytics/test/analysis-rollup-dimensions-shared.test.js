import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("ROLLUP_DIMENSIONS query-service diturunkan dari DIMENSIONS shared (03-2d)", async () => {
  const shared = require("../../../analytics-shared/query-compiler.cjs");
  const layanan = await import("../src/endpoints/analysis/query-service.js");
  assert.ok(
    layanan.ROLLUP_DIMENSIONS instanceof Set,
    "query-service harus mengekspor ROLLUP_DIMENSIONS sebagai Set",
  );
  assert.deepEqual(
    [...layanan.ROLLUP_DIMENSIONS].sort(),
    Object.keys(shared.DIMENSIONS).sort(),
    "isi Set rollup harus sama dengan kunci DIMENSIONS shared",
  );
  const sumber = await readFile(
    new URL("../src/endpoints/analysis/query-service.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    sumber,
    /new Set\(\[\s*"kota_id",/,
    "query-service tidak boleh lagi menyalin daftar dimensi manual",
  );
});
