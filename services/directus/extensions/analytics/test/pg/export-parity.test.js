import assert from "node:assert/strict";
import test from "node:test";
import { queryAnalytics, __resetBudgetForTests } from "../../src/endpoints/analysis/query-service.js";
import { __resetAggregateCacheForTests } from "../../src/endpoints/analysis/aggregate-cache.js";
import { queryAggregate } from "../../../../../analytics-worker/src/exporter.js";
import { createGenerationPartition } from "../../../../../analytics-worker/src/rebuild.js";
import { createPgPool, createTestDatabase, pgSkipReason } from "../../../../test-support/pg-harness.mjs";
import { uuid } from "../../../../test-support/fixtures.mjs";

const PROVINSI = { role: "provinsi", kotaId: null };
const KABKOTA = { role: "kabkota", kotaId: 7 };

async function seed(db, pool) {
  const generationId = uuid();
  await db("analitik_generation").insert({
    id: generationId,
    status: "active",
    row_count: 6,
    data_as_of: new Date("2026-09-01T00:00:00Z"),
    reconciled_at: new Date(),
    reconciliation_status: "passed",
  });
  await createGenerationPartition(pool, generationId);
  await db("analitik_active_generation").where({ id: 1 }).update({ active_generation_id: generationId });
  const baris = [
    { kota_id: 7, kota_nama: "Subang", sektor_kbli: "G", skala: "micro", status: "active", omzet_tahunan: 100, omzet_quality: "reported" },
    { kota_id: 7, kota_nama: "Subang", sektor_kbli: "G", skala: "small", status: "active", omzet_tahunan: 300, omzet_quality: "reported" },
    { kota_id: 7, kota_nama: "Subang", sektor_kbli: "C", skala: "micro", status: "active" },
    { kota_id: 9, kota_nama: "Bandung", sektor_kbli: "G", skala: "micro", status: "active", omzet_tahunan: 50, omzet_quality: "reported" },
    { kota_id: 9, kota_nama: "Bandung", sektor_kbli: "C", skala: "small", status: "active" },
    { kota_id: 9, kota_nama: "Bandung", sektor_kbli: "C", skala: "micro", status: "archived" },
  ];
  await db("analitik_usaha_current").insert(
    baris.map((row) => ({ generation_id: generationId, usaha_id: uuid(), nama: "Usaha", ...row })),
  );
  return generationId;
}

const CONFIGS = [
  // Filter eksplisit menjaga router di jalur scan fakta, bukan rollup per-generasi.
  { metric: "jumlah_umkm", groupBy: "sektor_kbli", filters: [{ fieldId: "status_usaha", operator: "neq", value: "archived" }] },
  { metric: "jumlah_umkm", groupBy: "kota_nama", filters: [{ fieldId: "sektor_kbli", operator: "eq", value: "G" }] },
  { metric: "jumlah_umkm", groupBy: "skala_dilaporkan", filters: [{ fieldId: "sektor_kbli", operator: "neq", value: "Z" }] },
  { metric: "jumlah_umkm", groupBy: "sektor_kbli", filters: [{ fieldId: "status_usaha", operator: "in", value: ["active", "archived"] }] },
];

test("canvas dan worker menghasilkan grup dan nilai yang sama per operator (03 paritas)", { skip: pgSkipReason() }, async (t) => {
  const { db, url, drop } = await createTestDatabase();
  const pool = createPgPool(url);
  // Tutup pool dulu, baru drop database; cache agregat memutus klien Redis-nya.
  t.after(async () => {
    __resetAggregateCacheForTests();
    await pool.end();
    await drop();
  });
  const generationId = await seed(db, pool);
  for (const operator of [PROVINSI, KABKOTA]) {
    for (const config of CONFIGS) {
      __resetBudgetForTests();
      __resetAggregateCacheForTests();
      const router = await queryAnalytics(db, { schemaVersion: 1, ...config }, { operator, permissionScope: `${operator.role}:${operator.kotaId}` });
      const worker = await queryAggregate(pool, { schemaVersion: 1, ...config }, generationId, { operator });
      const ringkas = (hasil) => hasil.data.groups.map((g) => [g.key, g.value]);
      assert.deepEqual(ringkas(worker), ringkas(router), `${operator.role} ${JSON.stringify(config)}`);
      assert.ok(router.data.groups.length > 0, "fixture harus menghasilkan grup");
      assert.equal(worker.data.total, router.data.total, `total ${operator.role} ${config.metric}`);
    }
  }
  // Kabkota hanya melihat Subang (kota 7) di kedua jalur: 3 usaha aktif.
  const subang = await queryAggregate(pool, { schemaVersion: 1, ...CONFIGS[1], filters: [] }, generationId, { operator: KABKOTA });
  assert.deepEqual(subang.data.groups.map((g) => g.key), ["Subang"]);
  assert.equal(subang.data.total, 3);
});
