// Brief Fitur Phase 6.3 (Modul 7, Klinik Konsultasi): six consultation "poli", tickets from the
// public 4-step form, and the staff kanban. Only the poli list is public (ADR-006); tickets are
// created through the program extension's captcha-protected endpoint and never publicly readable.
const LAMPIRAN_FOLDER_ID = "0b8f2d4c-7a13-4c55-9e6d-3f1a2b9c8d70";

// Placeholder names until DISKUK confirms the six poli; editable in the Data Studio.
const POLI = [
  ["legalitas", "Poli Legalitas & Perizinan", "NIB, PIRT, halal, BPOM, merek dan perizinan usaha."],
  ["keuangan", "Poli Keuangan & Pembiayaan", "Pembukuan, perpajakan dan akses permodalan (KUR, koperasi)."],
  ["pemasaran", "Poli Pemasaran & Digitalisasi", "Branding, pemasaran digital dan marketplace."],
  ["produksi", "Poli Produksi & Standardisasi Mutu", "Proses produksi, kemasan, SNI dan kualitas."],
  ["sdm", "Poli Manajemen & SDM", "Manajemen usaha, organisasi dan tenaga kerja."],
  ["ekspor", "Poli Ekspor & Kemitraan", "Kesiapan ekspor, kurasi dan kemitraan usaha."],
];

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `INSERT INTO directus_folders (id, name, parent) VALUES (?, 'Lampiran Klinik', NULL) ON CONFLICT (id) DO NOTHING`,
      [LAMPIRAN_FOLDER_ID],
    );

    await trx.raw(`
      CREATE TABLE IF NOT EXISTS konsultasi_poli (
        id        SERIAL PRIMARY KEY,
        kode      VARCHAR(32) NOT NULL UNIQUE,
        nama      VARCHAR(120) NOT NULL,
        deskripsi TEXT,
        sort      INTEGER,
        aktif     BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE SEQUENCE IF NOT EXISTS konsultasi_tiket_nomor_seq;

      CREATE TABLE IF NOT EXISTS konsultasi_tiket (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nomor           VARCHAR(32) NOT NULL UNIQUE,
        usaha           UUID REFERENCES usaha(id) ON DELETE SET NULL,
        nama_usaha      VARCHAR(255) NOT NULL,
        nama_kontak     VARCHAR(120) NOT NULL,
        whatsapp        VARCHAR(32) NOT NULL,
        email           VARCHAR(160),
        poli            INTEGER NOT NULL REFERENCES konsultasi_poli(id) ON DELETE RESTRICT,
        deskripsi       TEXT NOT NULL,
        moda            TEXT NOT NULL CHECK (moda IN ('daring', 'luring')),
        jadwal_tanggal  DATE NOT NULL,
        jadwal_slot     VARCHAR(16) NOT NULL,
        prioritas       TEXT NOT NULL DEFAULT 'normal' CHECK (prioritas IN ('normal', 'tinggi', 'mendesak')),
        status          TEXT NOT NULL DEFAULT 'masuk'
                          CHECK (status IN ('masuk', 'dijadwalkan', 'berjalan', 'tindak_lanjut', 'selesai', 'batal')),
        pendamping      UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        link_meet       VARCHAR(500),
        diagnosis       JSONB NOT NULL DEFAULT '{}'::jsonb,
        action_plan     TEXT,
        rujukan         JSONB NOT NULL DEFAULT '[]'::jsonb,
        catatan         TEXT,
        date_created    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      -- One consultation per poli per slot; a cancelled ticket frees its slot.
      CREATE UNIQUE INDEX IF NOT EXISTS ux_konsultasi_tiket_slot
        ON konsultasi_tiket (poli, jadwal_tanggal, jadwal_slot) WHERE status <> 'batal';
      CREATE INDEX IF NOT EXISTS idx_konsultasi_tiket_status ON konsultasi_tiket (status, date_created DESC);

      CREATE TABLE IF NOT EXISTS konsultasi_tiket_lampiran (
        id                  SERIAL PRIMARY KEY,
        konsultasi_tiket_id UUID NOT NULL REFERENCES konsultasi_tiket(id) ON DELETE CASCADE,
        directus_files_id   UUID NOT NULL REFERENCES directus_files(id) ON DELETE CASCADE,
        sort                INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_konsultasi_tiket_lampiran ON konsultasi_tiket_lampiran (konsultasi_tiket_id);

      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('konsultasi_poli',           'medical_services', 'Poli Klinik Konsultasi UMKM', '{{nama}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, 'sort', 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('konsultasi_tiket',          'confirmation_number', 'Tiket Klinik Konsultasi (dari formulir publik)', '{{nomor}} · {{nama_usaha}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('konsultasi_tiket_lampiran', 'import_export', NULL, NULL, TRUE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('konsultasi_poli', 'id',        NULL,           'input',           NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_poli', 'kode',      NULL,           'input',           NULL, NULL, NULL, FALSE, FALSE, 2, 'half', NULL, NULL, NULL, TRUE,  NULL, NULL, NULL),
        ('konsultasi_poli', 'nama',      NULL,           'input',           NULL, NULL, NULL, FALSE, FALSE, 3, 'half', NULL, NULL, NULL, TRUE,  NULL, NULL, NULL),
        ('konsultasi_poli', 'deskripsi', NULL,           'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 4, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_poli', 'aktif',     'cast-boolean', 'boolean',         NULL, 'boolean', NULL, FALSE, FALSE, 5, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_poli', 'sort',      NULL,           'input',           NULL, NULL, NULL, FALSE, TRUE,  6, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),

        ('konsultasi_tiket', 'id',             'uuid',         'input',               NULL, NULL, NULL, TRUE,  TRUE,  1,  'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'nomor',          NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 2,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'status',         NULL,           'select-dropdown',     '{"choices":[{"text":"Tiket Masuk","value":"masuk"},{"text":"Jadwal Ditetapkan","value":"dijadwalkan"},{"text":"Sesi Berjalan","value":"berjalan"},{"text":"Tindak Lanjut","value":"tindak_lanjut"},{"text":"Selesai","value":"selesai"},{"text":"Batal","value":"batal"}]}', 'labels', NULL, FALSE, FALSE, 3, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'poli',           'm2o',          'select-dropdown-m2o', '{"template":"{{nama}}"}', 'related-values', '{"template":"{{nama}}"}', FALSE, FALSE, 4, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'prioritas',      NULL,           'select-dropdown',     '{"choices":[{"text":"Normal","value":"normal"},{"text":"Tinggi","value":"tinggi"},{"text":"Mendesak","value":"mendesak"}]}', 'labels', NULL, FALSE, FALSE, 5, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'usaha',          'm2o',          'select-dropdown-m2o', '{"template":"{{nama}}"}', 'related-values', '{"template":"{{nama}}"}', TRUE, FALSE, 6, 'half', NULL, 'Usaha SIDT bila ditemukan lewat NIB/NIK', NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'nama_usaha',     NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 7,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'nama_kontak',    NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 8,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'whatsapp',       NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 9,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'email',          NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 10, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'deskripsi',      NULL,           'input-multiline',     NULL, NULL, NULL, TRUE,  FALSE, 11, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'lampiran',       'm2m',          'files',               '{"folder":"${LAMPIRAN_FOLDER_ID}"}', 'related-values', NULL, TRUE, FALSE, 12, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'moda',           NULL,           'select-dropdown',     '{"choices":[{"text":"Daring","value":"daring"},{"text":"Luring","value":"luring"}]}', 'labels', NULL, FALSE, FALSE, 13, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'jadwal_tanggal', NULL,           'datetime',            NULL, 'datetime', NULL, FALSE, FALSE, 14, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'jadwal_slot',    NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 15, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'pendamping',     'm2o',          'select-dropdown-m2o', NULL, 'user', NULL, FALSE, FALSE, 16, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'link_meet',      NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 17, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'diagnosis',      'cast-json',    'input-code',          '{"language":"json"}', NULL, NULL, FALSE, FALSE, 18, 'full', NULL, 'Catatan diagnosis per aspek', NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'action_plan',    NULL,           'input-multiline',     NULL, NULL, NULL, FALSE, FALSE, 19, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'rujukan',        'cast-json',    'tags',                NULL, 'labels', NULL, FALSE, FALSE, 20, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'catatan',        NULL,           'input-multiline',     NULL, NULL, NULL, FALSE, FALSE, 21, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'date_created',   'date-created', 'datetime',            NULL, 'datetime', NULL, TRUE, TRUE, 22, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'date_updated',   'date-updated', 'datetime',            NULL, 'datetime', NULL, TRUE, TRUE, 23, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),

        ('konsultasi_tiket_lampiran', 'id',                  NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 1, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket_lampiran', 'konsultasi_tiket_id', NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 2, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket_lampiran', 'directus_files_id',   NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 3, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket_lampiran', 'sort',                NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 4, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('konsultasi_tiket',          'usaha',               'usaha',            NULL,       NULL, NULL, NULL,                  NULL,   'nullify'),
        ('konsultasi_tiket',          'poli',                'konsultasi_poli',  NULL,       NULL, NULL, NULL,                  NULL,   'nullify'),
        ('konsultasi_tiket',          'pendamping',          'directus_users',   NULL,       NULL, NULL, NULL,                  NULL,   'nullify'),
        ('konsultasi_tiket_lampiran', 'konsultasi_tiket_id', 'konsultasi_tiket', 'lampiran', NULL, NULL, 'directus_files_id',   'sort', 'delete'),
        ('konsultasi_tiket_lampiran', 'directus_files_id',   'directus_files',   NULL,       NULL, NULL, 'konsultasi_tiket_id', NULL,   'nullify');
    `);

    for (const [index, [kode, nama, deskripsi]] of POLI.entries()) {
      await trx.raw(`INSERT INTO konsultasi_poli (kode, nama, deskripsi, sort) VALUES (?, ?, ?, ?) ON CONFLICT (kode) DO NOTHING`, [
        kode, nama, deskripsi, index + 1,
      ]);
    }

    // Visitors choose a poli in the public form (ADR-006 allowlist).
    await trx.raw(
      `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
       SELECT ?, 'read', ?::jsonb, '{}'::jsonb, '{}'::jsonb, ?, a.policy
         FROM directus_access a
        WHERE a.role IS NULL AND a."user" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM directus_permissions p WHERE p.policy = a.policy AND p.collection = ? AND p.action = 'read'
          )`,
      ["konsultasi_poli", '{"aktif":{"_eq":true}}', "id,kode,nama,deskripsi,sort", "konsultasi_poli"],
    );
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `DELETE FROM directus_permissions WHERE collection = 'konsultasi_poli'
          AND policy IN (SELECT policy FROM directus_access WHERE role IS NULL AND "user" IS NULL)`,
    );
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection IN ('konsultasi_tiket', 'konsultasi_tiket_lampiran');
      DELETE FROM directus_fields WHERE collection IN ('konsultasi_poli', 'konsultasi_tiket', 'konsultasi_tiket_lampiran');
      DELETE FROM directus_collections WHERE collection IN ('konsultasi_poli', 'konsultasi_tiket', 'konsultasi_tiket_lampiran');
      DROP TABLE IF EXISTS konsultasi_tiket_lampiran;
      DROP TABLE IF EXISTS konsultasi_tiket;
      DROP SEQUENCE IF EXISTS konsultasi_tiket_nomor_seq;
      DROP TABLE IF EXISTS konsultasi_poli;
    `);
    await trx.raw(`DELETE FROM directus_folders WHERE id = ?`, [LAMPIRAN_FOLDER_ID]);
  });
};
