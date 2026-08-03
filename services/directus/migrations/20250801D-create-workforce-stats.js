export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Table ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS workforce_stats (
        id                     SERIAL PRIMARY KEY,
        business               UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
        paid_male              INTEGER NOT NULL DEFAULT 0,
        paid_female            INTEGER NOT NULL DEFAULT 0,
        paid_disabled_male     INTEGER NOT NULL DEFAULT 0,
        paid_disabled_female   INTEGER NOT NULL DEFAULT 0,
        unpaid_male            INTEGER NOT NULL DEFAULT 0,
        unpaid_female          INTEGER NOT NULL DEFAULT 0,
        unpaid_disabled_male   INTEGER NOT NULL DEFAULT 0,
        unpaid_disabled_female INTEGER NOT NULL DEFAULT 0,
        date_updated           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── Directus collection ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('workforce_stats', 'groups', NULL, NULL, FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 8, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields ───────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('workforce_stats', 'id',                     NULL,          'input', NULL, NULL, NULL, TRUE,  TRUE,  1,  'full', NULL, NULL,                 NULL, FALSE, NULL, NULL, NULL),
        ('workforce_stats', 'business',               NULL,          NULL,    NULL, NULL, NULL, FALSE, FALSE, 2,  'full', NULL, NULL,                 NULL, TRUE,  NULL, NULL, NULL),
        ('workforce_stats', 'paid_male',              NULL,          'input', NULL, NULL, NULL, FALSE, FALSE, 3,  'half', NULL, 'Paid workers — male',          NULL, FALSE, NULL, NULL, NULL),
        ('workforce_stats', 'paid_female',            NULL,          'input', NULL, NULL, NULL, FALSE, FALSE, 4,  'half', NULL, 'Paid workers — female',        NULL, FALSE, NULL, NULL, NULL),
        ('workforce_stats', 'paid_disabled_male',     NULL,          'input', NULL, NULL, NULL, FALSE, FALSE, 5,  'half', NULL, 'Paid disabled — male',         NULL, FALSE, NULL, NULL, NULL),
        ('workforce_stats', 'paid_disabled_female',   NULL,          'input', NULL, NULL, NULL, FALSE, FALSE, 6,  'half', NULL, 'Paid disabled — female',       NULL, FALSE, NULL, NULL, NULL),
        ('workforce_stats', 'unpaid_male',            NULL,          'input', NULL, NULL, NULL, FALSE, FALSE, 7,  'half', NULL, 'Unpaid workers — male',        NULL, FALSE, NULL, NULL, NULL),
        ('workforce_stats', 'unpaid_female',          NULL,          'input', NULL, NULL, NULL, FALSE, FALSE, 8,  'half', NULL, 'Unpaid workers — female',      NULL, FALSE, NULL, NULL, NULL),
        ('workforce_stats', 'unpaid_disabled_male',   NULL,          'input', NULL, NULL, NULL, FALSE, FALSE, 9,  'half', NULL, 'Unpaid disabled — male',       NULL, FALSE, NULL, NULL, NULL),
        ('workforce_stats', 'unpaid_disabled_female', NULL,          'input', NULL, NULL, NULL, FALSE, FALSE, 10, 'half', NULL, 'Unpaid disabled — female',     NULL, FALSE, NULL, NULL, NULL),
        ('workforce_stats', 'date_updated',           'date-updated','datetime', NULL, 'datetime', NULL, TRUE, TRUE, 11, 'full', NULL, NULL,          NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT (collection, field) DO NOTHING;

      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('workforce_stats', 'business', 'businesses', NULL, NULL, NULL, NULL, NULL, 'nullify')
      ON CONFLICT (many_collection, many_field) DO NOTHING;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('workforce_stats', 'business')
        );

      DELETE FROM directus_fields      WHERE collection = 'workforce_stats';
      DELETE FROM directus_collections WHERE collection = 'workforce_stats';

      DROP TABLE IF EXISTS workforce_stats;
    `);
  });
};
