export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Table ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS businesses (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id             VARCHAR(255),
        entrepreneur          UUID    NOT NULL REFERENCES entrepreneurs(id) ON DELETE RESTRICT,
        nib                   VARCHAR(255) UNIQUE,
        name         VARCHAR(255) NOT NULL,
        main_activity         TEXT,
        main_product          TEXT,
        classification        INTEGER REFERENCES business_classifications(id) ON DELETE SET NULL,
        legal_status          TEXT CHECK (legal_status IN (
                                'sole_proprietorship', 'cv', 'pt', 'firm', 'cooperative', 'other'
                              )),
        scale        TEXT CHECK (scale IN ('micro', 'small', 'medium')),
        founding_capital      BIGINT,
        operation_start_month SMALLINT CHECK (operation_start_month BETWEEN 1 AND 12),
        operation_start_year  SMALLINT,
        annual_revenue        BIGINT,
        total_assets          BIGINT,
        address               INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
        latitude              DECIMAL(10, 8),
        longitude             DECIMAL(11, 8),
        photo                 VARCHAR(255),
        date_created          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── Directus collection ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('businesses', 'storefront', NULL, '{{name}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 8, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields ───────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('businesses', 'id',                    'uuid',        'input',           NULL,                                                                                                                                                              NULL,       NULL,     TRUE,  TRUE,  1,  'full', NULL, NULL,                               NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'source_id',             NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 2,  'full', NULL, 'ID from source system',        NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'entrepreneur',          NULL,          NULL,              NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 3,  'full', NULL, NULL,                               NULL, TRUE,  NULL, NULL, NULL),
        ('businesses', 'nib',                   NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 4,  'full', NULL, 'Business registration number', NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'name',         NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 5,  'full', NULL, NULL,                               NULL, TRUE,  NULL, NULL, NULL),
        ('businesses', 'main_activity',         NULL,          'input-multiline', NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 6,  'full', NULL, NULL,                               NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'main_product',          NULL,          'input-multiline', NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 7,  'full', NULL, NULL,                               NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'classification',        NULL,          NULL,              NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 8,  'full', NULL, 'KBLI classification',          NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'legal_status',          NULL,          'select-dropdown', '{"choices":[{"text":"Sole Proprietorship","value":"sole_proprietorship"},{"text":"CV","value":"cv"},{"text":"PT","value":"pt"},{"text":"Firm","value":"firm"},{"text":"Cooperative","value":"cooperative"},{"text":"Other","value":"other"}]}', NULL, NULL, FALSE, FALSE, 9,  'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'scale',        NULL,          'select-dropdown', '{"choices":[{"text":"Micro","value":"micro"},{"text":"Small","value":"small"},{"text":"Medium","value":"medium"}]}',                                               NULL,       NULL,     FALSE, FALSE, 10, 'half', NULL, NULL,                               NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'founding_capital',      NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 11, 'half', NULL, 'IDR',                              NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'operation_start_month', NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 12, 'half', NULL, '1 – 12',                           NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'operation_start_year',  NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 13, 'half', NULL, NULL,                               NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'annual_revenue',        NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 14, 'half', NULL, 'IDR',                              NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'total_assets',          NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 15, 'half', NULL, 'IDR',                              NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'address',               NULL,          NULL,              NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 16, 'full', NULL, NULL,                               NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'latitude',              NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 17, 'half', NULL, NULL,                               NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'longitude',             NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 18, 'half', NULL, NULL,                               NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'photo',                 NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 19, 'full', NULL, 'Photo URL from source',        NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'date_created',          'date-created','datetime',        NULL,                                                                                                                                                              'datetime', NULL,     TRUE,  TRUE,  20, 'full', NULL, NULL,                               NULL, FALSE, NULL, NULL, NULL),
        ('businesses', 'date_updated',          'date-updated','datetime',        NULL,                                                                                                                                                              'datetime', NULL,     TRUE,  TRUE,  21, 'full', NULL, NULL,                               NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT (collection, field) DO NOTHING;

      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('businesses', 'entrepreneur',  'entrepreneurs',           NULL, NULL, NULL, NULL, NULL, 'nullify'),
        ('businesses', 'classification','business_classifications', NULL, NULL, NULL, NULL, NULL, 'nullify'),
        ('businesses', 'address',       'addresses',               NULL, NULL, NULL, NULL, NULL, 'nullify')
      ON CONFLICT (many_collection, many_field) DO NOTHING;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('businesses', 'entrepreneur'),
          ('businesses', 'classification'),
          ('businesses', 'address')
        );

      DELETE FROM directus_fields      WHERE collection = 'businesses';
      DELETE FROM directus_collections WHERE collection = 'businesses';

      DROP TABLE IF EXISTS businesses;
    `);
  });
};
