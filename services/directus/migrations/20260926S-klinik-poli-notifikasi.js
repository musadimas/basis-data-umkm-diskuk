// Y08/M7-11…M7-12: the six consultation "poli" exactly as `requirements.md` lists them, the
// ticket columns the public form needs, and the idempotent WhatsApp outbox.
//  - `konsultasi_poli.subtopik` keeps the admin-editable topics shown under each poli name. The
//    three placeholder poli from 20260926N (produksi, sdm, ekspor) are not part of the brief and
//    are retired here; they are deleted when no ticket references them.
//  - Tickets remember who created them (`pemohon`), whether the business identity came from SIDT
//    or was typed by hand (`sumber_identitas`), and whether the applicant consented to WhatsApp
//    contact (`wa_consent`).
//  - `klinik_notifikasi` is the outbox: one row per message, with retry state, the provider's
//    message id and its delivery receipt. A 2xx request alone never marks a message delivered —
//    only a provider callback (or a provider answer that already carries a delivery status) does.
export const POLI = [
  [
    "legalitas",
    "Legalitas & Standardisasi Produk",
    "Pendampingan NIB, Halal, PIRT/BPOM, PB UMKU, dan HKI.",
    ["NIB", "Halal", "PIRT/BPOM", "PB UMKU", "HKI"],
  ],
  [
    "keuangan",
    "Manajemen & Keuangan",
    "Rekening terpisah, laporan keuangan, SOP, dan akses KUR/LPDB.",
    ["Rekening terpisah", "Laporan keuangan", "SOP", "KUR/LPDB"],
  ],
  [
    "pemasaran",
    "Pemasaran & Transformasi Digital",
    "Marketplace, promosi, QRIS, dan katalog ekspor.",
    ["Marketplace", "Promosi", "QRIS", "Katalog ekspor"],
  ],
  [
    "advokasi",
    "Advokasi & Mediasi PMSE",
    "Kontrak e-commerce, tarif, sanksi, dan pemulihan akun.",
    ["Kontrak e-commerce", "Tarif", "Sanksi", "Pemulihan akun"],
  ],
  [
    "bantuan",
    "Akses Bantuan Pemerintah",
    "Proposal, kelayakan, RAB, serta SPJ/BAST.",
    ["Proposal", "Kelayakan", "RAB", "SPJ/BAST"],
  ],
  [
    "inklusif",
    "Inklusif & Disabilitas",
    "Pendampingan alat produksi dan akses pasar.",
    ["Pendampingan alat produksi", "Akses pasar"],
  ],
];

