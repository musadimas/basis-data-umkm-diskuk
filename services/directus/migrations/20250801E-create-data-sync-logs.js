export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Table ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS log_sinkronisasi (
        id           SERIAL PRIMARY KEY,
        usaha        UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE,
        pulled_at    TIMESTAMPTZ NOT NULL,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_log_sinkronisasi_usaha     ON log_sinkronisasi(usaha);
      CREATE INDEX IF NOT EXISTS idx_log_sinkronisasi_pulled_at ON log_sinkronisasi(pulled_at);

      -- ── Directus collection ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('log_sinkronisasi', 'sync', NULL, '{{pulled_at}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 9, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields ───────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('log_sinkronisasi', 'id',           NULL,          'input',    NULL, NULL,       NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                     NULL, FALSE, NULL, NULL, NULL),
        ('log_sinkronisasi', 'usaha',        NULL,          NULL,       NULL, NULL,       NULL, FALSE, FALSE, 2, 'full', NULL, NULL,                     NULL, TRUE,  NULL, NULL, NULL),
        ('log_sinkronisasi', 'pulled_at',    NULL,          'datetime', NULL, 'datetime', NULL, FALSE, FALSE, 3, 'full', NULL, 'Waktu pengambilan data', NULL, TRUE,  NULL, NULL, NULL),
        ('log_sinkronisasi', 'date_created', 'date-created','datetime', NULL, 'datetime', NULL, TRUE,  TRUE,  5, 'full', NULL, NULL,                     NULL, FALSE, NULL, NULL, NULL)
      ;

      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('log_sinkronisasi', 'usaha', 'usaha', NULL, NULL, NULL, NULL, NULL, 'nullify')
      ;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('log_sinkronisasi', 'usaha')
        );

      DELETE FROM directus_fields      WHERE collection = 'log_sinkronisasi';
      DELETE FROM directus_collections WHERE collection = 'log_sinkronisasi';

      DROP TABLE IF EXISTS log_sinkronisasi;
    `);
  });
};
