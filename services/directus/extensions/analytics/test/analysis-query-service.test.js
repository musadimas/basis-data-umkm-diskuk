import { queryAnalytics, __resetBudgetForTests, } from "../src/endpoints/analysis/query-service.js";
import assert from "node:assert/strict";
import test from "node:test";
// Runtime TTL caches (source/registry) must not leak between tests.
test.beforeEach(() => __resetBudgetForTests());

test("city distribution uses the published snapshot when no generation is active", async () => {
  const calls = [];
  const database = {
    async raw(sql) {
      calls.push(sql);
      if (sql.includes("FROM analitik_active_generation")) return { rows: [] };
      if (sql.includes("FROM infografis_snapshot"))
        return {
          rows: [
            {
              refreshed_at: "2026-08-18T00:00:00Z",
              population: 10,
              scales: { total: 10, mikro: 7, kecil: 2, menengah: 1 },
              regions: [
                { id: "1", name: "KAB. BANDUNG", value: 7 },
                { id: "2", name: "KOTA BANDUNG", value: 3 },
              ],
            },
          ],
        };
      if (sql.includes("FROM analitik_field"))
        return {
          rows: [
            {
              id: "metric",
              semantic_id: "jumlah_umkm",
              lifecycle_status: "active",
              semantic_role: "metric",
            },
            {
              id: "city",
              semantic_id: "kota_nama",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
          ],
        };
      if (sql.includes("FROM kota"))
        return {
          rows: [
            { id: "1", kode: "32.04" },
            { id: "2", kode: "32.73" },
          ],
        };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const result = await queryAnalytics(database, {
    schemaVersion: 1,
    metric: "jumlah_umkm",
    groupBy: "kota_nama",
    filters: [],
    limit: 20,
  }, { operator: { role: "provinsi" } });
  assert.equal(result.meta.status, "stale_last_good");
  assert.deepEqual(result.meta.warnings, [
    "Read-model analitik belum aktif; snapshot dashboard terpublikasi sedang digunakan.",
  ]);
  assert.equal(result.meta.population, 10);
  assert.deepEqual(
    result.data.groups.map(({ key, value }) => ({ key, value })),
    [
      { key: "KAB. BANDUNG", value: 7 },
      { key: "KOTA BANDUNG", value: 3 },
    ],
  );
  assert.equal(result.data.conservedTotal, true);
  assert.equal(
    calls.some((sql) => sql.includes("FROM usaha_tabular")),
    false,
  );
});

test("active generation city distribution uses the existing city index path", async () => {
  const calls = [];
  const database = {
    async raw(sql) {
      calls.push(sql);
      if (sql.includes("FROM analitik_active_generation"))
        return {
          rows: [
            {
              id: "generation-1",
              status: "active",
              data_as_of: "2026-08-19T15:00:00Z",
              reconciled_at: "2026-08-19T20:00:00Z",
              row_count: 10,
              active_row_count: 9,
              archived_row_count: 1,
            },
          ],
        };
      // Empty rollup → must fall through to the live aggregate path below.
      if (sql.includes("FROM analitik_dim_aggregate")) return { rows: [] };
      if (sql.includes("FROM analitik_field"))
        return {
          rows: [
            {
              id: "metric",
              semantic_id: "jumlah_umkm",
              lifecycle_status: "active",
              semantic_role: "metric",
            },
            {
              id: "city",
              semantic_id: "kota_nama",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
            {
              id: "scale",
              semantic_id: "skala_dilaporkan",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
          ],
        };
      if (sql.includes("WITH totals AS"))
        return sql.includes("SELECT skala")
          ? {
              rows: [
                { dimension_value: "micro", value: 6 },
                { dimension_value: "small", value: 2 },
                { dimension_value: "unknown", value: 1 },
              ],
            }
          : {
              rows: [
                { dimension_value: 1, value: 6 },
                { dimension_value: 2, value: 3 },
              ],
            };
      if (sql.includes("FROM kota"))
        return {
          rows: [
            { id: "1", kode: "32.04", nama: "KAB. BANDUNG" },
            { id: "2", kode: "32.73", nama: "KOTA BANDUNG" },
          ],
        };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const result = await queryAnalytics(database, {
    schemaVersion: 1,
    metric: "jumlah_umkm",
    groupBy: "kota_nama",
    filters: [],
    limit: 20,
  }, { operator: { role: "provinsi" } });
  assert.equal(result.meta.status, "current");
  assert.equal(result.meta.population, 9);
  assert.deepEqual(
    result.data.groups.map(({ key, value }) => ({ key, value })),
    [
      { key: "KAB. BANDUNG", value: 6 },
      { key: "KOTA BANDUNG", value: 3 },
    ],
  );
  assert.equal(
    calls.some((sql) => sql.includes("WITH totals AS")),
    true,
  );
  assert.equal(
    calls.some((sql) => sql.includes("ORDER BY value DESC, group_key ASC")),
    false,
  );
  const scale = await queryAnalytics(database, {
    schemaVersion: 1,
    metric: "jumlah_umkm",
    groupBy: "skala_dilaporkan",
    filters: [],
    limit: 20,
  }, { operator: { role: "provinsi" } });
  assert.deepEqual(
    scale.data.groups.map(({ key, value }) => ({ key, value })),
    [
      { key: "micro", value: 6 },
      { key: "small", value: 2 },
      { key: "unknown", value: 1 },
    ],
  );
});

test("scale distribution uses the published aggregate without scanning the tabular snapshot", async () => {
  const calls = [];
  const database = {
    async raw(sql) {
      calls.push(sql);
      if (sql.includes("FROM analitik_active_generation")) return { rows: [] };
      if (sql.includes("FROM infografis_snapshot"))
        return {
          rows: [
            {
              refreshed_at: "2026-08-18T00:00:00Z",
              population: 10,
              scales: { total: 10, mikro: 6, kecil: 3, menengah: 0 },
              regions: [],
            },
          ],
        };
      if (sql.includes("FROM analitik_field"))
        return {
          rows: [
            {
              id: "metric",
              semantic_id: "jumlah_umkm",
              lifecycle_status: "active",
              semantic_role: "metric",
            },
            {
              id: "scale",
              semantic_id: "skala_dilaporkan",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
          ],
        };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const result = await queryAnalytics(database, {
    schemaVersion: 1,
    metric: "jumlah_umkm",
    groupBy: "skala_dilaporkan",
    filters: [],
    limit: 20,
  }, { operator: { role: "provinsi" } });
  assert.deepEqual(
    result.data.groups.map(({ key, value }) => ({ key, value })),
    [
      { key: "micro", value: 6 },
      { key: "small", value: 3 },
      { key: "unknown", value: 1 },
    ],
  );
  assert.equal(result.data.conservedTotal, true);
  assert.equal(
    calls.some(
      (sql) => sql.includes("FROM usaha_tabular") || sql.includes("FROM kota"),
    ),
    false,
  );
});

test("unfiltered sector distribution is served from the per-generation rollup without a fact scan", async () => {
  const calls = [];
  const database = {
    async raw(sql) {
      calls.push(sql);
      if (sql.includes("FROM analitik_active_generation"))
        return {
          rows: [
            {
              id: "generation-1",
              status: "active",
              data_as_of: "2026-08-19T15:00:00Z",
              reconciled_at: "2026-08-19T20:00:00Z",
              row_count: 10,
              active_row_count: 9,
              archived_row_count: 1,
            },
          ],
        };
      if (sql.includes("FROM analitik_field"))
        return {
          rows: [
            {
              id: "metric",
              semantic_id: "jumlah_umkm",
              lifecycle_status: "active",
              semantic_role: "metric",
            },
            {
              id: "sector",
              semantic_id: "sektor_kbli",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
          ],
        };
      if (sql.includes("FROM analitik_dim_aggregate"))
        return {
          rows: [
            { dimension_value: "G", label: "G", value: 6 },
            { dimension_value: "C", label: "C", value: 3 },
          ],
        };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const result = await queryAnalytics(database, {
    schemaVersion: 1,
    metric: "jumlah_umkm",
    groupBy: "sektor_kbli",
    filters: [],
    limit: 20,
  }, { operator: { role: "provinsi" } });
  assert.equal(result.meta.status, "current");
  assert.equal(result.meta.population, 9);
  assert.equal(result.meta.matched, 9);
  assert.deepEqual(
    result.data.groups.map(({ key, value }) => ({ key, value })),
    [
      { key: "G", value: 6 },
      { key: "C", value: 3 },
    ],
  );
  // Fast path must short-circuit before any fact-table aggregation.
  assert.equal(
    calls.some(
      (sql) =>
        sql.includes("WITH totals AS") || sql.includes("SUM(COUNT(*)) OVER ()"),
    ),
    false,
  );
});

test("scale-filtered city distribution uses the conditional rollup without a fact scan", async () => {
  const calls = [];
  const database = {
    async raw(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("FROM analitik_active_generation"))
        return {
          rows: [
            {
              id: "generation-1",
              status: "active",
              data_as_of: "2026-08-19T15:00:00Z",
              reconciled_at: "2026-08-19T20:00:00Z",
              row_count: 10,
              active_row_count: 10,
              archived_row_count: 0,
            },
          ],
        };
      if (sql.includes("FROM analitik_field"))
        return {
          rows: [
            {
              id: "metric",
              semantic_id: "jumlah_umkm",
              lifecycle_status: "active",
              semantic_role: "metric",
            },
            {
              id: "city",
              semantic_id: "kota_nama",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
            {
              id: "scale",
              semantic_id: "skala_dilaporkan",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
          ],
        };
      if (sql.includes("dimension=ANY"))
        return {
          rows: [
            {
              dimension_value: "KAB. BANDUNG",
              label: "KAB. BANDUNG",
              value: 6,
            },
            {
              dimension_value: "KOTA BANDUNG",
              label: "KOTA BANDUNG",
              value: 2,
            },
          ],
        };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const result = await queryAnalytics(database, {
    schemaVersion: 1,
    metric: "jumlah_umkm",
    groupBy: "city",
    filters: [{ fieldId: "scale", operator: "eq", value: "micro" }],
    limit: 20,
  }, { operator: { role: "provinsi" } });
  assert.equal(result.meta.population, 10);
  assert.equal(result.meta.matched, 8);
  assert.deepEqual(
    result.data.groups.map(({ key, value }) => ({ key, value })),
    [
      { key: "KAB. BANDUNG", value: 6 },
      { key: "KOTA BANDUNG", value: 2 },
    ],
  );
  assert.deepEqual(
    calls.find(({ sql }) => sql.includes("dimension=ANY")).params,
    ["generation-1", ["scale:micro:kota_nama"]],
  );
  assert.equal(
    calls.some(({ sql }) => sql.includes("SUM(COUNT(*)) OVER ()")),
    false,
  );
});

test("runtime caches serve repeated requests without re-resolving source and reset for tests", async () => {
  let generationLookups = 0;
  const database = {
    async raw(sql) {
      if (sql.includes("FROM analitik_active_generation")) {
        generationLookups += 1;
        return {
          rows: [
            {
              id: "generation-1",
              status: "active",
              data_as_of: "2026-08-19T15:00:00Z",
              reconciled_at: "2026-08-19T20:00:00Z",
              row_count: 10,
              active_row_count: 9,
              archived_row_count: 1,
            },
          ],
        };
      }
      if (sql.includes("FROM analitik_field"))
        return {
          rows: [
            {
              id: "metric",
              semantic_id: "jumlah_umkm",
              lifecycle_status: "active",
              semantic_role: "metric",
            },
            {
              id: "city",
              semantic_id: "kota_nama",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
          ],
        };
      if (sql.includes("FROM analitik_dim_aggregate")) return { rows: [] };
      if (sql.includes("WITH totals AS"))
        return {
          rows: [
            { dimension_value: 1, value: 6 },
            { dimension_value: 2, value: 3 },
          ],
        };
      if (sql.includes("FROM kota"))
        return {
          rows: [
            { id: "1", kode: "32.04", nama: "KAB. BANDUNG" },
            { id: "2", kode: "32.73", nama: "KOTA BANDUNG" },
          ],
        };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const request = {
    schemaVersion: 1,
    metric: "jumlah_umkm",
    groupBy: "kota_nama",
    filters: [],
    limit: 20,
  };
  await queryAnalytics(database, request, { operator: { role: "provinsi" } });
  await queryAnalytics(database, request, { operator: { role: "provinsi" } });
  assert.equal(generationLookups, 1); // second request served from the 5s source cache
  __resetBudgetForTests();
  await queryAnalytics(database, request, { operator: { role: "provinsi" } });
  assert.equal(generationLookups, 2); // reset forces a fresh resolution
});

test("financial rollup excludes nulls and reports coverage separately from the metric total", async () => {
  const calls = [];
  const database = {
    async raw(sql) {
      calls.push(sql);
      if (sql.includes("FROM analitik_active_generation"))
        return {
          rows: [
            {
              id: "generation-1",
              status: "active",
              data_as_of: "2026-08-24T00:00:00Z",
              reconciled_at: "2026-08-24T01:00:00Z",
              row_count: 6,
              active_row_count: 6,
              archived_row_count: 0,
            },
          ],
        };
      if (sql.includes("FROM analitik_field"))
        return {
          rows: [
            {
              id: "revenue",
              semantic_id: "omzet_tahunan",
              lifecycle_status: "active",
              semantic_role: "metric",
            },
            {
              id: "city",
              semantic_id: "kota_nama",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
          ],
        };
      if (sql.includes("FROM analitik_dim_aggregate"))
        return {
          rows: [
            {
              dimension_value: "Kabupaten Bogor",
              label: "Kabupaten Bogor",
              value: "40000000000",
              matched: 2,
              missing: 1,
              needs_verification: 0,
            },
            {
              dimension_value: "Kota Depok",
              label: "Kota Depok",
              value: "10000000000",
              matched: 1,
              missing: 1,
              needs_verification: 1,
            },
          ],
        };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const result = await queryAnalytics(database, {
    schemaVersion: 1,
    metric: "omzet_tahunan",
    groupBy: "kota_nama",
    filters: [],
    limit: 20,
  }, { operator: { role: "provinsi" } });
  assert.equal(result.data.total, 50000000000);
  assert.equal(result.data.metric.unit, "IDR");
  assert.equal(result.meta.matched, 3);
  assert.deepEqual(result.meta.coverage, {
    matched: 3,
    total: 6,
    unknown: 0,
    missing: 2,
    needsVerification: 1,
  });
  assert.deepEqual(
    result.data.groups.map(({ value, share }) => ({ value, share })),
    [
      { value: 40000000000, share: 80 },
      { value: 10000000000, share: 20 },
    ],
  );
  assert.equal(result.data.conservedTotal, true);
  assert.equal(
    calls.some(
      (sql) => sql.includes("omzet_value") && sql.includes("omzet_missing"),
    ),
    true,
  );
});
