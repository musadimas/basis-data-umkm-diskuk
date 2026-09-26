const FOLDER_OPERASIONAL = "fa57be17-82ba-480c-b77c-536d42a124d4";

const FILE_POLICIES = [
  "9325db4b-9518-41db-b122-8c667f2ce510",
  "542bb438-226b-49b6-8792-bcfc614560a5",
  "81086586-a5a3-4d9e-a650-eca9bac81c23",
  "98524352-468a-45bd-b638-d4075243d27d",
];

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS talenta_berita_acara (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nomor TEXT NOT NULL UNIQUE,
        tanggal DATE NOT NULL,
        catatan TEXT,
        diterbitkan_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS talenta (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usaha UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE,
        kota INTEGER REFERENCES kota(id) ON DELETE SET NULL,
        status TEXT NOT NULL CHECK (status IN ('diajukan','dinilai','scouting','talent_lab','accelerator','champion','ditolak')),
        kapasitas_produksi_bulanan NUMERIC(12,2) NOT NULL CHECK (kapasitas_produksi_bulanan >= 0),
        satuan_kapasitas TEXT NOT NULL CHECK (satuan_kapasitas IN ('unit','kg')),
        kesiapan_halal BOOLEAN NOT NULL DEFAULT FALSE,
        kesiapan_pirt_bpom BOOLEAN NOT NULL DEFAULT FALSE,
        kesiapan_hki BOOLEAN NOT NULL DEFAULT FALSE,
        adopsi_qris BOOLEAN NOT NULL DEFAULT FALSE,
        pencatatan_keuangan_digital BOOLEAN NOT NULL DEFAULT FALSE,
        surat_komitmen UUID REFERENCES directus_files(id) ON DELETE SET NULL,
        skor_finansial NUMERIC(5,2) NOT NULL,
        skor_pasar NUMERIC(5,2) NOT NULL,
        skor_legalitas NUMERIC(5,2) NOT NULL,
        skor_sdm NUMERIC(5,2) NOT NULL,
        skor_total NUMERIC(5,2) NOT NULL,
        rubrik_versi SMALLINT NOT NULL DEFAULT 1,
        rekomendasi TEXT NOT NULL,
        diajukan_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        dinominasikan_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        dinominasikan_pada TIMESTAMPTZ,
        alasan_penolakan TEXT,
        ditolak_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        ditolak_pada TIMESTAMPTZ,
        berita_acara UUID REFERENCES talenta_berita_acara(id) ON DELETE SET NULL,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await trx.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_talenta_usaha_aktif
        ON talenta(usaha) WHERE status <> 'ditolak';
    `);
    await trx.raw(`
      CREATE INDEX IF NOT EXISTS idx_talenta_status_kota
        ON talenta(status, kota);
    `);
    await trx.raw(
      `INSERT INTO directus_collections (collection, icon, note, hidden, sort)
       VALUES ('talenta', 'workspace_premium', 'Pipeline Talent Scouting UMKM', FALSE, 22)
       ON CONFLICT (collection) DO NOTHING;`,
    );
    await trx.raw(
      `INSERT INTO directus_collections (collection, icon, note, hidden, sort)
       VALUES ('talenta_berita_acara', 'gavel', 'Berita Acara Talent Scouting', FALSE, 23)
       ON CONFLICT (collection) DO NOTHING;`,
    );
    await trx.raw(
      `INSERT INTO directus_folders (id, name, parent)
       VALUES (?, 'operasional', NULL)
       ON CONFLICT (id) DO NOTHING;`,
      [FOLDER_OPERASIONAL],
    );
    for (const policyId of FILE_POLICIES) {
      await trx.raw(
        `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
         SELECT 'directus_files', 'create',
           '{}'::jsonb,
           jsonb_build_object('_and', jsonb_build_array(
             jsonb_build_object('type', jsonb_build_object('_in', jsonb_build_array('image/jpeg','image/png','image/webp','application/pdf'))),
             jsonb_build_object('folder', jsonb_build_object('_eq', ?::text)))
           ),
           jsonb_build_object('folder', ?::text),
           '*'::text, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM directus_permissions
           WHERE policy = ? AND collection = 'directus_files' AND action = 'create'
         );`,
        [FOLDER_OPERASIONAL, FOLDER_OPERASIONAL, policyId, policyId],
      );
      await trx.raw(
        `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
         SELECT 'directus_files', 'read',
           '{"uploaded_by":{"_eq":"$CURRENT_USER"}}'::jsonb,
           '{}'::jsonb, '{}'::jsonb,
           'id,type,filesize,filename_download,title,width,height,uploaded_on'::text, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM directus_permissions
           WHERE policy = ? AND collection = 'directus_files' AND action = 'read'
         );`,
        [policyId, policyId],
      );
    }
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    for (const policyId of FILE_POLICIES) {
      await trx.raw(
        `DELETE FROM directus_permissions WHERE policy = ? AND collection = 'directus_files' AND action IN ('create','read');`,
        [policyId],
      );
    }
    await trx.raw(`DELETE FROM directus_folders WHERE id = ?;`, [FOLDER_OPERASIONAL]);
    await trx.raw(`DROP TABLE IF EXISTS talenta;`);
    await trx.raw(`DROP TABLE IF EXISTS talenta_berita_acara;`);
    await trx.raw(
      `DELETE FROM directus_collections WHERE collection IN ('talenta','talenta_berita_acara');`,
    );
  });
};
