export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Table ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS pelaku_usaha (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nik                    VARCHAR(16)  NOT NULL UNIQUE,
        nama_lengkap           VARCHAR(255) NOT NULL,
        jenis_kelamin          TEXT         NOT NULL CHECK (jenis_kelamin IN ('male', 'female')),
        penyandang_disabilitas BOOLEAN      NOT NULL DEFAULT FALSE,
        birth_date             DATE,
        tingkat_pendidikan     TEXT CHECK (tingkat_pendidikan IN (
                                 'none', 'elementary', 'junior_high', 'senior_high',
                                 'diploma', 'bachelor', 'master', 'doctorate'
                               )),
        telepon                VARCHAR(50),
        alamat                 INTEGER REFERENCES alamat(id) ON DELETE SET NULL,
        date_created           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── Directus collection ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('pelaku_usaha', 'person', NULL, '{{nama_lengkap}} ({{nik}})', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 7, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields ───────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('pelaku_usaha', 'id',                     'uuid',        'input',           NULL,                                                                                                                                                                                                                                                   NULL,       NULL,               TRUE,  TRUE,  1,  'full', NULL, NULL,             NULL, FALSE, NULL, NULL, NULL),
        ('pelaku_usaha', 'nik',                    NULL,          'input',           NULL,                                                                                                                                                                                                                                                   NULL,       NULL,               FALSE, FALSE, 2,  'half', NULL, 'NIK (16 digit)', NULL, TRUE,  NULL, NULL, NULL),
        ('pelaku_usaha', 'nama_lengkap',           NULL,          'input',           NULL,                                                                                                                                                                                                                                                   NULL,       NULL,               FALSE, FALSE, 3,  'half', NULL, NULL,             NULL, TRUE,  NULL, NULL, NULL),
        ('pelaku_usaha', 'jenis_kelamin',          NULL,          'select-dropdown', '{"choices":[{"text":"Laki-laki","value":"male"},{"text":"Perempuan","value":"female"}]}',                                                                                                                                                               NULL,       NULL,               FALSE, FALSE, 4,  'half', NULL, NULL,             NULL, TRUE,  NULL, NULL, NULL),
        ('pelaku_usaha', 'penyandang_disabilitas', 'cast-boolean','boolean',         NULL,                                                                                                                                                                                                                                                   NULL,       NULL,               FALSE, FALSE, 5,  'half', NULL, NULL,             NULL, FALSE, NULL, NULL, NULL),
        ('pelaku_usaha', 'birth_date',             NULL,          'datetime',        '{"type":"date"}',                                                                                                                                                                                                                                      'datetime', '{"type":"date"}',   FALSE, FALSE, 6,  'half', NULL, NULL,             NULL, FALSE, NULL, NULL, NULL),
        ('pelaku_usaha', 'tingkat_pendidikan',     NULL,          'select-dropdown', '{"choices":[{"text":"Tidak Sekolah","value":"none"},{"text":"SD","value":"elementary"},{"text":"SMP","value":"junior_high"},{"text":"SMA/SMK","value":"senior_high"},{"text":"Diploma","value":"diploma"},{"text":"Sarjana (S1)","value":"bachelor"},{"text":"Magister (S2)","value":"master"},{"text":"Doktor (S3)","value":"doctorate"}]}', NULL, NULL, FALSE, FALSE, 7, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('pelaku_usaha', 'telepon',                NULL,          'input',           NULL,                                                                                                                                                                                                                                                   NULL,       NULL,               FALSE, FALSE, 8,  'half', NULL, NULL,             NULL, FALSE, NULL, NULL, NULL),
        ('pelaku_usaha', 'alamat',                 NULL,          NULL,              NULL,                                                                                                                                                                                                                                                   NULL,       NULL,               FALSE, FALSE, 9,  'full', NULL, NULL,             NULL, FALSE, NULL, NULL, NULL),
        ('pelaku_usaha', 'date_created',           'date-created','datetime',        NULL,                                                                                                                                                                                                                                                   'datetime', NULL,               TRUE,  TRUE,  10, 'full', NULL, NULL,             NULL, FALSE, NULL, NULL, NULL),
        ('pelaku_usaha', 'date_updated',           'date-updated','datetime',        NULL,                                                                                                                                                                                                                                                   'datetime', NULL,               TRUE,  TRUE,  11, 'full', NULL, NULL,             NULL, FALSE, NULL, NULL, NULL);
      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('pelaku_usaha', 'alamat', 'alamat', NULL, NULL, NULL, NULL, NULL, 'nullify');
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('pelaku_usaha', 'alamat')
        );

      DELETE FROM directus_fields      WHERE collection = 'pelaku_usaha';
      DELETE FROM directus_collections WHERE collection = 'pelaku_usaha';

      DROP TABLE IF EXISTS pelaku_usaha;
    `);
  });
};
