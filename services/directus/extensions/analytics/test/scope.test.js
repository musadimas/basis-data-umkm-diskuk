import assert from "node:assert/strict";
import test from "node:test";
import { ALL_ROLES, DATA_ROLES, OperatorError, resolveOperator, scopeTabularOptions, scopeTabularQuery, } from "../src/lib/utils/operator.js";
import { assertUsahaInScope, KOTA_FIELDS, permissionScopeOf, scopeAnalysisRequest, } from "../src/endpoints/analysis/scope.js";
import { AnalyticsApiError } from "../src/endpoints/analysis/errors.js";

const rows = (list) => ({ rows: list });

const OPERATOR_USER = "22222222-2222-4222-8222-222222222222";

const operatorRow = (overrides = {}) => ({
  id: OPERATOR_USER,
  app_role: "kabkota",
  email: "operator@example.test",
  first_name: "Ope",
  last_name: "Rator",
  avatar: null,
  kota: 7,
  kota_nama: "KABUPATEN SUBANG",
  usaha: null,
  usaha_nama: null,
  usaha_nib: null,
  ...overrides,
});

test("role contracts: only provinsi and kabkota may read wilayah data", () => {
  assert.deepEqual([...DATA_ROLES].sort(), ["kabkota", "provinsi"]);
  assert.deepEqual([...ALL_ROLES].sort(), [
    "kabkota",
    "pendamping",
    "provinsi",
    "umkm",
  ]);
});

test("kota filter field ids are pinned by the shared KOTA_FIELDS contract", () => {
  assert.deepEqual([...KOTA_FIELDS].sort(), [
    "kota_id",
    "kota_kode",
    "kota_nama",
  ]);
});

test("resolveOperator reads app_role and kota from directus_users in one query", async () => {
  const calls = [];
  const operator = await resolveOperator(
    {
      raw: async (sql, params) => {
        calls.push({ sql, params });
        return rows([operatorRow()]);
      },
    },
    { user: OPERATOR_USER },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FROM directus_users u/);
  assert.match(calls[0].sql, /u\.app_role/);
  assert.match(calls[0].sql, /u\.kota/);
  assert.deepEqual(calls[0].params, [OPERATOR_USER]);
  assert.equal(operator.role, "kabkota");
  assert.equal(operator.kotaId, 7);
  assert.equal(operator.kotaNama, "KABUPATEN SUBANG");
  assert.equal(operator.admin, false);
});

test("resolveOperator fails closed when app_role is missing or unknown", async () => {
  for (const app_role of [null, "", "superadmin", undefined]) {
    await assert.rejects(
      () =>
        resolveOperator({ raw: async () => rows([operatorRow({ app_role })]) }, {
          user: OPERATOR_USER,
        }),
      (error) =>
        error instanceof OperatorError &&
        error.statusCode === 403 &&
        error.code === "FORBIDDEN",
      `app_role ${String(app_role)} must not be treated as privileged`,
    );
  }
});

test("resolveOperator rejects anonymous, unknown and unassigned operators", async () => {
  await assert.rejects(
    () => resolveOperator({ raw: async () => rows([]) }, { user: null }),
    (error) => error.statusCode === 401 && error.code === "AUTHENTICATION_REQUIRED",
  );
  await assert.rejects(
    () => resolveOperator({ raw: async () => rows([]) }, { user: "not-a-uuid" }),
    (error) => error.statusCode === 401,
    "malformed user id must not reach the database",
  );
  await assert.rejects(
    () => resolveOperator({ raw: async () => rows([]) }, { user: OPERATOR_USER }),
    (error) => error.statusCode === 401,
    "a user without a directus_users row is not authenticated",
  );
  await assert.rejects(
    () =>
      resolveOperator(
        { raw: async () => rows([operatorRow({ app_role: "kabkota", kota: null })]) },
        { user: OPERATOR_USER },
      ),
    (error) =>
      error.statusCode === 403 && error.code === "KOTA_NOT_ASSIGNED",
  );
  // pendamping dan umkm bukan peran data; keduanya ditolak sebelum aturan penugasan
  // dievaluasi, sehingga tidak ada satu pun route analytics yang bisa mereka baca.
  for (const app_role of ["pendamping", "umkm"]) {
    await assert.rejects(
      () =>
        resolveOperator(
          { raw: async () => rows([operatorRow({ app_role })]) },
          { user: OPERATOR_USER },
        ),
      (error) =>
        error instanceof OperatorError &&
        error.statusCode === 403 &&
        error.code === "FORBIDDEN",
      `${app_role} must not read wilayah data`,
    );
  }
});

