// Brief Fitur Phase 4 (Modul 5, weekly KPI monitoring): programme participants, their weekly
// turnover reports with photo evidence, and the pendamping review. client_uuid makes offline
// resubmission idempotent.
export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS program_peserta (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usaha                UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE,
        batch                VARCHAR(64) NOT NULL,
        fase                 VARCHAR(64) NOT NULL DEFAULT 'akselerasi',
        pendamping           UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        tanggal_mulai        DATE NOT NULL,
        jumlah_minggu        SMALLINT NOT NULL DEFAULT 12 CHECK (jumlah_minggu BETWEEN 1 AND 52),
        target_mingguan      BIGINT NOT NULL CHECK (target_mingguan > 0),
        rekomendasi_pitching BOOLEAN NOT NULL DEFAULT FALSE,
        status               TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'selesai', 'keluar')),
        date_created         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (usaha, batch)
      );
      CREATE INDEX IF NOT EXISTS idx_program_peserta_pendamping ON program_peserta (pendamping);

      CREATE TABLE IF NOT EXISTS kpi_laporan (
        id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        peserta            UUID NOT NULL REFERENCES program_peserta(id) ON DELETE CASCADE,
        minggu_ke          SMALLINT NOT NULL CHECK (minggu_ke BETWEEN 1 AND 52),
        target             BIGINT NOT NULL,
        realisasi_omzet    BIGINT NOT NULL CHECK (realisasi_omzet >= 0),
        jumlah_transaksi   INTEGER NOT NULL CHECK (jumlah_transaksi >= 0),
        kendala            TEXT,
        client_uuid        UUID NOT NULL UNIQUE,
        status             TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'disetujui', 'ditolak')),
        catatan_pendamping TEXT,
        direview_oleh      UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        direview_at        TIMESTAMPTZ,
        dikirim_oleh       UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        date_created       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- One report per week; a rejected report is corrected in place.
        UNIQUE (peserta, minggu_ke)
      );
      CREATE INDEX IF NOT EXISTS idx_kpi_laporan_status ON kpi_laporan (status, date_updated DESC);

      CREATE TABLE IF NOT EXISTS kpi_laporan_bukti (
        id                SERIAL PRIMARY KEY,
        kpi_laporan_id    UUID NOT NULL REFERENCES kpi_laporan(id) ON DELETE CASCADE,
        directus_files_id UUID NOT NULL REFERENCES directus_files(id) ON DELETE CASCADE,
        sort              INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_kpi_laporan_bukti_laporan ON kpi_laporan_bukti (kpi_laporan_id);

      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('program_peserta',   'groups',       'Peserta program akselerasi (12 minggu)', '{{usaha.nama}} · {{batch}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('kpi_laporan',       'trending_up',  'Laporan KPI mingguan', 'Minggu {{minggu_ke}} · {{status}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('kpi_laporan_bukti', 'import_export', NULL, NULL, TRUE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('program_peserta', 'id',                   'uuid',         'input',               NULL, NULL, NULL, TRUE,  TRUE,  1,  'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('program_peserta', 'usaha',                'm2o',          'select-dropdown-m2o', '{"template":"{{nama}} ({{nib}})"}', 'related-values', '{"template":"{{nama}}"}', FALSE, FALSE, 2, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('program_peserta', 'batch',                NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 3,  'half', NULL, 'mis. 2026-1', NULL, TRUE, NULL, NULL, NULL),
        ('program_peserta', 'fase',                 NULL,           'select-dropdown',     '{"allowOther":true,"choices":[{"text":"Pra-akselerasi","value":"pra_akselerasi"},{"text":"Akselerasi","value":"akselerasi"},{"text":"Pasca-akselerasi","value":"pasca_akselerasi"}]}', 'labels', NULL, FALSE, FALSE, 4, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('program_peserta', 'pendamping',           'm2o',          'select-dropdown-m2o', NULL, 'user', NULL, FALSE, FALSE, 5,  'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('program_peserta', 'tanggal_mulai',        NULL,           'datetime',            NULL, 'datetime', NULL, FALSE, FALSE, 6, 'half', NULL, 'Minggu ke-1 dimulai pada tanggal ini', NULL, TRUE, NULL, NULL, NULL),
        ('program_peserta', 'jumlah_minggu',        NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 7,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('program_peserta', 'target_mingguan',      NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 8,  'half', NULL, 'Target omzet per minggu (Rp)', NULL, TRUE, NULL, NULL, NULL),
        ('program_peserta', 'rekomendasi_pitching', 'cast-boolean', 'boolean',             NULL, 'boolean', NULL, TRUE, FALSE, 9, 'half', NULL, 'Diatur lewat panel pendampingan (butuh 4 minggu berturut-turut mencapai target)', NULL, FALSE, NULL, NULL, NULL),
        ('program_peserta', 'status',               NULL,           'select-dropdown',     '{"choices":[{"text":"Aktif","value":"aktif"},{"text":"Selesai","value":"selesai"},{"text":"Keluar","value":"keluar"}]}', 'labels', NULL, FALSE, FALSE, 10, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('program_peserta', 'laporan',              'o2m',          'list-o2m',            '{"template":"Minggu {{minggu_ke}} · {{status}}"}', 'related-values', NULL, TRUE, FALSE, 11, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('program_peserta', 'date_created',         'date-created', 'datetime',            NULL, 'datetime', NULL, TRUE, TRUE, 12, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('program_peserta', 'date_updated',         'date-updated', 'datetime',            NULL, 'datetime', NULL, TRUE, TRUE, 13, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),

        ('kpi_laporan', 'id',                 'uuid',         'input',               NULL, NULL, NULL, TRUE,  TRUE,  1,  'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kpi_laporan', 'peserta',            'm2o',          'select-dropdown-m2o', '{"template":"{{usaha.nama}} · {{batch}}"}', 'related-values', NULL, TRUE, FALSE, 2, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kpi_laporan', 'minggu_ke',          NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 3,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kpi_laporan', 'status',             NULL,           'select-dropdown',     '{"choices":[{"text":"Menunggu","value":"menunggu"},{"text":"Disetujui","value":"disetujui"},{"text":"Ditolak","value":"ditolak"}]}', 'labels', NULL, TRUE, FALSE, 4, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kpi_laporan', 'target',             NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 5,  'half', NULL, 'Target minggu ini saat laporan dikirim (Rp)', NULL, TRUE, NULL, NULL, NULL),
        ('kpi_laporan', 'realisasi_omzet',    NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 6,  'half', NULL, 'Rp', NULL, TRUE, NULL, NULL, NULL),
        ('kpi_laporan', 'jumlah_transaksi',   NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 7,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kpi_laporan', 'bukti',              'm2m',          'files',               NULL, 'related-values', NULL, TRUE, FALSE, 8, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kpi_laporan', 'kendala',            NULL,           'input-multiline',     NULL, NULL, NULL, TRUE,  FALSE, 9,  'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kpi_laporan', 'catatan_pendamping', NULL,           'input-multiline',     NULL, NULL, NULL, TRUE,  FALSE, 10, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kpi_laporan', 'direview_oleh',      'm2o',          'select-dropdown-m2o', NULL, 'user', NULL, TRUE, FALSE, 11, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kpi_laporan', 'direview_at',        NULL,           'datetime',            NULL, 'datetime', NULL, TRUE, FALSE, 12, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kpi_laporan', 'dikirim_oleh',       'm2o',          'select-dropdown-m2o', NULL, 'user', NULL, TRUE, FALSE, 13, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kpi_laporan', 'client_uuid',        NULL,           'input',               NULL, NULL, NULL, TRUE,  TRUE,  14, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kpi_laporan', 'date_created',       'date-created', 'datetime',            NULL, 'datetime', NULL, TRUE, TRUE, 15, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kpi_laporan', 'date_updated',       'date-updated', 'datetime',            NULL, 'datetime', NULL, TRUE, TRUE, 16, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),

        ('kpi_laporan_bukti', 'id',                NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 1, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kpi_laporan_bukti', 'kpi_laporan_id',    NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 2, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kpi_laporan_bukti', 'directus_files_id', NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 3, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kpi_laporan_bukti', 'sort',              NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 4, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('program_peserta',   'usaha',             'usaha',           NULL,      NULL, NULL, NULL, NULL, 'nullify'),
        ('program_peserta',   'pendamping',        'directus_users',  NULL,      NULL, NULL, NULL, NULL, 'nullify'),
        ('kpi_laporan',       'peserta',           'program_peserta', 'laporan', NULL, NULL, NULL, NULL, 'delete'),
        ('kpi_laporan',       'direview_oleh',     'directus_users',  NULL,      NULL, NULL, NULL, NULL, 'nullify'),
        ('kpi_laporan',       'dikirim_oleh',      'directus_users',  NULL,      NULL, NULL, NULL, NULL, 'nullify'),
        ('kpi_laporan_bukti', 'kpi_laporan_id',    'kpi_laporan',     'bukti',   NULL, NULL, 'directus_files_id', 'sort', 'delete'),
        ('kpi_laporan_bukti', 'directus_files_id', 'directus_files',  NULL,      NULL, NULL, 'kpi_laporan_id',    NULL,   'nullify');
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection IN ('program_peserta', 'kpi_laporan', 'kpi_laporan_bukti');
      DELETE FROM directus_fields WHERE collection IN ('program_peserta', 'kpi_laporan', 'kpi_laporan_bukti');
      DELETE FROM directus_collections WHERE collection IN ('program_peserta', 'kpi_laporan', 'kpi_laporan_bukti');

      DROP TABLE IF EXISTS kpi_laporan_bukti;
      DROP TABLE IF EXISTS kpi_laporan;
      DROP TABLE IF EXISTS program_peserta;
    `);
  });
};
