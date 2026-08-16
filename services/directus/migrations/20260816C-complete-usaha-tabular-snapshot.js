export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE usaha_tabular
      DROP CONSTRAINT IF EXISTS usaha_tabular_id_fkey,
      ADD COLUMN IF NOT EXISTS deskripsi_kbli TEXT,
      ADD COLUMN IF NOT EXISTS kota_nama TEXT,
      ADD COLUMN IF NOT EXISTS kecamatan_nama TEXT,
      ADD COLUMN IF NOT EXISTS kelurahan_nama TEXT,
      ADD COLUMN IF NOT EXISTS tenaga_kerja_laki_laki BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tenaga_kerja_perempuan BIGINT NOT NULL DEFAULT 0;
  `);
};

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE usaha_tabular
      DROP COLUMN IF EXISTS tenaga_kerja_perempuan,
      DROP COLUMN IF EXISTS tenaga_kerja_laki_laki,
      DROP COLUMN IF EXISTS kelurahan_nama,
      DROP COLUMN IF EXISTS kecamatan_nama,
      DROP COLUMN IF EXISTS kota_nama,
      DROP COLUMN IF EXISTS deskripsi_kbli;

    ALTER TABLE usaha_tabular
      ADD CONSTRAINT usaha_tabular_id_fkey
      FOREIGN KEY (id) REFERENCES usaha(id) ON DELETE CASCADE NOT VALID;
  `);
};
