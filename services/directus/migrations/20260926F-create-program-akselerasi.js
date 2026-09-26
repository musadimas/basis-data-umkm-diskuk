export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS program_batch (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kode TEXT NOT NULL UNIQUE,
        nama TEXT NOT NULL,
        tahap TEXT NOT NULL CHECK (tahap IN ('talent_lab','accelerator')),
        tanggal_mulai DATE NOT NULL,
        jumlah_minggu SMALLINT NOT NULL DEFAULT 12 CHECK (jumlah_minggu BETWEEN 1 AND 52),
        faktor_target NUMERIC(4,2) NOT NULL DEFAULT 1.20 CHECK (faktor_target > 0 AND faktor_target <= 5),
        dibuat_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await trx.raw(`
      ALTER TABLE talenta ADD COLUMN IF NOT EXISTS batch UUID REFERENCES program_batch(id) ON DELETE SET NULL;
    `);
    await trx.raw(`
      ALTER TABLE talenta ADD COLUMN IF NOT EXISTS pendamping UUID REFERENCES directus_users(id) ON DELETE SET NULL;
    `);
    await trx.raw(`
      ALTER TABLE talenta ADD COLUMN IF NOT EXISTS target_mingguan_override BIGINT CHECK (target_mingguan_override >= 0);
    `);
    await trx.raw(`
      ALTER TABLE talenta ADD COLUMN IF NOT EXISTS rekomendasi_pitching BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    await trx.raw(`
      ALTER TABLE talenta ADD COLUMN IF NOT EXISTS rekomendasi_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL;
    `);
    await trx.raw(`
      ALTER TABLE talenta ADD COLUMN IF NOT EXISTS rekomendasi_pada TIMESTAMPTZ;
    `);
    await trx.raw(`
      CREATE INDEX IF NOT EXISTS idx_talenta_pendamping ON talenta(pendamping) WHERE pendamping IS NOT NULL;
    `);
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS talenta_laporan_mingguan (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        talenta UUID NOT NULL REFERENCES talenta(id) ON DELETE CASCADE,
        minggu_ke SMALLINT NOT NULL CHECK (minggu_ke BETWEEN 1 AND 52),
        omzet BIGINT NOT NULL CHECK (omzet >= 0),
        jumlah_transaksi INTEGER NOT NULL CHECK (jumlah_transaksi >= 0),
        target BIGINT,
        bukti UUID REFERENCES directus_files(id) ON DELETE SET NULL,
        catatan_kendala TEXT,
        status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','disetujui','ditolak')),
        catatan_pendamping TEXT,
        diverifikasi_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        diverifikasi_pada TIMESTAMPTZ,
        client_uuid UUID NOT NULL UNIQUE,
        dikirim_pada TIMESTAMPTZ NOT NULL,
        provenance TEXT NOT NULL DEFAULT 'online' CHECK (provenance IN ('online','offline-replay')),
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (talenta, minggu_ke)
      );
    `);
    await trx.raw(`
      CREATE INDEX IF NOT EXISTS idx_laporan_status ON talenta_laporan_mingguan(status);
    `);
    await trx.raw(
      `INSERT INTO directus_collections (collection, icon, note, hidden, sort)
       VALUES ('program_batch', 'event', 'Batch Program Akselerasi', FALSE, 24)
       ON CONFLICT (collection) DO NOTHING;`,
    );
    await trx.raw(
      `INSERT INTO directus_collections (collection, icon, note, hidden, sort)
       VALUES ('talenta_laporan_mingguan', 'receipt_long', 'Laporan KPI mingguan', FALSE, 25)
       ON CONFLICT (collection) DO NOTHING;`,
    );
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`DELETE FROM directus_collections WHERE collection IN ('program_batch','talenta_laporan_mingguan');`);
    await trx.raw(`DROP TABLE IF EXISTS talenta_laporan_mingguan;`);
    await trx.raw(`DROP INDEX IF EXISTS idx_talenta_pendamping;`);
    await trx.raw(`ALTER TABLE talenta DROP COLUMN IF EXISTS rekomendasi_pada;`);
    await trx.raw(`ALTER TABLE talenta DROP COLUMN IF EXISTS rekomendasi_oleh;`);
    await trx.raw(`ALTER TABLE talenta DROP COLUMN IF EXISTS rekomendasi_pitching;`);
    await trx.raw(`ALTER TABLE talenta DROP COLUMN IF EXISTS target_mingguan_override;`);
    await trx.raw(`ALTER TABLE talenta DROP COLUMN IF EXISTS pendamping;`);
    await trx.raw(`ALTER TABLE talenta DROP COLUMN IF EXISTS batch;`);
    await trx.raw(`DROP TABLE IF EXISTS program_batch;`);
  });
};
