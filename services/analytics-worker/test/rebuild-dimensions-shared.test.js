import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("ROLLUP_DIMENSIONS diturunkan dari DIMENSIONS shared (03-2c)", async () => {
  const shared = require("../../directus/analytics-shared/query-compiler.cjs");
  const rebuild = await import("../src/rebuild.js");
  assert.ok(
    rebuild.ROLLUP_DIMENSIONS,
    "rebuild harus mengekspor ROLLUP_DIMENSIONS dari shared",
  );
  assert.deepEqual(
    rebuild.ROLLUP_DIMENSIONS.map(([nama]) => nama),
    Object.keys(shared.DIMENSIONS),
    "urutan dimensi rollup harus sama dengan shared",
  );
  for (const [nama, nilai, label] of rebuild.ROLLUP_DIMENSIONS) {
    assert.equal(nilai, shared.DIMENSIONS[nama].key, `key ${nama} harus identik`);
    assert.equal(label, shared.DIMENSIONS[nama].label, `label ${nama} harus identik`);
  }
  const sumber = await readFile(new URL("../src/rebuild.js", import.meta.url), "utf8");
  assert.match(
    sumber,
    /analytics-shared\/query-compiler\.cjs/,
    "rebuild wajib mengimpor dimensi dari shared",
  );
});
