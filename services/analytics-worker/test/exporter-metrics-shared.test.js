import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("METRICS worker diturunkan dari METRICS shared (03-2e)", async () => {
  const shared = require("../../directus/analytics-shared/query-compiler.cjs");
  const exporter = await import("../src/exporter.js");
  assert.ok(shared.METRICS, "shared harus mengekspor METRICS");
  assert.ok(exporter.METRICS, "worker harus mengekspor METRICS dari shared");
  assert.deepEqual(
    Object.keys(exporter.METRICS),
    Object.keys(shared.METRICS),
    "kunci metrik worker dan shared harus sama",
  );
  for (const key of Object.keys(shared.METRICS)) {
    const s = shared.METRICS[key];
    const w = exporter.METRICS[key];
    assert.equal(w.sql, s.sql, `sql ${key} harus identik`);
    assert.equal(w.label, s.label, `label ${key} harus identik`);
    assert.equal(w.aggregation, s.aggregation, `aggregation ${key} harus identik`);
    assert.equal(w.unit, s.unit, `unit ${key} harus identik`);
  }
  const sumber = await readFile(new URL("../src/exporter.js", import.meta.url), "utf8");
  assert.doesNotMatch(
    sumber,
    /COUNT\(\*\) FILTER \(WHERE a\.omzet_quality/,
    "worker tidak boleh lagi menyalin SQL metrik manual",
  );
});
