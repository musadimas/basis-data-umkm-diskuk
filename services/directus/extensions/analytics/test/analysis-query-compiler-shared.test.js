import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("dimensi compiler shared adalah sumber tunggal router (03-1)", async () => {
  const shared = require("../../../analytics-shared/query-compiler.cjs");
  const router = await import("../src/endpoints/analysis/query-compiler.js");
  assert.ok(shared.DIMENSIONS, "shared harus mengekspor DIMENSIONS");
  assert.deepEqual(
    Object.keys(shared.DIMENSIONS),
    Object.keys(router.DIMENSIONS),
    "kunci dimensi shared dan router harus sama",
  );
  assert.deepEqual(
    router.DIMENSIONS,
    shared.DIMENSIONS,
    "nilai dimensi router harus sama persis dengan shared",
  );
  const sumber = await readFile(
    new URL("../src/endpoints/analysis/query-compiler.js", import.meta.url),
    "utf8",
  );
  assert.match(
    sumber,
    /analytics-shared\/query-compiler\.cjs/,
    "router wajib mengimpor dimensi dari shared",
  );
});
