const assert = require("node:assert/strict");
const test = require("node:test");
const {
  KOTA_FIELDS,
  scopeAnalysisRequest,
  permissionScopeOf,
} = require("../src/scope.js");
const { AnalyticsApiError } = require("../src/errors.js");

test("kota filter field ids are pinned by the shared KOTA_FIELDS contract", () => {
  assert.deepEqual([...KOTA_FIELDS].sort(), [
    "kota_id",
    "kota_kode",
    "kota_nama",
  ]);
});

test("scopeAnalysisRequest drops client kota filters and forces the operator kota for kabkota", () => {
  const operator = { role: "kabkota", kotaId: 7 };
  const request = {
    schemaVersion: 1,
    metric: "jumlah_umkm",
    groupBy: "kota_nama",
    filters: [
      { fieldId: "kota_nama", operator: "eq", value: "X" },
      { field: "kota_id", operator: "eq", value: "9" },
      { fieldId: "skala_dilaporkan", operator: "in", value: ["micro"] },
    ],
  };

  const scoped = scopeAnalysisRequest(request, operator);

  assert.deepEqual(scoped.filters, [
    { fieldId: "skala_dilaporkan", operator: "in", value: ["micro"] },
    { fieldId: "kota_id", operator: "eq", value: "7" },
  ]);
  assert.equal(scoped.schemaVersion, 1);
  assert.equal(scoped.metric, "jumlah_umkm");
  assert.equal(scoped.groupBy, "kota_nama");
});

test("scopeAnalysisRequest leaves provinsi requests untouched", () => {
  const request = {
    schemaVersion: 1,
    metric: "jumlah_umkm",
    groupBy: "kota_id",
    filters: [{ field: "kota_nama", operator: "eq", value: "X" }],
  };

  assert.deepEqual(scopeAnalysisRequest(request, { role: "provinsi" }), request);
});

test("permissionScopeOf maps kabkota to its kota and other roles to provinsi", () => {
  assert.equal(permissionScopeOf({ role: "kabkota", kotaId: 7 }), "kabkota:7");
  assert.equal(permissionScopeOf({ role: "provinsi" }), "provinsi");
});

test("scopeAnalysisRequest refuses kabkota without an assigned kota", () => {
  assert.throws(
    () =>
      scopeAnalysisRequest(
        { schemaVersion: 1, filters: [] },
        { role: "kabkota", kotaId: null },
      ),
    (error) =>
      error instanceof AnalyticsApiError &&
      error.statusCode === 403 &&
      error.code === "KOTA_NOT_ASSIGNED",
  );
});
