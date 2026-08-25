/**
 * Keep filtered analytics queries inside the synchronous API budget.
 *
 * The analytics projection normalizes missing kecamatan labels before writing
 * the current model. Index the stored label directly so PostgreSQL can perform
 * an index-only scan. The two included columns cover the dashboard's scale
 * and KBLI groupings without making them part of the lookup key.
 */
export const up = async (knex) => {
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analitik_current_kecamatan_name_group
    ON analitik_usaha_current (
      generation_id,
      status,
      kecamatan_nama
    )
    INCLUDE (skala, kode_kbli)
  `);
};

export const down = async (knex) => {
  await knex.raw(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_analitik_current_kecamatan_name_group
  `);
};
