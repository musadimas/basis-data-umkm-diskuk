// Brief Fitur Phase 6.2 and 6.4 (Modul 7): the public event calendar, FAQ and hotline contact.
// All three are editorial content managed in the Data Studio and read through the Directus
// Public policy (ADR-006): explicit field allowlists, published items only.
const KATALOG_FOLDER_ID = "6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10";

const PUBLIC_GRANTS = [
  {
    collection: "kegiatan",
    permissions: '{"status_publikasi":{"_eq":"terbit"}}',
    fields:
      "id,judul,ringkasan,kategori,penyelenggara,kota_nama,metode,ramah_disabilitas,tanggal_mulai,tanggal_selesai," +
      "batas_registrasi,lokasi,link,kuota,terisi,silabus,narasumber,fasilitas,syarat,poster",
  },
  { collection: "faq", permissions: '{"status":{"_eq":"terbit"}}', fields: "id,pertanyaan,jawaban,kategori,sort" },
  { collection: "kontak_hotline", permissions: "{}", fields: "id,nama_layanan,whatsapp,telepon,email,jam_layanan,alamat" },
];

// The FAQ the landing page already showed, so the new /bantuan page starts with real content.
const FAQ_SEED = [
  ["Apa itu Program UMKM Naik Kelas?", "Program UMKM Naik Kelas mentargetkan peserta dari pengusaha di Jawa Barat yang berkomitmen untuk maju dan berkembang di bidang bisnis. Manfaat yang didapatkan adalah penguatan diri, manajemen usaha untuk bisa naik kelas, dan pemanfaatan teknologi informasi untuk mencapai pasar yang lebih luas."],
  ["Batas waktu dan cara mendaftar?", "Untuk tahap awal pendaftaran di tahun 2025, silakan mengunjungi Dinas KUMKM Kab./Kota sesuai domisili untuk direkomendasikan ke tenaga pendamping di wilayahnya hingga bulan Mei 2025. Program dilaksanakan bulan Juni s.d. November 2025."],
  ["Apakah bisa dibantu mendaftar secara online?", "Ya, jika Anda tidak memiliki akses internet atau mengalami kesulitan teknis, Anda bisa datang langsung ke Dinas KUMKM Kab./Kota sesuai domisili untuk mendapatkan bantuan proses pendaftaran."],
  ["Persyaratan Program UMKM Naik Kelas Bagi Pengusaha", "Penduduk Jawa Barat; minimal usia 20 tahun dan maksimal usia 40 tahun; memiliki motivasi tinggi dan terbiasa menggunakan sarana digital; omzet usaha lebih dari Rp100.000.000/tahun; memiliki NIB; memiliki usaha minimal 2 tahun."],
  ["Persyaratan Program UMKM Naik Kelas Bagi Pendamping", "Warga Jawa Barat (KTP); usia 20–50 tahun; sehat jasmani dan rohani; bukan ASN; tidak menjadi pengurus partai politik; memiliki kemampuan dan/atau terbiasa menggunakan sarana digital; bersedia melakukan kunjungan lapangan ke tempat UMKM."],
  ["Dimanakah lokasi Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat?", "Jalan Soekarno-Hatta No. 705 Kota Bandung."],
];

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS kegiatan (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        judul             VARCHAR(200) NOT NULL,
        ringkasan         TEXT,
        kategori          TEXT NOT NULL DEFAULT 'pelatihan'
                            CHECK (kategori IN ('pelatihan', 'pameran', 'bazar', 'seminar', 'temu_bisnis', 'lainnya')),
        penyelenggara     VARCHAR(160),
        kota_nama         VARCHAR(120),
        metode            TEXT NOT NULL DEFAULT 'luring' CHECK (metode IN ('luring', 'daring', 'hybrid')),
        ramah_disabilitas BOOLEAN NOT NULL DEFAULT FALSE,
        tanggal_mulai     TIMESTAMPTZ NOT NULL,
        tanggal_selesai   TIMESTAMPTZ NOT NULL,
        batas_registrasi  TIMESTAMPTZ,
        lokasi            TEXT,
        link              VARCHAR(500),
        kuota             INTEGER CHECK (kuota >= 0),
        terisi            INTEGER NOT NULL DEFAULT 0 CHECK (terisi >= 0),
        silabus           TEXT,
        narasumber        TEXT,
        fasilitas         TEXT,
        syarat            TEXT,
        poster            UUID REFERENCES directus_files(id) ON DELETE SET NULL,
        status_publikasi  TEXT NOT NULL DEFAULT 'draft' CHECK (status_publikasi IN ('draft', 'terbit')),
        date_created      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (tanggal_selesai >= tanggal_mulai)
      );
      CREATE INDEX IF NOT EXISTS idx_kegiatan_tanggal ON kegiatan (status_publikasi, tanggal_mulai);

      CREATE TABLE IF NOT EXISTS faq (
        id           SERIAL PRIMARY KEY,
        pertanyaan   VARCHAR(300) NOT NULL,
        jawaban      TEXT NOT NULL,
        kategori     VARCHAR(80),
        sort         INTEGER,
        status       TEXT NOT NULL DEFAULT 'terbit' CHECK (status IN ('draft', 'terbit')),
        date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS kontak_hotline (
        id           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        nama_layanan VARCHAR(160) NOT NULL DEFAULT 'Layanan Informasi DISKUK Jawa Barat',
        whatsapp     VARCHAR(32),
        telepon      VARCHAR(32),
        email        VARCHAR(160),
        jam_layanan  VARCHAR(160),
        alamat       TEXT
      );
      INSERT INTO kontak_hotline (id, alamat) VALUES (1, 'Jalan Soekarno-Hatta No. 705 Kota Bandung') ON CONFLICT (id) DO NOTHING;

      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('kegiatan',       'event',       'Agenda kegiatan di portal publik (tayang bila status "terbit")', '{{judul}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('faq',            'quiz',        'Pertanyaan umum di halaman Bantuan', '{{pertanyaan}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, 'sort', 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('kontak_hotline', 'support_agent', 'Kontak hotline di halaman Bantuan dan Katalog', NULL, FALSE, TRUE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('kegiatan', 'id',                'uuid',         'input',           NULL, NULL, NULL, TRUE,  TRUE,  1,  'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'status_publikasi',  NULL,           'select-dropdown', '{"choices":[{"text":"Draft","value":"draft"},{"text":"Terbit","value":"terbit"}]}', 'labels', NULL, FALSE, FALSE, 2, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kegiatan', 'kategori',          NULL,           'select-dropdown', '{"choices":[{"text":"Pelatihan","value":"pelatihan"},{"text":"Pameran","value":"pameran"},{"text":"Bazar","value":"bazar"},{"text":"Seminar","value":"seminar"},{"text":"Temu bisnis","value":"temu_bisnis"},{"text":"Lainnya","value":"lainnya"}]}', 'labels', NULL, FALSE, FALSE, 3, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kegiatan', 'judul',             NULL,           'input',           NULL, NULL, NULL, FALSE, FALSE, 4,  'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kegiatan', 'ringkasan',         NULL,           'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 5,  'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'penyelenggara',     NULL,           'input',           NULL, NULL, NULL, FALSE, FALSE, 6,  'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'kota_nama',         NULL,           'input',           NULL, NULL, NULL, FALSE, FALSE, 7,  'half', NULL, 'Kab/Kota tempat kegiatan', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'metode',            NULL,           'select-dropdown', '{"choices":[{"text":"Luring","value":"luring"},{"text":"Daring","value":"daring"},{"text":"Hybrid","value":"hybrid"}]}', 'labels', NULL, FALSE, FALSE, 8, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kegiatan', 'ramah_disabilitas', 'cast-boolean', 'boolean',         NULL, 'boolean', NULL, FALSE, FALSE, 9, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'tanggal_mulai',     NULL,           'datetime',        NULL, 'datetime', NULL, FALSE, FALSE, 10, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kegiatan', 'tanggal_selesai',   NULL,           'datetime',        NULL, 'datetime', NULL, FALSE, FALSE, 11, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kegiatan', 'batas_registrasi',  NULL,           'datetime',        NULL, 'datetime', NULL, FALSE, FALSE, 12, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'kuota',             NULL,           'input',           NULL, NULL, NULL, FALSE, FALSE, 13, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'terisi',            NULL,           'input',           NULL, NULL, NULL, FALSE, FALSE, 14, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'lokasi',            NULL,           'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 15, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'link',              NULL,           'input',           NULL, NULL, NULL, FALSE, FALSE, 16, 'half', NULL, 'Tautan daring (https)', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'silabus',           NULL,           'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 17, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'narasumber',        NULL,           'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 18, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'fasilitas',         NULL,           'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 19, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'syarat',            NULL,           'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 20, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'poster',            'file',         'file-image',      '{"folder":"${KATALOG_FOLDER_ID}"}', 'image', NULL, FALSE, FALSE, 21, 'full', NULL, 'Disimpan di folder publik', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'date_created',      'date-created', 'datetime',        NULL, 'datetime', NULL, TRUE, TRUE, 22, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'date_updated',      'date-updated', 'datetime',        NULL, 'datetime', NULL, TRUE, TRUE, 23, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),

        ('faq', 'id',           NULL,           'input',             NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('faq', 'status',       NULL,           'select-dropdown',   '{"choices":[{"text":"Draft","value":"draft"},{"text":"Terbit","value":"terbit"}]}', 'labels', NULL, FALSE, FALSE, 2, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('faq', 'kategori',     NULL,           'input',             NULL, NULL, NULL, FALSE, FALSE, 3, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('faq', 'pertanyaan',   NULL,           'input',             NULL, NULL, NULL, FALSE, FALSE, 4, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('faq', 'jawaban',      NULL,           'input-multiline',   NULL, NULL, NULL, FALSE, FALSE, 5, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('faq', 'sort',         NULL,           'input',             NULL, NULL, NULL, FALSE, TRUE,  6, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('faq', 'date_updated', 'date-updated', 'datetime',          NULL, 'datetime', NULL, TRUE, TRUE, 7, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),

        ('kontak_hotline', 'id',           NULL, 'input',           NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kontak_hotline', 'nama_layanan', NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 2, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('kontak_hotline', 'whatsapp',     NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 3, 'half', NULL, 'Nomor WhatsApp resmi, mis. 0812...', NULL, FALSE, NULL, NULL, NULL),
        ('kontak_hotline', 'telepon',      NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 4, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kontak_hotline', 'email',        NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 5, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kontak_hotline', 'jam_layanan',  NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 6, 'half', NULL, 'mis. Senin–Jumat 08.00–16.00 WIB', NULL, FALSE, NULL, NULL, NULL),
        ('kontak_hotline', 'alamat',       NULL, 'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 7, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES ('kegiatan', 'poster', 'directus_files', NULL, NULL, NULL, NULL, NULL, 'nullify');
    `);

    for (const [index, [pertanyaan, jawaban]] of FAQ_SEED.entries()) {
      await trx.raw(
        `INSERT INTO faq (pertanyaan, jawaban, kategori, sort) SELECT ?, ?, 'Program', ?
          WHERE NOT EXISTS (SELECT 1 FROM faq WHERE pertanyaan = ?)`,
        [pertanyaan, jawaban, index + 1, pertanyaan],
      );
    }

    for (const grant of PUBLIC_GRANTS) {
      await trx.raw(
        `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
         SELECT ?, 'read', ?::jsonb, '{}'::jsonb, '{}'::jsonb, ?, a.policy
           FROM directus_access a
          WHERE a.role IS NULL AND a."user" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM directus_permissions p
               WHERE p.policy = a.policy AND p.collection = ? AND p.action = 'read'
            )`,
        [grant.collection, grant.permissions, grant.fields, grant.collection],
      );
    }
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    for (const grant of PUBLIC_GRANTS) {
      await trx.raw(
        `DELETE FROM directus_permissions
          WHERE collection = ? AND action = 'read' AND fields = ?
            AND policy IN (SELECT policy FROM directus_access WHERE role IS NULL AND "user" IS NULL)`,
        [grant.collection, grant.fields],
      );
    }
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection = 'kegiatan';
      DELETE FROM directus_fields WHERE collection IN ('kegiatan', 'faq', 'kontak_hotline');
      DELETE FROM directus_collections WHERE collection IN ('kegiatan', 'faq', 'kontak_hotline');
      DROP TABLE IF EXISTS kontak_hotline;
      DROP TABLE IF EXISTS faq;
      DROP TABLE IF EXISTS kegiatan;
    `);
  });
};
