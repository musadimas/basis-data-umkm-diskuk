/**
 * Snapshot publik per usaha untuk halaman tabular dan sumber agregasi infografis.
 *
 * Snapshot flat dari `usaha` (+ relasi wilayah & KBLI) untuk provinsi Jawa Barat,
 * diterbitkan oleh `scripts/refresh-dashboard-snapshots.sql` setelah setiap ingest SIDT,
 * sehingga halaman tabular dapat dipaginasi & difilter tanpa join berat
 * ke 5,4 juta baris tabel `usaha` pada setiap request.
 */
export const up = async (knex) => {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS usaha_tabular (
      id             UUID PRIMARY KEY REFERENCES usaha(id) ON DELETE CASCADE,
      nama           VARCHAR(255) NOT NULL,
      skala          TEXT,
      produk_utama   TEXT,
      kegiatan_utama TEXT,
      kode_kbli      VARCHAR(255),
      kategori_kbli  VARCHAR(255),
      kota_id        INTEGER NOT NULL,
      kecamatan_id   INTEGER NOT NULL,
      kelurahan_id   INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usaha_tabular_kota      ON usaha_tabular (kota_id);
    CREATE INDEX IF NOT EXISTS idx_usaha_tabular_kecamatan ON usaha_tabular (kecamatan_id);
    CREATE INDEX IF NOT EXISTS idx_usaha_tabular_kelurahan ON usaha_tabular (kelurahan_id);
    CREATE INDEX IF NOT EXISTS idx_usaha_tabular_skala     ON usaha_tabular (skala);
    CREATE INDEX IF NOT EXISTS idx_usaha_tabular_kbli      ON usaha_tabular (kode_kbli);
    CREATE INDEX IF NOT EXISTS idx_usaha_tabular_nama      ON usaha_tabular (nama);
  `);
};

export const down = async (knex) => {
  await knex.raw('DROP TABLE IF EXISTS usaha_tabular;');
};
