/**
 * Keep filtered analytics inside the synchronous query budget after the
 * projection is partitioned. PostgreSQL still evaluates the generation scope
 * on a selected child partition, so generation_id must remain available in
 * the covering indexes for an index-only scan.
 */
export const up = async (knex) => {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_analitik_current_kecamatan_name_group;
    CREATE INDEX idx_analitik_current_kecamatan_name_group
      ON analitik_usaha_current(generation_id,status,kecamatan_nama)
      INCLUDE (skala,kode_kbli);

    DROP INDEX IF EXISTS idx_analitik_current_skala_geo;
    CREATE INDEX idx_analitik_current_skala_geo
      ON analitik_usaha_current(generation_id,skala,status)
      INCLUDE (kota_id,kota_nama,kecamatan_id,kecamatan_nama)
  `);
};

export const down = async (knex) => {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_analitik_current_kecamatan_name_group;
    CREATE INDEX idx_analitik_current_kecamatan_name_group
      ON analitik_usaha_current(status,kecamatan_nama)
      INCLUDE (skala,kode_kbli);

    DROP INDEX IF EXISTS idx_analitik_current_skala_geo;
    CREATE INDEX idx_analitik_current_skala_geo
      ON analitik_usaha_current(skala,status)
      INCLUDE (kota_id,kota_nama,kecamatan_id,kecamatan_nama)
  `);
};
