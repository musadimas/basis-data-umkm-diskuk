/**
 * Salin koordinat (latitude/longitude) dari `usaha` ke snapshot `usaha_tabular`
 * sehingga halaman Peta Spasial dapat membaca titik real-time dari snapshot
 * (tanpa join berat ke tabel `usaha`), dengan filter yang sama seperti tabular.
 */
export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE usaha_tabular
      ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
  `);
};

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE usaha_tabular
      DROP COLUMN IF EXISTS longitude,
      DROP COLUMN IF EXISTS latitude;
  `);
};
