import { compileQuery } from "../src/endpoints/analysis/query-compiler.js";
import assert from "node:assert/strict";
import test from "node:test";
const registry = [
  { id: "metric", semantic_id: "jumlah_umkm", lifecycle_status: "active" },
  {
    id: "revenue",
    semantic_id: "omzet_tahunan",
    lifecycle_status: "active",
    semantic_role: "metric",
  },
  {
    id: "assets",
    semantic_id: "total_aset",
    lifecycle_status: "active",
    semantic_role: "metric",
  },
  { id: "city", semantic_id: "kota_nama", lifecycle_status: "active" },
  { id: "city-id", semantic_id: "kota_id", lifecycle_status: "active" },
  { id: "district", semantic_id: "kecamatan_nama", lifecycle_status: "active" },
  {
    id: "district-id",
    semantic_id: "kecamatan_id",
    lifecycle_status: "active",
  },
  { id: "village-id", semantic_id: "kelurahan_id", lifecycle_status: "active" },
  { id: "scale", semantic_id: "skala_dilaporkan", lifecycle_status: "active" },
  { id: "q", semantic_id: "quality_kbli", lifecycle_status: "active" },
];
test("compiler uses distinct count, allowlisted identifiers, and bound values", () => {
  const plan = compileQuery(
    {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "city",
      filters: [{ fieldId: "scale", operator: "eq", value: "micro" }],
      limit: 20,
    },
    registry,
  );
  assert.match(plan.metric.sql, /COUNT\(\*\)/);
  assert.deepEqual(plan.params, ["micro"]);
  assert.doesNotMatch(plan.selectSql, /micro/);
});
test("compiler rejects SQL in field identifiers, operators, dimensions, and limits", () => {
  for (const request of [
    {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "kota_nama;DROP TABLE usaha",
    },
    {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "city",
      filters: [{ fieldId: "city", operator: "eq;DROP", value: "x" }],
    },
    {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "city",
      filters: Array.from({ length: 9 }, () => ({
        fieldId: "city",
        value: "x",
      })),
    },
  ])
    assert.throws(() => compileQuery(request, registry));
});
test("compiler allows at most two dimensions and explicit others", () => {
  const plan = compileQuery(
    {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "city",
      breakdown: "scale",
      includeOthers: true,
    },
    registry,
  );
  assert.equal(plan.includeOthers, true);
  assert.equal(plan.breakdown, "skala_dilaporkan");
});
test("compiler keeps kecamatan name equality sargable for its covering index", () => {
  const plan = compileQuery(
    {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "scale",
      filters: [
        { fieldId: "district", operator: "eq", value: "TAMBUN SELATAN" },
      ],
    },
    registry,
  );
  assert.match(plan.whereSql, /a\.kecamatan_nama = \?/);
  assert.doesNotMatch(plan.whereSql, /COALESCE\(a\.kecamatan_nama/);
});
test("compiler keeps geographic ID equality sargable for integer indexes", () => {
  for (const [field, column] of [
    ["city-id", "kota_id"],
    ["district-id", "kecamatan_id"],
    ["village-id", "kelurahan_id"],
  ]) {
    const plan = compileQuery(
      {
        schemaVersion: 1,
        metric: "jumlah_umkm",
        groupBy: "scale",
        filters: [{ fieldId: field, operator: "eq", value: "8357" }],
      },
      registry,
    );
    assert.match(plan.whereSql, new RegExp(`a\\.${column} = \\?::integer`));
    assert.doesNotMatch(plan.whereSql, new RegExp(`COALESCE\\(a\\.${column}`));
    assert.deepEqual(plan.params, [8357]);
  }
});
test("compiler maps unknown and mixed geographic IDs without casting indexed columns", () => {
  const unknown = compileQuery(
    {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "scale",
      filters: [{ fieldId: "village-id", operator: "eq", value: "unknown" }],
    },
    registry,
  );
  assert.match(unknown.whereSql, /a\.kelurahan_id IS NULL/);
  assert.deepEqual(unknown.params, []);
  const mixed = compileQuery(
    {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "scale",
      filters: [
        { fieldId: "village-id", operator: "in", value: ["8357", "unknown"] },
      ],
    },
    registry,
  );
  assert.match(
    mixed.whereSql,
    /a\.kelurahan_id = ANY\(\?::integer\[\]\) OR a\.kelurahan_id IS NULL/,
  );
  assert.deepEqual(mixed.params, [[8357]]);
});
test("compiler rejects text operators and malformed values for geographic IDs", () => {
  for (const filter of [
    { fieldId: "village-id", operator: "contains", value: "8357" },
    { fieldId: "village-id", operator: "eq", value: "8357 OR 1=1" },
    { fieldId: "village-id", operator: "eq", value: "2147483648" },
  ])
    assert.throws(() =>
      compileQuery(
        {
          schemaVersion: 1,
          metric: "jumlah_umkm",
          groupBy: "scale",
          filters: [filter],
        },
        registry,
      ),
    );
});
test("financial metrics sum only reported values and expose explicit null coverage", () => {
  const plan = compileQuery(
    {
      schemaVersion: 1,
      metric: { fieldId: "omzet_tahunan", aggregation: "sum" },
      groupBy: "city",
      filters: [],
    },
    registry,
  );
  assert.match(
    plan.metric.sql,
    /SUM\(a\.omzet_tahunan\).*omzet_quality='reported'/,
  );
  assert.match(plan.metric.missingSql, /omzet_quality='missing'/);
  assert.equal(plan.metric.unit, "IDR");
  assert.throws(() =>
    compileQuery(
      {
        schemaVersion: 1,
        metric: { fieldId: "total_aset", aggregation: "count_distinct" },
        groupBy: "city",
        filters: [],
      },
      registry,
    ),
  );
});
