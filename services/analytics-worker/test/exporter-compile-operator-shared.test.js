import assert from "node:assert/strict";
import test from "node:test";
import { operatorOf, processExport } from "../src/exporter.js";
import { PROVINSI, queryAgg, withRegistry } from "./fixtures.js";

const GEN = "11111111-1111-4111-8111-111111111111";
const KABKOTA = { role: "kabkota", kotaId: 7 };

function klien() {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("SELECT * FROM (SELECT")) return { rows: [] };
      if (sql.includes("FROM analitik_usaha_current a"))
        return { rows: [{ total: 0, matched: 0, missing: 0, needs_verification: 0, metric_total: 0 }] };
      if (sql.includes("SELECT data_as_of")) return { rows: [{ data_as_of: null }] };
      throw new Error(sql);
    },
  };
}
const filters = (n) =>
  Array.from({ length: n }, (_, i) => ({ fieldId: "sektor_kbli", operator: "eq", value: `s${i}` }));

test("operatorOf: diturunkan dari permissionScope dan fail-closed (03-3h)", () => {
  assert.deepEqual(operatorOf({ permissionScope: "kabkota:12" }), { role: "kabkota", kotaId: 12 });
  assert.deepEqual(operatorOf({ permissionScope: "provinsi" }), PROVINSI);
  assert.deepEqual(operatorOf({ permissionScope: "admin" }), PROVINSI);
  for (const request of [{}, { permissionScope: "aneh" }, null])
    assert.throws(() => operatorOf(request), (e) => e.code === "INVALID_ANALYSIS_CONFIG");
});

test("kabkota: filter kota klien dibuang, kota operator dipaksa (03-3h)", async () => {
  const c = klien();
  await queryAgg(
    c,
    {
      metric: "jumlah_umkm",
      groupBy: "kota_nama",
      filters: [{ fieldId: "kota_id", operator: "eq", value: "9" }],
    },
    GEN,
    { operator: KABKOTA },
  );
  assert.deepEqual(c.calls[0].params, [GEN, 7]);
});

test("kabkota + 8 filter non-kota lolos, 9 ditolak (bukan dipotong) (03-3h)", async () => {
  const c = klien();
  await queryAgg(c, { metric: "jumlah_umkm", groupBy: "kota_nama", filters: filters(8) }, GEN, {
    operator: KABKOTA,
  });
  assert.equal(c.calls[0].params.length, 10, "generation + 8 filter + kota paksa");
  await assert.rejects(
    () => queryAgg(klien(), { metric: "jumlah_umkm", groupBy: "kota_nama", filters: filters(9) }, GEN, { operator: KABKOTA }),
    (e) => e.code === "INVALID_ANALYSIS_CONFIG",
  );
});

test("tanpa operator ekspor ditolak sebelum query berjalan (03-3h)", async () => {
  const { queryAggregate } = await import("../src/exporter.js");
  await assert.rejects(
    () => queryAggregate(withRegistry(klien()), { metric: "jumlah_umkm", groupBy: "kota_nama" }, GEN),
    (e) => e.code === "INVALID_ANALYSIS_CONFIG",
  );
});

test("detail_csv memakai scope dari permissionScope (03-3h)", async () => {
  const c = klien();
  const store = { async put() {} };
  const baris = { async query(sql, params) { if (sql.includes("SELECT a.usaha_id AS id")) { c.calls.push({ sql, params }); return { rows: [] }; } if (sql.startsWith("UPDATE analitik_job")) return { rows: [] };
    return c.query(sql, params); } };
  await processExport(
    withRegistry(baris),
    {
      id: "j1",
      owner: "o",
      export_type: "detail_csv",
      request: { config: { filters: [] }, generationId: GEN, permissionScope: "kabkota:7" },
    },
    { store },
  );
  const q = c.calls.find((x) => x.sql.includes("SELECT a.usaha_id AS id"));
  assert.match(q.sql, /a\.kota_id = \$2::integer/);
  assert.deepEqual(q.params, [GEN, 7]);
});