/** Poli from 20260926N that the brief does not list; retired by this migration. */
const POLI_LAWAS = ["produksi", "sdm", "ekspor"];

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`ALTER TABLE konsultasi_poli ADD COLUMN IF NOT EXISTS subtopik JSONB NOT NULL DEFAULT '[]'::jsonb;`);

    for (const [index, [kode, nama, deskripsi, subtopik]] of POLI.entries()) {
      await trx.raw(
        `INSERT INTO konsultasi_poli (kode, nama, deskripsi, subtopik, sort, aktif)
         VALUES (?, ?, ?, ?::jsonb, ?, TRUE)
         ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama, deskripsi = EXCLUDED.deskripsi,
           subtopik = EXCLUDED.subtopik, sort = EXCLUDED.sort, aktif = TRUE`,
        [kode, nama, deskripsi, JSON.stringify(subtopik), index + 1],
      );
    }
    // Keep a referenced poli inactive instead of deleting it: konsultasi_tiket.poli is RESTRICT.
    await trx.raw(
      `DELETE FROM konsultasi_poli p
        WHERE p.kode = ANY(?)
          AND NOT EXISTS (SELECT 1 FROM konsultasi_tiket t WHERE t.poli = p.id)`,
      [POLI_LAWAS],
    );
    await trx.raw(`UPDATE konsultasi_poli SET aktif = FALSE WHERE kode = ANY(?)`, [POLI_LAWAS]);

    await trx.raw(`
      ALTER TABLE konsultasi_tiket ADD COLUMN IF NOT EXISTS pemohon UUID REFERENCES directus_users(id) ON DELETE SET NULL;
      ALTER TABLE konsultasi_tiket ADD COLUMN IF NOT EXISTS sumber_identitas TEXT NOT NULL DEFAULT 'manual';
      ALTER TABLE konsultasi_tiket ADD COLUMN IF NOT EXISTS wa_consent BOOLEAN NOT NULL DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS idx_konsultasi_tiket_pemohon ON konsultasi_tiket (pemohon);

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'konsultasi_tiket_sumber_identitas_check') THEN
          ALTER TABLE konsultasi_tiket
            ADD CONSTRAINT konsultasi_tiket_sumber_identitas_check CHECK (sumber_identitas IN ('sidt', 'manual'));
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS klinik_notifikasi (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tiket               UUID NOT NULL REFERENCES konsultasi_tiket(id) ON DELETE CASCADE,
        jenis               TEXT NOT NULL CHECK (jenis IN ('tiket_dibuat', 'status_berubah', 'pembatalan')),
        tujuan              VARCHAR(32) NOT NULL,
        -- True when the ticket's business identity came from SIDT (the owner's own account),
        -- not from a name typed by hand on the public form.
        tujuan_terverifikasi BOOLEAN NOT NULL DEFAULT FALSE,
        consent             BOOLEAN NOT NULL DEFAULT FALSE,
        template            VARCHAR(64) NOT NULL,
        payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
        status              TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'mengirim', 'terkirim', 'diterima', 'gagal', 'batal')),
        attempts            INTEGER NOT NULL DEFAULT 0,
        max_attempts        INTEGER NOT NULL DEFAULT 5,
        last_error          VARCHAR(120),
        provider            VARCHAR(32),
        provider_message_id VARCHAR(160),
        provider_status     VARCHAR(64),
        provider_receipt    JSONB,
        idempotency_key     VARCHAR(200) NOT NULL UNIQUE,
        next_attempt_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        terkirim_at         TIMESTAMPTZ,
        diterima_at         TIMESTAMPTZ,
        date_created        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_klinik_notifikasi_antrean ON klinik_notifikasi (status, next_attempt_at) WHERE status IN ('pending', 'mengirim');
      CREATE INDEX IF NOT EXISTS idx_klinik_notifikasi_tiket ON klinik_notifikasi (tiket, date_created DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS ux_klinik_notifikasi_provider_id ON klinik_notifikasi (provider_message_id) WHERE provider_message_id IS NOT NULL;
    `);

    await trx.raw(`
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('klinik_notifikasi', 'notifications', 'Antrean notifikasi WhatsApp Klinik Konsultasi', '{{jenis}} · {{status}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('konsultasi_poli', 'subtopik', 'cast-json', 'tags', NULL, 'labels', NULL, FALSE, FALSE, 5, 'full', NULL,
         'Subtopik yang tampil di bawah nama poli', NULL, FALSE, NULL, NULL, NULL),

        ('konsultasi_tiket', 'pemohon', 'm2o', 'select-dropdown-m2o', NULL, 'user', NULL, TRUE, FALSE, 24, 'half', NULL,
         'Akun pemohon bila formulir diisi sambil login', NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'sumber_identitas', NULL, 'select-dropdown',
         '{"choices":[{"text":"SIDT (terverifikasi)","value":"sidt"},{"text":"Isian manual (belum terverifikasi)","value":"manual"}]}',
         'labels', NULL, TRUE, FALSE, 25, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket', 'wa_consent', 'cast-boolean', 'boolean', NULL, 'boolean', NULL, TRUE, FALSE, 26, 'half', NULL,
         'Pemohon menyetujui dihubungi lewat WhatsApp', NULL, FALSE, NULL, NULL, NULL),

        ('klinik_notifikasi', 'id',                  'uuid',      'input',  NULL, NULL, NULL, TRUE,  TRUE,  1,  'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'tiket',               'm2o',       'select-dropdown-m2o', NULL, NULL, NULL, TRUE,  FALSE, 2,  'half', NULL, NULL, NULL, TRUE,  NULL, NULL, NULL),
        ('klinik_notifikasi', 'jenis',               NULL,        'input',  NULL, 'labels', NULL, TRUE,  FALSE, 3,  'half', NULL, NULL, NULL, TRUE,  NULL, NULL, NULL),
        ('klinik_notifikasi', 'tujuan',              NULL,        'input',  NULL, NULL, NULL, TRUE,  TRUE,  4,  'half', NULL, 'Nomor tujuan, tidak ditampilkan penuh di UI', NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'tujuan_terverifikasi', 'cast-boolean', 'boolean', NULL, 'boolean', NULL, TRUE, FALSE, 5, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'consent',             'cast-boolean', 'boolean', NULL, 'boolean', NULL, TRUE, FALSE, 6, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'template',            NULL,        'input',  NULL, NULL, NULL, TRUE,  FALSE, 7,  'half', NULL, NULL, NULL, TRUE,  NULL, NULL, NULL),
        ('klinik_notifikasi', 'payload',             'cast-json', 'input-code', '{"language":"json"}', NULL, NULL, TRUE, FALSE, 8, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'status',              NULL,        'select-dropdown',
         '{"choices":[{"text":"Menunggu","value":"pending"},{"text":"Sedang dikirim","value":"mengirim"},{"text":"Terkirim (menunggu resi)","value":"terkirim"},{"text":"Diterima","value":"diterima"},{"text":"Gagal","value":"gagal"},{"text":"Batal","value":"batal"}]}',
         'labels', NULL, TRUE, FALSE, 9, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'attempts',            NULL,        'input',  NULL, NULL, NULL, TRUE,  FALSE, 10, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'last_error',          NULL,        'input',  NULL, NULL, NULL, TRUE,  FALSE, 11, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'provider',            NULL,        'input',  NULL, NULL, NULL, TRUE,  FALSE, 12, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'provider_message_id', NULL,        'input',  NULL, NULL, NULL, TRUE,  FALSE, 13, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'provider_status',     NULL,        'input',  NULL, NULL, NULL, TRUE,  FALSE, 14, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'provider_receipt',    'cast-json', 'input-code', '{"language":"json"}', NULL, NULL, TRUE, TRUE, 15, 'full', NULL, 'Resi mentah dari provider', NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'idempotency_key',     NULL,        'input',  NULL, NULL, NULL, TRUE,  FALSE, 16, 'half', NULL, 'Satu kunci = satu pesan', NULL, TRUE,  NULL, NULL, NULL),
        ('klinik_notifikasi', 'next_attempt_at',     NULL,        'datetime', NULL, 'datetime', NULL, TRUE, FALSE, 17, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'terkirim_at',         NULL,        'datetime', NULL, 'datetime', NULL, TRUE, FALSE, 18, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'diterima_at',         NULL,        'datetime', NULL, 'datetime', NULL, TRUE, FALSE, 19, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'date_created',        'date-created', 'datetime', NULL, 'datetime', NULL, TRUE, TRUE, 20, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_notifikasi', 'date_updated',        'date-updated', 'datetime', NULL, 'datetime', NULL, TRUE, TRUE, 21, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('klinik_notifikasi', 'tiket',   'konsultasi_tiket', NULL, NULL, NULL, NULL, NULL, 'cascade'),
        ('konsultasi_tiket',  'pemohon', 'directus_users',   NULL, NULL, NULL, NULL, NULL, 'nullify')
      ON CONFLICT DO NOTHING;
    `);

    // The public form reads the poli catalogue; the subtopic list is content, not PII (ADR-006).
    await trx.raw(
      `UPDATE directus_permissions
          SET fields = fields || ',subtopik'
        WHERE collection = 'konsultasi_poli' AND action = 'read'
          AND fields NOT LIKE '%subtopik%'
          AND policy IN (SELECT policy FROM directus_access WHERE role IS NULL AND "user" IS NULL)`,
    );
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `UPDATE directus_permissions
          SET fields = replace(fields, ',subtopik', '')
        WHERE collection = 'konsultasi_poli' AND action = 'read'
          AND policy IN (SELECT policy FROM directus_access WHERE role IS NULL AND "user" IS NULL)`,
    );
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection IN ('klinik_notifikasi', 'konsultasi_tiket') AND many_field IN ('tiket', 'pemohon');
      DELETE FROM directus_fields WHERE collection = 'klinik_notifikasi';
      DELETE FROM directus_fields WHERE collection = 'konsultasi_tiket' AND field IN ('pemohon', 'sumber_identitas', 'wa_consent');
      DELETE FROM directus_fields WHERE collection = 'konsultasi_poli' AND field = 'subtopik';
      DELETE FROM directus_collections WHERE collection = 'klinik_notifikasi';
      DROP TABLE IF EXISTS klinik_notifikasi;
      ALTER TABLE konsultasi_tiket DROP CONSTRAINT IF EXISTS konsultasi_tiket_sumber_identitas_check;
      ALTER TABLE konsultasi_tiket DROP COLUMN IF EXISTS wa_consent;
      ALTER TABLE konsultasi_tiket DROP COLUMN IF EXISTS sumber_identitas;
      ALTER TABLE konsultasi_tiket DROP COLUMN IF EXISTS pemohon;
      ALTER TABLE konsultasi_poli DROP COLUMN IF EXISTS subtopik;
    `);
  });
};
