import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LEGACY_TABULAR_COLUMNS,
  legacyTabularInsertSql,
  refreshLegacyTabularRow,
} from "../src/legacy-tabular.js";
import { projectRecord } from "../src/projector.js";

test("legacyTabularInsertSql memuat semua kolom dan klausa Jawa Barat", () => {
  const sql = legacyTabularInsertSql("");
  for (const col of LEGACY_TABULAR_COLUMNS) {
    assert.match(sql, new RegExp(`\\b${col}\\b`), `kolom ${col}`);
  }
  assert.match(sql, /INSERT INTO usaha_tabular \(/);
  assert.match(sql, /WHERE u\.status = 'active' AND \(p\.id IS NULL OR LOWER\(p\.nama\) = 'jawa barat'\)/);
});

test("refreshLegacyTabularRow merekam DELETE lalu INSERT per-record", async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
  await refreshLegacyTabularRow(client, "usaha-1");
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /DELETE FROM usaha_tabular WHERE id = \$1/);
  assert.deepEqual(calls[0].params, ["usaha-1"]);
  assert.match(calls[1].sql, /AND u\.id = \$1/);
  assert.deepEqual(calls[1].params, ["usaha-1"]);
});

test("projectRecord baris hilang menghapus analitik dan legacy tabular", async () => {
  const seen = [];
  const client = {
    query: async (sql) => {
      seen.push(sql);
      if (sql.includes("SELECT u.id,u.status")) return { rows: [] };
      if (sql.includes("active_generation_id")) return { rows: [{ active_generation_id: "gen-1" }] };
      return { rows: [] };
    },
  };
  const out = await projectRecord(client, { entity_id: "usaha-hilang" });
  assert.deepEqual(out, { deleted: true });
  assert.ok(seen.some((s) => s.includes("DELETE FROM analitik_usaha_current")), "hapus analitik");
  assert.ok(seen.some((s) => s.includes("DELETE FROM usaha_tabular")), "hapus legacy tabular");
});

test("rebuild.js memakai builder bersama, bukan literal INSERT", async () => {
  const source = await readFile(new URL("../src/rebuild.js", import.meta.url), "utf8");
  assert.match(source, /legacyTabularInsertSql\(""\)/);
  assert.doesNotMatch(source, /INSERT INTO usaha_tabular \(/);
});
