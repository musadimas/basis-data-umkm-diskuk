/**
 * Index trigram untuk pencarian Tabular (B13). Predikatnya adalah OR dari ILIKE pada
 * usaha_tabular.nama/produk_utama/kegiatan_utama plus subquery pelaku_usaha.nama_lengkap,
 * sehingga butuh satu index per kolom supaya planner dapat memakai BitmapOr.
 *
 * `idx_usaha_nama_trgm` (usaha.nama) dibuang karena tidak pernah dipakai predikat mana pun.
 * Runner migrasi Directus tidak membungkus migrasi dalam transaksi, jadi CONCURRENTLY aman
 * (preseden 20260819F). `down` hanya membuang index pencarian; query tetap benar tanpanya.
 */
export const up = async (knex) => {
  await knex.raw("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usaha_tabular_nama_trgm ON usaha_tabular USING gin (nama gin_trgm_ops)");
  await knex.raw("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usaha_tabular_produk_trgm ON usaha_tabular USING gin (produk_utama gin_trgm_ops)");
  await knex.raw("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usaha_tabular_kegiatan_trgm ON usaha_tabular USING gin (kegiatan_utama gin_trgm_ops)");
  await knex.raw("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pelaku_usaha_nama_trgm ON pelaku_usaha USING gin (nama_lengkap gin_trgm_ops)");
  await knex.raw("DROP INDEX IF EXISTS idx_usaha_nama_trgm");
};

export const down = async (knex) => {
  await knex.raw("DROP INDEX IF EXISTS idx_usaha_tabular_nama_trgm");
  await knex.raw("DROP INDEX IF EXISTS idx_usaha_tabular_produk_trgm");
  await knex.raw("DROP INDEX IF EXISTS idx_usaha_tabular_kegiatan_trgm");
  await knex.raw("DROP INDEX IF EXISTS idx_pelaku_usaha_nama_trgm");
};