test("resolveOperator keeps Directus admins out of the wilayah resolver", async () => {
  let calls = 0;
  const operator = await resolveOperator(
    {
      raw: async () => {
        calls += 1;
        return rows([]);
      },
    },
    { user: OPERATOR_USER, admin: true },
  );

  assert.equal(calls, 0);
  assert.equal(operator.admin, true);
  assert.equal(operator.role, "provinsi");
  assert.equal(operator.kotaId, null);
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
      { fieldId: "kota_kode", operator: "eq", value: "32.13" },
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
  assert.equal(
    scoped.filters.length,
    2,
    "forcing the operator kota must not grow the client filter budget",
  );
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

test("permissionScopeOf partitions the aggregate cache per kota, admin and provinsi", () => {
  assert.equal(permissionScopeOf({ role: "kabkota", kotaId: 7 }), "kabkota:7");
  assert.equal(permissionScopeOf({ role: "kabkota", kotaId: 9 }), "kabkota:9");
  assert.equal(permissionScopeOf({ role: "provinsi" }), "provinsi");
  assert.equal(permissionScopeOf({ role: "provinsi", admin: true }), "admin");
  assert.equal(
    permissionScopeOf({ role: "kabkota", kotaId: null }),
    "provinsi",
    "unassigned kabkota must never claim a kota partition",
  );
});

test("assertUsahaInScope lets other roles through without a query", async () => {
  let calls = 0;
  await assertUsahaInScope(
    {
      raw: async () => {
        calls += 1;
      },
    },
    "11111111-1111-4111-8111-111111111111",
    { role: "provinsi" },
  );
  assert.equal(calls, 0);
});

test("assertUsahaInScope binds the operator kota and passes only in-scope profiles", async () => {
  const calls = [];
  await assertUsahaInScope(
    {
      raw: async (sql, params) => {
        calls.push({ sql, params });
        return rows([{ "?column?": 1 }]);
      },
    },
    "11111111-1111-4111-8111-111111111111",
    { role: "kabkota", kotaId: 7 },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FROM analitik_usaha_current/);
  assert.deepEqual(calls[0].params, [
    "11111111-1111-4111-8111-111111111111",
    7,
  ]);
});

test("assertUsahaInScope answers 404 for a profile outside the operator kota", async () => {
  await assert.rejects(
    () =>
      assertUsahaInScope(
        { raw: async () => rows([]) },
        "11111111-1111-4111-8111-111111111111",
        { role: "kabkota", kotaId: 7 },
      ),
    (error) =>
      error instanceof AnalyticsApiError &&
      error.statusCode === 404 &&
      error.code === "PROFILE_NOT_FOUND",
    "out-of-scope profiles must not leak their existence",
  );
  await assert.rejects(
    () =>
      assertUsahaInScope(
        { raw: async () => rows([]) },
        "11111111-1111-4111-8111-111111111111",
        { role: "kabkota", kotaId: null },
      ),
    (error) => error.statusCode === 403 && error.code === "KOTA_NOT_ASSIGNED",
  );
});

test("scopeTabularQuery replaces the client kota with the operator kota", () => {
  const clientQuery = { kota: "99", skala: "micro", page: "2" };
  const scoped = scopeTabularQuery(clientQuery, { role: "kabkota", kotaId: 7 });

  assert.deepEqual(scoped, { kota: "7", skala: "micro", page: "2" });
  assert.equal(clientQuery.kota, "99", "the client query must not be mutated");
  assert.throws(
    () => scopeTabularQuery({ kota: "99" }, { role: "kabkota", kotaId: null }),
    (error) =>
      error instanceof OperatorError &&
      error.statusCode === 403 &&
      error.code === "KOTA_NOT_ASSIGNED",
  );
});

test("scopeTabularQuery passes other roles through unchanged", () => {
  const clientQuery = { kota: "99", page: "1" };
  assert.deepEqual(scopeTabularQuery(clientQuery, { role: "provinsi" }), clientQuery);
  assert.deepEqual(scopeTabularQuery(clientQuery, { role: "provinsi", admin: true }), clientQuery);
  assert.deepEqual(scopeTabularQuery({}, undefined), {});
});

test("scopeTabularOptions narrows kota and kecamatan to the operator wilayah", () => {
  const options = {
    kota: [
      { id: 7, nama: "KABUPATEN SUBANG" },
      { id: 9, nama: "KOTA BANDUNG" },
    ],
    kecamatan: [
      { id: 11, nama: "BANJARWANGI", kotaId: 7 },
      { id: 12, nama: "CIBINONG", kotaId: 9 },
    ],
    kategori: ["PERDAGANGAN"],
    kbli: [{ kode: "47112", kategori: "PERDAGANGAN" }],
  };

  const scoped = scopeTabularOptions(options, { role: "kabkota", kotaId: 7 });
  assert.deepEqual(scoped.kota, [{ id: 7, nama: "KABUPATEN SUBANG" }]);
  assert.deepEqual(scoped.kecamatan, [
    { id: 11, nama: "BANJARWANGI", kotaId: 7 },
  ]);
  assert.deepEqual(scoped.kategori, ["PERDAGANGAN"]);
  assert.deepEqual(scopeTabularOptions(options, { role: "provinsi" }), options);
  assert.deepEqual(scopeTabularOptions(undefined, { role: "provinsi" }), {});
});
