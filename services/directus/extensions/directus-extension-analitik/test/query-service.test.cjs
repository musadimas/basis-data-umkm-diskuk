const assert = require("node:assert/strict");
const test = require("node:test");
const { queryAnalytics } = require("../src/query-service.js");

test("city distribution uses the published snapshot when no generation is active", async () => {
  const calls = [];
  const database = {
    async raw(sql) {
      calls.push(sql);
      if (sql.includes("FROM analitik_active_generation")) return { rows: [] };
      if (sql.includes("FROM infografis_snapshot")) return { rows: [{
        refreshed_at: "2026-08-18T00:00:00Z",
        population: 10,
        scales: { total: 10, mikro: 7, kecil: 2, menengah: 1 },
        regions: [{ id: "1", name: "KAB. BANDUNG", value: 7 }, { id: "2", name: "KOTA BANDUNG", value: 3 }],
      }] };
      if (sql.includes("FROM analitik_field")) return { rows: [
        { id: "metric", semantic_id: "jumlah_umkm", lifecycle_status: "active", semantic_role: "metric" },
        { id: "city", semantic_id: "kota_nama", lifecycle_status: "active", semantic_role: "dimension" },
      ] };
      if (sql.includes("FROM kota")) return { rows: [{ id: "1", kode: "32.04" }, { id: "2", kode: "32.73" }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const result = await queryAnalytics(database, { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "kota_nama", filters: [], limit: 20 });
  assert.equal(result.meta.status, "stale_last_good");
  assert.deepEqual(result.meta.warnings, ["Read-model analitik belum aktif; snapshot dashboard terpublikasi sedang digunakan."]);
  assert.equal(result.meta.population, 10);
  assert.deepEqual(result.data.groups.map(({ key, value }) => ({ key, value })), [
    { key: "KAB. BANDUNG", value: 7 },
    { key: "KOTA BANDUNG", value: 3 },
  ]);
  assert.equal(result.data.conservedTotal, true);
  assert.equal(calls.some((sql) => sql.includes("FROM usaha_tabular")), false);
});

test("active generation city distribution uses the existing city index path", async () => {
  const calls = [];
  const database = {
    async raw(sql) {
      calls.push(sql);
      if (sql.includes("FROM analitik_active_generation")) return { rows: [{
        id: "generation-1", status: "active", data_as_of: "2026-08-19T15:00:00Z", reconciled_at: "2026-08-19T20:00:00Z",
        row_count: 10, active_row_count: 9, archived_row_count: 1,
      }] };
      if (sql.includes("FROM analitik_field")) return { rows: [
        { id: "metric", semantic_id: "jumlah_umkm", lifecycle_status: "active", semantic_role: "metric" },
        { id: "city", semantic_id: "kota_nama", lifecycle_status: "active", semantic_role: "dimension" },
        { id: "scale", semantic_id: "skala_dilaporkan", lifecycle_status: "active", semantic_role: "dimension" },
      ] };
      if (sql.includes("WITH totals AS")) return sql.includes("SELECT skala")
        ? { rows: [{ dimension_value: "micro", value: 6 }, { dimension_value: "small", value: 2 }, { dimension_value: "unknown", value: 1 }] }
        : { rows: [{ dimension_value: 1, value: 6 }, { dimension_value: 2, value: 3 }] };
      if (sql.includes("FROM kota")) return { rows: [{ id: "1", kode: "32.04", nama: "KAB. BANDUNG" }, { id: "2", kode: "32.73", nama: "KOTA BANDUNG" }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const result = await queryAnalytics(database, { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "kota_nama", filters: [], limit: 20 });
  assert.equal(result.meta.status, "current");
  assert.equal(result.meta.population, 9);
  assert.deepEqual(result.data.groups.map(({ key, value }) => ({ key, value })), [
    { key: "KAB. BANDUNG", value: 6 },
    { key: "KOTA BANDUNG", value: 3 },
  ]);
  assert.equal(calls.some((sql) => sql.includes("WITH totals AS")), true);
  assert.equal(calls.some((sql) => sql.includes("ORDER BY value DESC, group_key ASC")), false);
  const scale = await queryAnalytics(database, { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "skala_dilaporkan", filters: [], limit: 20 });
  assert.deepEqual(scale.data.groups.map(({ key, value }) => ({ key, value })), [
    { key: "micro", value: 6 }, { key: "small", value: 2 }, { key: "unknown", value: 1 },
  ]);
});

test("scale distribution uses the published aggregate without scanning the tabular snapshot", async () => {
  const calls = [];
  const database = {
    async raw(sql) {
      calls.push(sql);
      if (sql.includes("FROM analitik_active_generation")) return { rows: [] };
      if (sql.includes("FROM infografis_snapshot")) return { rows: [{
        refreshed_at: "2026-08-18T00:00:00Z",
        population: 10,
        scales: { total: 10, mikro: 6, kecil: 3, menengah: 0 },
        regions: [],
      }] };
      if (sql.includes("FROM analitik_field")) return { rows: [
        { id: "metric", semantic_id: "jumlah_umkm", lifecycle_status: "active", semantic_role: "metric" },
        { id: "scale", semantic_id: "skala_dilaporkan", lifecycle_status: "active", semantic_role: "dimension" },
      ] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const result = await queryAnalytics(database, { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "skala_dilaporkan", filters: [], limit: 20 });
  assert.deepEqual(result.data.groups.map(({ key, value }) => ({ key, value })), [
    { key: "micro", value: 6 },
    { key: "small", value: 3 },
    { key: "unknown", value: 1 },
  ]);
  assert.equal(result.data.conservedTotal, true);
  assert.equal(calls.some((sql) => sql.includes("FROM usaha_tabular") || sql.includes("FROM kota")), false);
});
