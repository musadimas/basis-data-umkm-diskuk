export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS usaha_atribut_jabar (
        usaha UUID PRIMARY KEY REFERENCES usaha(id) ON DELETE CASCADE,
        npwp_usaha BOOLEAN,
        izin_edar BOOLEAN,
        sertifikat_halal BOOLEAN,
        pirt_bpom BOOLEAN,
        hki_merek BOOLEAN,
        sni BOOLEAN,
        rekening_terpisah BOOLEAN,
        sop_tertulis BOOLEAN,
        ecommerce BOOLEAN,
        medsos_bisnis BOOLEAN,
        qris BOOLEAN,
        pembukuan_digital BOOLEAN,
        akses_kur BOOLEAN,
        rantai_pasok_industri BOOLEAN,
        kontrak_offtaker BOOLEAN,
        diperbarui_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        terverifikasi_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        terverifikasi_pada TIMESTAMPTZ,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await trx.raw(
      `INSERT INTO directus_collections (collection, icon, note, hidden, sort)
       VALUES ('usaha_atribut_jabar', 'fact_check', '15 atribut regional Jawa Barat', FALSE, 20)
       ON CONFLICT (collection) DO NOTHING;`,
    );
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`DELETE FROM directus_collections WHERE collection = 'usaha_atribut_jabar';`);
    await trx.raw(`DROP TABLE IF EXISTS usaha_atribut_jabar;`);
  });
};
