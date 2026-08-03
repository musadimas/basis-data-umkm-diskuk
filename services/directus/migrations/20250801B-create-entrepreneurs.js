export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Table ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS entrepreneurs (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nik             VARCHAR(16)  NOT NULL UNIQUE,
        full_name       VARCHAR(255) NOT NULL,
        gender          TEXT         NOT NULL CHECK (gender IN ('male', 'female')),
        is_disabled     BOOLEAN      NOT NULL DEFAULT FALSE,
        birth_date      DATE,
        education_level TEXT CHECK (education_level IN (
                          'none', 'elementary', 'junior_high', 'senior_high',
                          'diploma', 'bachelor', 'master', 'doctorate'
                        )),
        phone           VARCHAR(50),
        address         INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
        date_created    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── Directus collection ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('entrepreneurs', 'person', NULL, '{{full_name}} ({{nik}})', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 7, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields ───────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('entrepreneurs', 'id',              'uuid',        'input',           NULL,                                                                                                                                                                                                                                          NULL,       NULL,               TRUE,  TRUE,  1,  'full', NULL, NULL,                    NULL, FALSE, NULL, NULL, NULL),
        ('entrepreneurs', 'nik',             NULL,          'input',           NULL,                                                                                                                                                                                                                                          NULL,       NULL,               FALSE, FALSE, 2,  'half', NULL, 'National ID (16 digits)', NULL, TRUE,  NULL, NULL, NULL),
        ('entrepreneurs', 'full_name',       NULL,          'input',           NULL,                                                                                                                                                                                                                                          NULL,       NULL,               FALSE, FALSE, 3,  'half', NULL, NULL,                    NULL, TRUE,  NULL, NULL, NULL),
        ('entrepreneurs', 'gender',          NULL,          'select-dropdown', '{"choices":[{"text":"Male","value":"male"},{"text":"Female","value":"female"}]}',                                                                                                                                                              NULL,       NULL,               FALSE, FALSE, 4,  'half', NULL, NULL,                    NULL, TRUE,  NULL, NULL, NULL),
        ('entrepreneurs', 'is_disabled',     'cast-boolean','boolean',         NULL,                                                                                                                                                                                                                                          NULL,       NULL,               FALSE, FALSE, 5,  'half', NULL, NULL,                    NULL, FALSE, NULL, NULL, NULL),
        ('entrepreneurs', 'birth_date',      NULL,          'datetime',        '{"type":"date"}',                                                                                                                                                                                                                             'datetime', '{"type":"date"}',   FALSE, FALSE, 6,  'half', NULL, NULL,                    NULL, FALSE, NULL, NULL, NULL),
        ('entrepreneurs', 'education_level', NULL,          'select-dropdown', '{"choices":[{"text":"None","value":"none"},{"text":"Elementary","value":"elementary"},{"text":"Junior High","value":"junior_high"},{"text":"Senior High","value":"senior_high"},{"text":"Diploma","value":"diploma"},{"text":"Bachelor","value":"bachelor"},{"text":"Master","value":"master"},{"text":"Doctorate","value":"doctorate"}]}', NULL, NULL, FALSE, FALSE, 7, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('entrepreneurs', 'phone',           NULL,          'input',           NULL,                                                                                                                                                                                                                                          NULL,       NULL,               FALSE, FALSE, 8,  'half', NULL, NULL,                    NULL, FALSE, NULL, NULL, NULL),
        ('entrepreneurs', 'address',         NULL,          NULL,              NULL,                                                                                                                                                                                                                                          NULL,       NULL,               FALSE, FALSE, 9,  'full', NULL, NULL,                    NULL, FALSE, NULL, NULL, NULL),
        ('entrepreneurs', 'date_created',    'date-created','datetime',        NULL,                                                                                                                                                                                                                                          'datetime', NULL,               TRUE,  TRUE,  10, 'full', NULL, NULL,                    NULL, FALSE, NULL, NULL, NULL),
        ('entrepreneurs', 'date_updated',    'date-updated','datetime',        NULL,                                                                                                                                                                                                                                          'datetime', NULL,               TRUE,  TRUE,  11, 'full', NULL, NULL,                    NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT (collection, field) DO NOTHING;

      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('entrepreneurs', 'address', 'addresses', NULL, NULL, NULL, NULL, NULL, 'nullify')
      ON CONFLICT (many_collection, many_field) DO NOTHING;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('entrepreneurs', 'address')
        );

      DELETE FROM directus_fields      WHERE collection = 'entrepreneurs';
      DELETE FROM directus_collections WHERE collection = 'entrepreneurs';

      DROP TABLE IF EXISTS entrepreneurs;
    `);
  });
};
