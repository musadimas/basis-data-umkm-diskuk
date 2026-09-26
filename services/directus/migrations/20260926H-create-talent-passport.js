// Brief Fitur Phase 5 (Modul 6, Talent Passport): a signed public snapshot of a talent-pool
// business. The payload is what the public verification page shows; payload_hash and signature
// (HMAC-SHA256, key from PASSPORT_SIGNING_SECRET or derived from SECRET) detect tampering.
// Reads go through the program extension's verify endpoint, never the Public policy.
export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS talent_passport (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usaha            UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE,
        kode             VARCHAR(16) NOT NULL UNIQUE,
        payload          JSONB NOT NULL,
        payload_hash     CHAR(64) NOT NULL,
        signature        CHAR(64) NOT NULL,
        skor_finansial   NUMERIC(5, 2) NOT NULL,
        skor_pasar       NUMERIC(5, 2) NOT NULL,
        skor_legalitas   NUMERIC(5, 2) NOT NULL,
        skor_sdm         NUMERIC(5, 2) NOT NULL,
        skor_kinerja     NUMERIC(5, 2) NOT NULL,
        status_badge     TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'dicabut')),
        diterbitkan_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        diterbitkan_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        dicabut_at       TIMESTAMPTZ
      );
      -- Re-issuing revokes the previous passport, so a business has one active passport.
      CREATE UNIQUE INDEX IF NOT EXISTS ux_talent_passport_aktif ON talent_passport (usaha) WHERE status = 'aktif';

      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('talent_passport', 'badge', 'Talent Passport bertanda tangan (diterbitkan lewat dashboard)', '{{kode}} · {{status}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('talent_passport', 'id',               'uuid',      'input',               NULL, NULL, NULL, TRUE, TRUE,  1,  'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_passport', 'usaha',            'm2o',       'select-dropdown-m2o', '{"template":"{{nama}}"}', 'related-values', '{"template":"{{nama}}"}', TRUE, FALSE, 2, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'kode',             NULL,        'input',               NULL, NULL, NULL, TRUE, FALSE, 3,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'status',           NULL,        'select-dropdown',     '{"choices":[{"text":"Aktif","value":"aktif"},{"text":"Dicabut","value":"dicabut"}]}', 'labels', NULL, TRUE, FALSE, 4, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'status_badge',     NULL,        'input',               NULL, NULL, NULL, TRUE, FALSE, 5,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'skor_finansial',   NULL,        'input',               NULL, NULL, NULL, TRUE, FALSE, 6,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'skor_pasar',       NULL,        'input',               NULL, NULL, NULL, TRUE, FALSE, 7,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'skor_legalitas',   NULL,        'input',               NULL, NULL, NULL, TRUE, FALSE, 8,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'skor_sdm',         NULL,        'input',               NULL, NULL, NULL, TRUE, FALSE, 9,  'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'skor_kinerja',     NULL,        'input',               NULL, NULL, NULL, TRUE, FALSE, 10, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'payload',          'cast-json', 'input-code',          '{"language":"json"}', NULL, NULL, TRUE, FALSE, 11, 'full', NULL, 'Isi yang ditandatangani; jangan diubah', NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'payload_hash',     NULL,        'input',               NULL, NULL, NULL, TRUE, TRUE,  12, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'signature',        NULL,        'input',               NULL, NULL, NULL, TRUE, TRUE,  13, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'diterbitkan_oleh', 'm2o',       'select-dropdown-m2o', NULL, 'user', NULL, TRUE, FALSE, 14, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('talent_passport', 'diterbitkan_at',   NULL,        'datetime',            NULL, 'datetime', NULL, TRUE, FALSE, 15, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('talent_passport', 'dicabut_at',       NULL,        'datetime',            NULL, 'datetime', NULL, TRUE, FALSE, 16, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('talent_passport', 'usaha',            'usaha',          NULL, NULL, NULL, NULL, NULL, 'nullify'),
        ('talent_passport', 'diterbitkan_oleh', 'directus_users', NULL, NULL, NULL, NULL, NULL, 'nullify');
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection = 'talent_passport';
      DELETE FROM directus_fields WHERE collection = 'talent_passport';
      DELETE FROM directus_collections WHERE collection = 'talent_passport';
      DROP TABLE IF EXISTS talent_passport;
    `);
  });
};
