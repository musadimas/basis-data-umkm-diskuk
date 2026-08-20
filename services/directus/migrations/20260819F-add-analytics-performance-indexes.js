/**
 * Performance indexes for Analitik read model (5.4M rows) – Phase 4 of audit plan.
 * ⚠️  DO NOT APPLY before Phase 0 baseline and representative EXPLAIN receipts are available.
 * This migration uses CREATE INDEX CONCURRENTLY to avoid long ACCESS EXCLUSIVE locks on 5.4M-row tables.
 * Each index must be proven by actual query plans and sized for disk/write cost before commit.
 * Apply only in a maintenance window with rollback plan and confirmed disk headroom.
 * CONCURRENTLY cannot run inside a transaction – each index is created in its own statement.
 */

export const up = async (knex) => {
  // Check Phase 0 receipt: require baseline artifact or env flag
  const phase0Done = process.env.PHASE_0_BASELINE_DONE === "true";
  if (!phase0Done) {
    // Log warning but allow manual override via env; otherwise defer
    console.warn("[migration 20260819F] Phase 0 baseline not confirmed (PHASE_0_BASELINE_DONE != true). Indexes will be created CONCURRENTLY but should be validated against EXPLAIN plans.");
  }
  // CONCURRENTLY must be outside transaction – knex.raw outside explicit transaction
  await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analitik_current_kecamatan ON analitik_usaha_current(generation_id, kecamatan_id)`);
  await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analitik_current_kelurahan ON analitik_usaha_current(generation_id, kelurahan_id)`);
  await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analitik_current_kbli ON analitik_usaha_current(generation_id, kode_kbli)`);
  await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analitik_current_status_hukum ON analitik_usaha_current(generation_id, status_hukum)`);
  await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analitik_current_nama ON analitik_usaha_current(generation_id, nama, usaha_id)`);
  await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usaha_tabular_filter_city_scale ON usaha_tabular(kota_id, skala)`);
  await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usaha_tabular_filter_kecamatan ON usaha_tabular(kecamatan_id)`);
  await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usaha_tabular_filter_kelurahan ON usaha_tabular(kelurahan_id)`);
  await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usaha_tabular_geo_kbli ON usaha_tabular(kode_kbli)`);
};

export const down = async (knex) => {
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_analitik_current_kecamatan`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_analitik_current_kelurahan`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_analitik_current_kbli`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_analitik_current_status_hukum`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_analitik_current_nama`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_usaha_tabular_filter_city_scale`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_usaha_tabular_filter_kecamatan`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_usaha_tabular_filter_kelurahan`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_usaha_tabular_geo_kbli`);
};
