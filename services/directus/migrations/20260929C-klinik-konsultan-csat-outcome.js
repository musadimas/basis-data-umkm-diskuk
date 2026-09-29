// R04 (N7-04, N7-05): direktori konsultan klinik, CSAT pemohon, dan outcome klinik.
//  - `klinik_konsultan`: direktori yang dikurasi admin lewat Data Studio (seperti `konsultasi_poli`).
//    Publik hanya membacanya lewat endpoint ber-DTO allowlist; tidak ada grant Public.
//  - `konsultasi_tiket_csat`: satu jawaban per tiket (PK = tiket). `consent` menentukan apakah jawaban
//    boleh dihitung di statistik; jawaban tanpa consent tetap tersimpan tetapi tidak pernah dirata-ratakan.
//  - `konsultasi_outcome` (+ `_item`, `_audit`): hasil kepatuhan/perbaikan usaha dari tiket `selesai`.
//    Hanya baris `terverifikasi` yang dibaca profil/indikator; `dicabut` otomatis keluar dari hitungan.
//    Satu outcome hidup per tiket (partial unique); koreksi = versi baru + versi lama `dicabut`.
//    Tidak ada kolom teks bebas dari sesi: catatan/diagnosis tiket tidak pernah ikut ke outcome.
const ATRIBUT = [
  "npwp_usaha", "izin_edar", "sertifikat_halal", "pirt_bpom", "hki_merek", "sni", "rekening_terpisah",
  "sop_tertulis", "ecommerce", "medsos_bisnis", "qris", "pembukuan_digital", "akses_kur",
  "rantai_pasok_industri", "kontrak_offtaker",
];
const daftar = (items) => items.map((item) => `'${item}'`).join(", ");

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS klinik_konsultan (
        id           SERIAL PRIMARY KEY,
        nama         VARCHAR(120) NOT NULL,
        poli         INTEGER NOT NULL REFERENCES konsultasi_poli(id) ON DELETE RESTRICT,
        afiliasi     TEXT NOT NULL CHECK (afiliasi IN ('plut', 'dinas', 'praktisi')),
        -- Jadwal mingguan: hari kerja dan slot yang dilayani. Ketersediaan nyata = jadwal dikurangi slot terpakai.
        hari         JSONB NOT NULL DEFAULT '["senin","selasa","rabu","kamis","jumat"]'::jsonb
                       CHECK (jsonb_typeof(hari) = 'array'),
        slot         JSONB NOT NULL DEFAULT '["09:00","10:30","13:00","14:30"]'::jsonb
                       CHECK (jsonb_typeof(slot) = 'array'),
        -- Akun pendamping bila konsultan ini juga petugas: slotnya yang sudah terpakai tiket lain ikut mengurangi ketersediaan.
        pendamping   UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        aktif        BOOLEAN NOT NULL DEFAULT TRUE,
        sort         INTEGER,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_klinik_konsultan_poli ON klinik_konsultan (poli) WHERE aktif;

      CREATE TABLE IF NOT EXISTS konsultasi_tiket_csat (
        tiket        UUID PRIMARY KEY REFERENCES konsultasi_tiket(id) ON DELETE CASCADE,
        nilai        SMALLINT NOT NULL CHECK (nilai BETWEEN 1 AND 5),
        consent      BOOLEAN NOT NULL,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS konsultasi_outcome (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tiket             UUID NOT NULL REFERENCES konsultasi_tiket(id) ON DELETE CASCADE,
        usaha             UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE,
        versi             INTEGER NOT NULL CHECK (versi >= 1),
        status            TEXT NOT NULL CHECK (status IN ('diajukan', 'terverifikasi', 'dicabut')),
        diajukan_oleh     UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        diajukan_nama     VARCHAR(160),
        diajukan_pada     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        diverifikasi_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        diverifikasi_nama VARCHAR(160),
        diverifikasi_pada TIMESTAMPTZ,
        dicabut_oleh      UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        dicabut_nama      VARCHAR(160),
        dicabut_pada      TIMESTAMPTZ,
        alasan_cabut      VARCHAR(500),
        menggantikan      UUID REFERENCES konsultasi_outcome(id) ON DELETE SET NULL,
        UNIQUE (tiket, versi)
      );
      -- Satu outcome hidup per tiket: retry/dua penutupan serentak tidak bisa menggandakan efek pada profil.
      CREATE UNIQUE INDEX IF NOT EXISTS ux_konsultasi_outcome_hidup
        ON konsultasi_outcome (tiket) WHERE status IN ('diajukan', 'terverifikasi');
      CREATE INDEX IF NOT EXISTS idx_konsultasi_outcome_usaha ON konsultasi_outcome (usaha, status);

      CREATE TABLE IF NOT EXISTS konsultasi_outcome_item (
        outcome UUID NOT NULL REFERENCES konsultasi_outcome(id) ON DELETE CASCADE,
        atribut VARCHAR(64) NOT NULL CHECK (atribut IN (${daftar(ATRIBUT)})),
        jenis   TEXT NOT NULL CHECK (jenis IN ('kepatuhan', 'perbaikan')),
        PRIMARY KEY (outcome, atribut)
      );
      CREATE INDEX IF NOT EXISTS idx_konsultasi_outcome_item_atribut ON konsultasi_outcome_item (atribut);

      CREATE TABLE IF NOT EXISTS konsultasi_outcome_audit (
        id           BIGSERIAL PRIMARY KEY,
        outcome      UUID NOT NULL REFERENCES konsultasi_outcome(id) ON DELETE CASCADE,
        aktor        UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        aktor_nama   VARCHAR(160),
        aksi         TEXT NOT NULL CHECK (aksi IN ('ajukan', 'verifikasi', 'koreksi', 'cabut')),
        status_dari  TEXT,
        status_ke    TEXT NOT NULL,
        versi        INTEGER NOT NULL,
        alasan       VARCHAR(500),
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_konsultasi_outcome_audit ON konsultasi_outcome_audit (outcome, date_created, id);
    `);

    await trx.raw(`
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('klinik_konsultan',        'support_agent', 'Direktori konsultan/coach klinik (tampil di halaman klinik publik)', '{{nama}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, 'sort', 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('konsultasi_tiket_csat',   'sentiment_satisfied', 'Penilaian pemohon (CSAT); hanya consent=true yang dihitung', NULL, FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('konsultasi_outcome',      'task_alt', 'Outcome klinik: hasil kepatuhan/perbaikan usaha dari tiket selesai', '{{status}} v{{versi}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('konsultasi_outcome_item', 'checklist', NULL, '{{atribut}}', TRUE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('konsultasi_outcome_audit', 'history', 'Jejak audit outcome klinik', '{{aksi}} · {{aktor_nama}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('klinik_konsultan', 'id',         NULL,           'input',               NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_konsultan', 'nama',       NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 2, 'half', NULL, NULL, NULL, TRUE,  NULL, NULL, NULL),
        ('klinik_konsultan', 'poli',       'm2o',          'select-dropdown-m2o', '{"template":"{{nama}}"}', 'related-values', '{"template":"{{nama}}"}', FALSE, FALSE, 3, 'half', NULL, 'Keahlian utama (bidang poli)', NULL, TRUE, NULL, NULL, NULL),
        ('klinik_konsultan', 'afiliasi',   NULL,           'select-dropdown',
         '{"choices":[{"text":"PLUT","value":"plut"},{"text":"Dinas","value":"dinas"},{"text":"Praktisi","value":"praktisi"}]}',
         'labels', NULL, FALSE, FALSE, 4, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('klinik_konsultan', 'hari',       'cast-json',    'select-multiple-checkbox',
         '{"choices":[{"text":"Senin","value":"senin"},{"text":"Selasa","value":"selasa"},{"text":"Rabu","value":"rabu"},{"text":"Kamis","value":"kamis"},{"text":"Jumat","value":"jumat"}]}',
         'labels', NULL, FALSE, FALSE, 5, 'full', NULL, 'Hari kerja yang dilayani', NULL, FALSE, NULL, NULL, NULL),
        ('klinik_konsultan', 'slot',       'cast-json',    'select-multiple-checkbox',
         '{"choices":[{"text":"09:00","value":"09:00"},{"text":"10:30","value":"10:30"},{"text":"13:00","value":"13:00"},{"text":"14:30","value":"14:30"}]}',
         'labels', NULL, FALSE, FALSE, 6, 'full', NULL, 'Slot yang dilayani (sama dengan slot pemesanan)', NULL, FALSE, NULL, NULL, NULL),
        ('klinik_konsultan', 'pendamping', 'm2o',          'select-dropdown-m2o', NULL, 'user', NULL, FALSE, FALSE, 7, 'half', NULL, 'Akun pendamping, bila konsultan ini juga petugas klinik', NULL, FALSE, NULL, NULL, NULL),
        ('klinik_konsultan', 'aktif',      'cast-boolean', 'boolean',             NULL, 'boolean', NULL, FALSE, FALSE, 8, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_konsultan', 'sort',       NULL,           'input',               NULL, NULL, NULL, FALSE, TRUE,  9, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_konsultan', 'date_created', 'date-created', 'datetime',          NULL, 'datetime', NULL, TRUE, TRUE, 10, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('klinik_konsultan', 'date_updated', 'date-updated', 'datetime',          NULL, 'datetime', NULL, TRUE, TRUE, 11, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      SELECT relasi.many_collection, relasi.many_field, relasi.one_collection, NULL,
             NULL, NULL, NULL, NULL, relasi.one_deselect_action
        FROM (VALUES
          ('klinik_konsultan',    'poli',       'konsultasi_poli', 'nullify'),
          ('klinik_konsultan',    'pendamping', 'directus_users',  'nullify'),
          ('konsultasi_outcome',  'tiket',      'konsultasi_tiket', 'cascade'),
          ('konsultasi_outcome',  'usaha',      'usaha',            'cascade')
        ) AS relasi(many_collection, many_field, one_collection, one_deselect_action)
       WHERE NOT EXISTS (
         SELECT 1 FROM directus_relations r
          WHERE r.many_collection = relasi.many_collection AND r.many_field = relasi.many_field
       );
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection IN ('klinik_konsultan', 'konsultasi_outcome');
      DELETE FROM directus_fields WHERE collection = 'klinik_konsultan';
      DELETE FROM directus_collections
       WHERE collection IN ('klinik_konsultan', 'konsultasi_tiket_csat', 'konsultasi_outcome',
                            'konsultasi_outcome_item', 'konsultasi_outcome_audit');
      DROP TABLE IF EXISTS konsultasi_outcome_audit;
      DROP TABLE IF EXISTS konsultasi_outcome_item;
      DROP TABLE IF EXISTS konsultasi_outcome;
      DROP TABLE IF EXISTS konsultasi_tiket_csat;
      DROP TABLE IF EXISTS klinik_konsultan;
    `);
  });
};
