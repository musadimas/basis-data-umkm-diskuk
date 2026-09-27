// Brief Fitur Phase 3 (Modul 4, Talent Scouting): submissions scored on four 25% dimensions and
// the Berita Acara that approves a batch of them into the talent pool.
// Upload of the commitment letter goes through Directus /files, so the dashboard policy gets
// create access and read access to its own uploads.
const POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE SEQUENCE IF NOT EXISTS talent_berita_acara_nomor_seq;

      CREATE TABLE IF NOT EXISTS talent_berita_acara (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nomor          VARCHAR(64) NOT NULL UNIQUE,
        tanggal        DATE NOT NULL DEFAULT CURRENT_DATE,
        disetujui_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        catatan        TEXT,
        berkas         UUID REFERENCES directus_files(id) ON DELETE SET NULL,
        date_created   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS talent_pengajuan (
        id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usaha                      UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE,
        diajukan_oleh              UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        kapasitas_produksi         NUMERIC(14, 2) CHECK (kapasitas_produksi >= 0),
        satuan                     VARCHAR(32),
        kesiapan_legalitas         JSONB NOT NULL DEFAULT '{}'::jsonb,
        literasi_qris              BOOLEAN NOT NULL DEFAULT FALSE,
        literasi_pembukuan_digital BOOLEAN NOT NULL DEFAULT FALSE,
        surat_komitmen             UUID REFERENCES directus_files(id) ON DELETE SET NULL,
        skor_finansial             NUMERIC(5, 2),
        skor_pasar                 NUMERIC(5, 2),
        skor_legalitas             NUMERIC(5, 2),
        skor_sdm                   NUMERIC(5, 2),
        skor_total                 NUMERIC(5, 2),
        rubrik_versi               VARCHAR(32),
        dinilai_at                 TIMESTAMPTZ,
        status                     TEXT NOT NULL DEFAULT 'draft'
                                     CHECK (status IN ('draft', 'dinilai', 'disetujui', 'ditolak')),
        catatan                    TEXT,
        berita_acara               UUID REFERENCES talent_berita_acara(id) ON DELETE SET NULL,
        date_created               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      -- A business has at most one open submission; approved and rejected ones stay as history.
      CREATE UNIQUE INDEX IF NOT EXISTS ux_talent_pengajuan_open
        ON talent_pengajuan (usaha) WHERE status IN ('draft', 'dinilai');
      CREATE INDEX IF NOT EXISTS idx_talent_pengajuan_status ON talent_pengajuan (status, skor_total DESC NULLS LAST);
      CREATE INDEX IF NOT EXISTS idx_talent_pengajuan_berita_acara ON talent_pengajuan (berita_acara);

      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('talent_pengajuan',    'person_search', 'Pengajuan Talent Scouting', '{{usaha.nama}} ({{status}})', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('talent_berita_acara', 'gavel',         'Berita Acara kurasi Talent Scouting', '{{nomor}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('talent_pengajuan', 'id',                         'uuid',         'input',               NULL, NULL, NULL, TRUE,  TRUE,  1,  'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'usaha',                      'm2o',          'select-dropdown-m2o', '{"template":"{{nama}} ({{nib}})"}', 'related-values', '{"template":"{{nama}}"}', FALSE, FALSE, 2, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_pengajuan', 'diajukan_oleh',              'm2o',          'select-dropdown-m2o', NULL, 'user', NULL, TRUE, FALSE, 3, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'status',                     NULL,           'select-dropdown',     '{"choices":[{"text":"Draft","value":"draft"},{"text":"Dinilai","value":"dinilai"},{"text":"Disetujui","value":"disetujui"},{"text":"Ditolak","value":"ditolak"}]}', 'labels', NULL, FALSE, FALSE, 4, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_pengajuan', 'kapasitas_produksi',         NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 5,  'half', NULL, 'Kapasitas produksi per bulan', NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'satuan',                     NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 6,  'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'kesiapan_legalitas',         'cast-json',    'input-code',          '{"language":"json"}', NULL, NULL, FALSE, FALSE, 7, 'full', NULL, 'Status tiap jenis legalitas, mis. {"halal":"terbit"}', NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'literasi_qris',              'cast-boolean', 'boolean',             NULL, 'boolean', NULL, FALSE, FALSE, 8,  'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'literasi_pembukuan_digital', 'cast-boolean', 'boolean',             NULL, 'boolean', NULL, FALSE, FALSE, 9,  'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'surat_komitmen',             'file',         'file',                NULL, 'file', NULL, FALSE, FALSE, 10, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'skor_finansial',             NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 11, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'skor_pasar',                 NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 12, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'skor_legalitas',             NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 13, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'skor_sdm',                   NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 14, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'skor_total',                 NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 15, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'rubrik_versi',               NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 16, 'half', NULL, 'Versi rubrik penilaian yang dipakai', NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'dinilai_at',                 NULL,           'datetime',            NULL, 'datetime', NULL, TRUE, FALSE, 17, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'catatan',                    NULL,           'input-multiline',     NULL, NULL, NULL, FALSE, FALSE, 18, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'berita_acara',               'm2o',          'select-dropdown-m2o', '{"template":"{{nomor}}"}', 'related-values', '{"template":"{{nomor}}"}', TRUE, FALSE, 19, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'date_created',               'date-created', 'datetime',            NULL, 'datetime', NULL, TRUE, TRUE, 20, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_pengajuan', 'date_updated',               'date-updated', 'datetime',            NULL, 'datetime', NULL, TRUE, TRUE, 21, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),

        ('talent_berita_acara', 'id',             'uuid',         'input',           NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_berita_acara', 'nomor',          NULL,           'input',           NULL, NULL, NULL, TRUE,  FALSE, 2, 'half', NULL, NULL, NULL, TRUE,  NULL, NULL, NULL),
        ('talent_berita_acara', 'tanggal',        NULL,           'datetime',        NULL, 'datetime', NULL, FALSE, FALSE, 3, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_berita_acara', 'disetujui_oleh', 'm2o',          'select-dropdown-m2o', NULL, 'user', NULL, TRUE, FALSE, 4, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_berita_acara', 'catatan',        NULL,           'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 5, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_berita_acara', 'berkas',         'file',         'file',            NULL, 'file', NULL, FALSE, FALSE, 6, 'full', NULL, 'Dokumen Berita Acara (PDF)', NULL, FALSE, NULL, NULL, NULL),
        ('talent_berita_acara', 'pengajuan',      'o2m',          'list-o2m',        '{"template":"{{usaha.nama}}"}', 'related-values', '{"template":"{{usaha.nama}}"}', TRUE, FALSE, 7, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_berita_acara', 'date_created',   'date-created', 'datetime',        NULL, 'datetime', NULL, TRUE, TRUE, 8, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('talent_pengajuan',    'usaha',          'usaha',               NULL,        NULL, NULL, NULL, NULL, 'nullify'),
        ('talent_pengajuan',    'diajukan_oleh',  'directus_users',      NULL,        NULL, NULL, NULL, NULL, 'nullify'),
        ('talent_pengajuan',    'surat_komitmen', 'directus_files',      NULL,        NULL, NULL, NULL, NULL, 'nullify'),
        ('talent_pengajuan',    'berita_acara',   'talent_berita_acara', 'pengajuan', NULL, NULL, NULL, NULL, 'nullify'),
        ('talent_berita_acara', 'disetujui_oleh', 'directus_users',      NULL,        NULL, NULL, NULL, NULL, 'nullify'),
        ('talent_berita_acara', 'berkas',         'directus_files',      NULL,        NULL, NULL, NULL, NULL, 'nullify');
    `);

    // Dashboard users upload attachments (commitment letters, evidence) through Directus /files
    // and may read back only what they uploaded; the program endpoints join files by id.
    for (const [action, permissions, fields] of [
      ["create", "{}", "*"],
      ["read", '{"uploaded_by":{"_eq":"$CURRENT_USER"}}', "*"],
    ]) {
      await trx.raw(
        `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
         SELECT 'directus_files', ?, ?::jsonb, '{}'::jsonb, '{}'::jsonb, ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM directus_permissions WHERE policy = ? AND collection = 'directus_files' AND action = ?
          )`,
        [action, permissions, fields, POLICY_ID, POLICY_ID, action],
      );
    }
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `DELETE FROM directus_permissions WHERE policy = ? AND collection = 'directus_files' AND action IN ('create', 'read')`,
      [POLICY_ID],
    );
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection IN ('talent_pengajuan', 'talent_berita_acara');
      DELETE FROM directus_fields WHERE collection IN ('talent_pengajuan', 'talent_berita_acara');
      DELETE FROM directus_collections WHERE collection IN ('talent_pengajuan', 'talent_berita_acara');

      DROP TABLE IF EXISTS talent_pengajuan;
      DROP TABLE IF EXISTS talent_berita_acara;
      DROP SEQUENCE IF EXISTS talent_berita_acara_nomor_seq;
    `);
  });
};
