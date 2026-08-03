export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Table ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS data_sync_logs (
        id           SERIAL PRIMARY KEY,
        business     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        pulled_at    TIMESTAMPTZ NOT NULL,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_data_sync_logs_business   ON data_sync_logs(business);
      CREATE INDEX IF NOT EXISTS idx_data_sync_logs_pulled_at  ON data_sync_logs(pulled_at);

      -- ── Directus collection ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('data_sync_logs', 'sync', NULL, '{{pulled_at}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 9, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields ───────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('data_sync_logs', 'id',           NULL,          'input',    NULL, NULL,       NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                     NULL, FALSE, NULL, NULL, NULL),
        ('data_sync_logs', 'business',     NULL,          NULL,       NULL, NULL,       NULL, FALSE, FALSE, 2, 'full', NULL, NULL,                     NULL, TRUE,  NULL, NULL, NULL),
        ('data_sync_logs', 'pulled_at',    NULL,          'datetime', NULL, 'datetime', NULL, FALSE, FALSE, 3, 'full', NULL, 'Timestamp of data pull', NULL, TRUE,  NULL, NULL, NULL),
        ('data_sync_logs', 'date_created', 'date-created','datetime', NULL, 'datetime', NULL, TRUE,  TRUE,  5, 'full', NULL, NULL,                     NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT (collection, field) DO NOTHING;

      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('data_sync_logs', 'business', 'businesses', NULL, NULL, NULL, NULL, NULL, 'nullify')
      ON CONFLICT (many_collection, many_field) DO NOTHING;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('data_sync_logs', 'business')
        );

      DELETE FROM directus_fields      WHERE collection = 'data_sync_logs';
      DELETE FROM directus_collections WHERE collection = 'data_sync_logs';

      DROP TABLE IF EXISTS data_sync_logs;
    `);
  });
};
