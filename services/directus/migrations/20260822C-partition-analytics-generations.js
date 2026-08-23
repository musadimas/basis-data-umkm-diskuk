const TABLE_SQL = `
  CREATE TABLE analitik_usaha_current (
    generation_id UUID NOT NULL REFERENCES analitik_generation(id) ON DELETE CASCADE, usaha_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active','archived')), nama TEXT NOT NULL, kegiatan_utama TEXT, produk_utama TEXT,
    status_hukum TEXT, skala TEXT, kota_id INTEGER, kota_kode TEXT, kota_nama TEXT NOT NULL DEFAULT 'Tidak diketahui',
    kecamatan_id INTEGER, kecamatan_nama TEXT NOT NULL DEFAULT 'Tidak diketahui', kelurahan_id INTEGER, kelurahan_nama TEXT NOT NULL DEFAULT 'Tidak diketahui',
    kode_kbli TEXT, kategori_kbli TEXT, sektor_kbli CHAR(1), omzet_tahunan BIGINT, total_aset BIGINT,
    omzet_quality TEXT NOT NULL DEFAULT 'missing' CHECK (omzet_quality IN ('reported','missing','needs_verification')),
    aset_quality TEXT NOT NULL DEFAULT 'missing' CHECK (aset_quality IN ('reported','missing','needs_verification')),
    masked_nik TEXT, masked_phone TEXT, owner_name TEXT, age_band TEXT,
    business_address TEXT, latitude NUMERIC(10,8), longitude NUMERIC(11,8), extra_fields JSONB NOT NULL DEFAULT '{}',
    source_hash CHAR(64), source_updated_at TIMESTAMPTZ, projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (generation_id, usaha_id)
  ) PARTITION BY LIST (generation_id)
`;

const INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_analitik_current_city ON analitik_usaha_current(kota_id);
  CREATE INDEX IF NOT EXISTS idx_analitik_current_sector ON analitik_usaha_current(sektor_kbli);
  CREATE INDEX IF NOT EXISTS idx_analitik_current_scale ON analitik_usaha_current(skala);
  CREATE INDEX IF NOT EXISTS idx_analitik_current_status ON analitik_usaha_current(status);
  CREATE INDEX IF NOT EXISTS idx_analitik_current_kecamatan ON analitik_usaha_current(kecamatan_id);
  CREATE INDEX IF NOT EXISTS idx_analitik_current_kelurahan ON analitik_usaha_current(kelurahan_id);
  CREATE INDEX IF NOT EXISTS idx_analitik_current_kbli ON analitik_usaha_current(kode_kbli);
  CREATE INDEX IF NOT EXISTS idx_analitik_current_status_hukum ON analitik_usaha_current(status_hukum);
  CREATE INDEX IF NOT EXISTS idx_analitik_current_nama ON analitik_usaha_current(nama,usaha_id);
  CREATE INDEX IF NOT EXISTS idx_analitik_current_kecamatan_name_group ON analitik_usaha_current(generation_id,status,kecamatan_nama) INCLUDE (skala,kode_kbli);
  CREATE INDEX IF NOT EXISTS idx_analitik_current_skala_geo ON analitik_usaha_current(generation_id,skala,status) INCLUDE (kota_id,kota_nama,kecamatan_id,kecamatan_nama)
`;

async function relationKind(knex) {
  const result = await knex.raw(`SELECT relkind FROM pg_class WHERE oid=to_regclass('public.analitik_usaha_current')`);
  return result.rows?.[0]?.relkind ?? result[0]?.[0]?.relkind ?? null;
}

async function hasProjectionRows(knex) {
  const result = await knex.raw(`SELECT EXISTS (SELECT 1 FROM analitik_usaha_current LIMIT 1) AS populated`);
  return Boolean(result.rows?.[0]?.populated ?? result[0]?.[0]?.populated);
}

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    const kind = await relationKind(trx);
    if (kind && kind !== 'p') {
      if (await hasProjectionRows(trx)) throw new Error('Partition migration requires a maintenance reset of derived analitik_usaha_current data');
      await trx.raw(`DROP TABLE analitik_usaha_current`);
    }
    if (kind !== 'p') await trx.raw(TABLE_SQL);
    await trx.raw(INDEX_SQL);

    // These pairs are byte-for-byte equivalent indexes. Keep the original
    // names used by the tabular service and remove the later duplicates.
    await trx.raw(`
      DROP INDEX IF EXISTS idx_usaha_tabular_filter_kecamatan;
      DROP INDEX IF EXISTS idx_usaha_tabular_filter_kelurahan;
      DROP INDEX IF EXISTS idx_usaha_tabular_geo_kbli
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    if (await hasProjectionRows(trx)) throw new Error('Refusing to remove analytics partitioning while projection data exists');
    await trx.raw(`DROP TABLE analitik_usaha_current`);
    await trx.raw(TABLE_SQL.replace(' PARTITION BY LIST (generation_id)', ''));
    await trx.raw(INDEX_SQL);
  });
};
