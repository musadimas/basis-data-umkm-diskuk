import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const shared = require("../../../analytics-shared/query-compiler.cjs");

const registry = [
  { id: "metric", semantic_id: "jumlah_umkm", lifecycle_status: "active" },
  { id: "city", semantic_id: "kota_nama", lifecycle_status: "active" },
  { id: "city-id", semantic_id: "kota_id", lifecycle_status: "active" },
  { id: "scale", semantic_id: "skala_dilaporkan", lifecycle_status: "active" },
];

const KABKOTA = { role: "kabkota", kotaId: 7 };
const PROVINSI = { role: "provinsi", kotaId: null };

function delapanFilter() {
  return Array.from({ length: 8 }, (_, i) => ({
    fieldId: "scale",
    operator: "eq",
    value: `v${i}`,
  }));
}

test("kabkota + 8 filter non-kota lolos dengan scope kota paksa (03-3f)", () => {
  const plan = shared.compileAggregate(
    {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "city",
      filters: delapanFilter(),
    },
    { registry, operator: KABKOTA },
  );
  assert.match(plan.whereSql, /a\.kota_id = \?::integer/);
  assert.ok(plan.params.includes(7));
  assert.equal(
    plan.normalized.filters.length,
    9,
    "8 filter klien + 1 kota paksa tersimpan di normalized",
  );
  assert.equal(plan.scopeKey, "kabkota:7");
});

test("kabkota + 9 filter non-kota ditolak budget (03-3f)", () => {
  const filters = [...delapanFilter(), { fieldId: "scale", operator: "eq", value: "x" }];
  assert.throws(
    () =>
      shared.compileAggregate(
        { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "city", filters },
        { registry, operator: KABKOTA },
      ),
    (error) => error.status === 422 && error.code === "QUERY_COMPLEXITY",
  );
});

test("operator wajib, kabkota tanpa kota ditolak (03-3f)", () => {
  assert.throws(
    () =>
      shared.compileAggregate(
        { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "city", filters: [] },
        { registry, operator: undefined },
      ),
    (error) => error.code === "OPERATOR_REQUIRED",
  );
  assert.throws(
    () =>
      shared.compileAggregate(
        { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "city", filters: [] },
        { registry, operator: { role: "kabkota", kotaId: null } },
      ),
    (error) => error.status === 403 && error.code === "KOTA_NOT_ASSIGNED",
  );
});

test("filter kota klien dibuang sebelum compile (03-3f)", () => {
  const plan = shared.compileAggregate(
    {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "city",
      filters: [
        { fieldId: "kota_nama", operator: "eq", value: "OTHER" },
        { field: "kota_id", operator: "eq", value: "9" },
      ],
    },
    { registry, operator: KABKOTA },
  );
  assert.ok(!plan.params.includes("OTHER"));
  assert.ok(!plan.params.includes(9));
  assert.ok(plan.params.includes(7));
  assert.deepEqual(plan.normalized.filters, [
    { fieldId: "kota_id", operator: "eq", value: "7" },
  ]);
});

test("provinsi diteruskan apa adanya (03-3f)", () => {
  const filters = [{ fieldId: "city", operator: "eq", value: "Bogor" }];
  const plan = shared.compileAggregate(
    { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "city", filters },
    { registry, operator: PROVINSI },
  );
  assert.deepEqual(plan.normalized.filters, filters);
  assert.equal(plan.scopeKey, "provinsi");
});

test("kontrak KOTA_FIELDS shared (03-3f)", () => {
  assert.deepEqual([...shared.KOTA_FIELDS].sort(), ["kota_id", "kota_kode", "kota_nama"]);
});
