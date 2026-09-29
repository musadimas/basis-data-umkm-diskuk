import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("DIMENSIONS worker adalah shared yang sama (03-2a)", async () => {
  const shared = require("../../directus/analytics-shared/query-compiler.cjs");
  const exporter = await import("../src/exporter.js");
  assert.ok(shared.DIMENSIONS, "shared harus mengekspor DIMENSIONS");
  assert.ok(exporter.DIMENSIONS, "worker harus mengekspor DIMENSIONS dari shared");
  assert.deepEqual(
    Object.keys(exporter.DIMENSIONS),
    Object.keys(shared.DIMENSIONS),
    "kunci dimensi worker dan shared harus sama",
  );
  for (const key of Object.keys(shared.DIMENSIONS)) {
    assert.equal(
      exporter.DIMENSIONS[key].key,
      shared.DIMENSIONS[key].key,
      `key dimensi ${key} harus identik`,
    );
    assert.equal(
      exporter.DIMENSIONS[key].label,
      shared.DIMENSIONS[key].label,
      `label dimensi ${key} harus identik`,
    );
  }
  const sumber = await readFile(new URL("../src/exporter.js", import.meta.url), "utf8");
  assert.match(
    sumber,
    /analytics-shared\/query-compiler\.cjs/,
    "worker wajib mengimpor dimensi dari shared",
  );
});
