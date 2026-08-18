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
