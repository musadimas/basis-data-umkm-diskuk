/**
 * Y05: arm pemilik pencarian Tabular (`usaha JOIN pelaku_usaha ... nama_lengkap ILIKE`) tanpa
 * index pada `usaha.pelaku_usaha` memaksa Parallel Seq Scan atas seluruh `usaha` di setiap
 * pencarian (300k baris: 105 ms -> 7 ms setelah index; lihat
 * docs/dashboard-operasional-e2e-plan/stage_1/artifacts/Y05/explain-*.out).
 * Runner migrasi Directus tidak membungkus migrasi dalam transaksi, jadi CONCURRENTLY aman
 * (preseden 20260928B).
 */
export const up = async (knex) => {
  await knex.raw("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usaha_pelaku_usaha ON usaha (pelaku_usaha)");
};

export const down = async (knex) => {
  await knex.raw("DROP INDEX IF EXISTS idx_usaha_pelaku_usaha");
};
