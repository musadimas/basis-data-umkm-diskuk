// Y09/M7-13…M7-14: the clinic audit trail, plus the leftover 2025 programme dates in the seeded FAQ.
//  - `konsultasi_tiket_audit` is append-only: one row per accepted change of a ticket, with the
//    actor (id and name snapshot), the status it moved from/to, and which fields the actor wrote.
//    The kanban reads it through the ticket DTO; no policy grants direct API access to the table.
//  - The two FAQ answers that still described the 2025 intake ("hingga bulan Mei 2025", "Juni s.d.
//    November 2025") are rewritten without a stale year. The update matches the old text, so
//    editorial content that an admin already changed is left alone.
const FAQ_BASI = [
  [
    "Batas waktu dan cara mendaftar?",
    "Pendaftaran dibuka pada periode yang diumumkan setiap tahun. Silakan mengunjungi Dinas KUMKM Kab./Kota sesuai domisili untuk direkomendasikan ke tenaga pendamping di wilayahnya. Jadwal resmi pendaftaran dan pelaksanaan diumumkan melalui kanal DISKUK Jawa Barat serta agenda pada portal ini.",
    "Untuk tahap awal pendaftaran di tahun 2025, silakan mengunjungi Dinas KUMKM Kab./Kota sesuai domisili untuk direkomendasikan ke tenaga pendamping di wilayahnya hingga bulan Mei 2025. Program dilaksanakan bulan Juni s.d. November 2025.",
  ],
];

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS konsultasi_tiket_audit (
        id           BIGSERIAL PRIMARY KEY,
        tiket        UUID NOT NULL REFERENCES konsultasi_tiket(id) ON DELETE CASCADE,
        aktor        UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        -- Name snapshot: the trail keeps saying who acted even if the account is renamed later.
        aktor_nama   VARCHAR(160),
        aksi         TEXT NOT NULL CHECK (aksi IN ('transisi', 'penugasan', 'catatan')),
        status_dari  TEXT,
        status_ke    TEXT,
        perubahan    JSONB NOT NULL DEFAULT '[]'::jsonb,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_konsultasi_tiket_audit_tiket
        ON konsultasi_tiket_audit (tiket, date_created DESC, id DESC);

      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('konsultasi_tiket_audit', 'history', 'Jejak audit tiket klinik (aktor, waktu, status)',
         '{{aksi}} · {{aktor_nama}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('konsultasi_tiket_audit', 'id',           NULL,           'input',               NULL, NULL, NULL, TRUE, TRUE,  1, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket_audit', 'tiket',        'm2o',          'select-dropdown-m2o', NULL, NULL, NULL, TRUE, FALSE, 2, 'half', NULL, NULL, NULL, TRUE,  NULL, NULL, NULL),
        ('konsultasi_tiket_audit', 'aktor',        'm2o',          'select-dropdown-m2o', NULL, 'user', NULL, TRUE, FALSE, 3, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket_audit', 'aktor_nama',   NULL,           'input',               NULL, NULL, NULL, TRUE, FALSE, 4, 'half', NULL, 'Nama petugas saat aksi tercatat', NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket_audit', 'aksi',         NULL,           'select-dropdown',
         '{"choices":[{"text":"Transisi status","value":"transisi"},{"text":"Penugasan","value":"penugasan"},{"text":"Catatan","value":"catatan"}]}',
         'labels', NULL, TRUE, FALSE, 5, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('konsultasi_tiket_audit', 'status_dari',  NULL,           'input',               NULL, NULL, NULL, TRUE, FALSE, 6, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket_audit', 'status_ke',    NULL,           'input',               NULL, NULL, NULL, TRUE, FALSE, 7, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket_audit', 'perubahan',    'cast-json',    'tags',                NULL, 'labels', NULL, TRUE, FALSE, 8, 'full', NULL, 'Kolom yang ditulis pada aksi ini', NULL, FALSE, NULL, NULL, NULL),
        ('konsultasi_tiket_audit', 'date_created', 'date-created', 'datetime',            NULL, 'datetime', NULL, TRUE, FALSE, 9, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      SELECT relasi.many_collection, relasi.many_field, relasi.one_collection, relasi.one_field,
             NULL, NULL, NULL, NULL, relasi.one_deselect_action
        FROM (VALUES
          ('konsultasi_tiket_audit', 'tiket', 'konsultasi_tiket', NULL::varchar, 'cascade'),
          ('konsultasi_tiket_audit', 'aktor', 'directus_users',   NULL::varchar, 'nullify')
        ) AS relasi(many_collection, many_field, one_collection, one_field, one_deselect_action)
       WHERE NOT EXISTS (
         SELECT 1 FROM directus_relations r
          WHERE r.many_collection = relasi.many_collection AND r.many_field = relasi.many_field
       );
    `);

    for (const [pertanyaan, jawaban, lama] of FAQ_BASI) {
      await trx.raw(`UPDATE faq SET jawaban = ?, date_updated = NOW() WHERE pertanyaan = ? AND jawaban = ?`, [jawaban, pertanyaan, lama]);
    }

    // The help centre shows when an answer was last edited, so freshness is visible to the visitor.
    await trx.raw(
      `UPDATE directus_permissions SET fields = fields || ',date_updated'
        WHERE collection = 'faq' AND action = 'read'
          AND policy IN (SELECT policy FROM directus_access WHERE role IS NULL AND "user" IS NULL)
          AND fields NOT LIKE '%date_updated%'`,
    );
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection = 'konsultasi_tiket_audit';
      DELETE FROM directus_fields WHERE collection = 'konsultasi_tiket_audit';
      DELETE FROM directus_collections WHERE collection = 'konsultasi_tiket_audit';
      DROP TABLE IF EXISTS konsultasi_tiket_audit;
    `);
  });
};
