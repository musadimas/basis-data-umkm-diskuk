const assert = require("node:assert/strict");
const test = require("node:test");
const { queryAnalytics, __resetBudgetForTests } = require("../src/query-service.js");
const { aggregateCacheKey, getCachedAggregate, setCachedAggregate, __setRedisClientForTests, __resetAggregateCacheForTests } = require("../src/aggregate-cache.js");

const registry = [
  { id: "metric", semantic_id: "jumlah_umkm", lifecycle_status: "active", semantic_role: "metric" },
  { id: "city", semantic_id: "kota_nama", lifecycle_status: "active", semantic_role: "dimension" },
  { id: "scale", semantic_id: "skala_dilaporkan", lifecycle_status: "active", semantic_role: "dimension" },
];

test.afterEach(() => { __resetAggregateCacheForTests(); __resetBudgetForTests(); });

test("cache key canonicalizes filters and separates generation and permission scope", () => {
  const source = { kind: "generation", generationId: "generation-1", status: "current" };
  const plan = {
    metricKey: "jumlah_umkm", semantic: "kota_nama", breakdown: null, limit: 20, includeOthers: true,
    filterSemantics: ["kota_nama", "skala_dilaporkan"],
    normalized: { filters: [
      { fieldId: "city", operator: "eq", value: "Kabupaten Bogor" },
      { fieldId: "scale", operator: "in", value: ["small", "micro"] },
    ] },
  };
  const reordered = {
    ...plan,
    filterSemantics: ["skala_dilaporkan", "kota_nama"],
    normalized: { filters: [
      { fieldId: "scale", operator: "in", value: ["micro", "small"] },
      { fieldId: "city", operator: "eq", value: "Kabupaten Bogor" },
    ] },
  };
  const key = aggregateCacheKey({ source, plan, registry, permissionScope: "application" });
  assert.equal(key, aggregateCacheKey({ source, plan: reordered, registry, permissionScope: "application" }));
  assert.notEqual(key, aggregateCacheKey({ source: { ...source, generationId: "generation-2" }, plan, registry, permissionScope: "application" }));
  assert.notEqual(key, aggregateCacheKey({ source, plan, registry, permissionScope: "admin" }));
});

test("repeated aggregate query is served from Redis without a second PostgreSQL aggregate", async () => {
  const values = new Map();
  __setRedisClientForTests({
    get: async (key) => values.get(key) || null,
    set: async (key, value) => { values.set(key, value); },
  });
  let rollupQueries = 0;
  const database = {
    async raw(sql) {
      if (sql.includes("FROM analitik_active_generation")) return { rows: [{
        id: "generation-1", status: "active", data_as_of: "2026-08-24T00:00:00Z", reconciled_at: "2026-08-24T00:01:00Z",
        row_count: 10, active_row_count: 10, archived_row_count: 0,
      }] };
      if (sql.includes("FROM analitik_field")) return { rows: registry };
      if (sql.includes("FROM analitik_dim_aggregate")) {
        rollupQueries += 1;
        return { rows: [{ dimension_value: "Kabupaten Bogor", label: "Kabupaten Bogor", value: 10 }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const request = { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "kota_nama", filters: [], limit: 20 };
  const first = await queryAnalytics(database, request, { permissionScope: "application" });
  const second = await queryAnalytics(database, request, { permissionScope: "application" });
  assert.deepEqual(second, first);
  assert.equal(rollupQueries, 1);
});

test("Redis errors fail open", async () => {
  __setRedisClientForTests({ get: async () => { throw new Error("offline"); }, set: async () => { throw new Error("offline"); } });
  assert.equal(await getCachedAggregate("key"), null);
  const response = { data: { groups: [] } };
  assert.equal(await setCachedAggregate("key", response), response);
});
