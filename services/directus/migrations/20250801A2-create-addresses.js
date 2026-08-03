export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Table ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS addresses (
        id             SERIAL PRIMARY KEY,
        sub_district   INTEGER REFERENCES sub_districts(id) ON DELETE SET NULL,
        street_address TEXT,
        rt             VARCHAR(10),
        rw             VARCHAR(10)
      );

      -- ── Directus collection ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('addresses', 'home', NULL, '{{street_address}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 6, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields ───────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('addresses', 'id',             NULL, 'input',           NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,              NULL, FALSE, NULL, NULL, NULL),
        ('addresses', 'sub_district',   NULL, NULL,              NULL, NULL, NULL, FALSE, FALSE, 2, 'full', NULL, NULL,              NULL, FALSE, NULL, NULL, NULL),
        ('addresses', 'street_address', NULL, 'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 3, 'full', NULL, NULL,              NULL, FALSE, NULL, NULL, NULL),
        ('addresses', 'rt',             NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 4, 'half', NULL, 'RT (neighborhood)',NULL, FALSE, NULL, NULL, NULL),
        ('addresses', 'rw',             NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 5, 'half', NULL, 'RW (community)',   NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT (collection, field) DO NOTHING;

      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('addresses', 'sub_district', 'sub_districts', NULL, NULL, NULL, NULL, NULL, 'nullify')
      ON CONFLICT (many_collection, many_field) DO NOTHING;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('addresses', 'sub_district')
        );

      DELETE FROM directus_fields      WHERE collection = 'addresses';
      DELETE FROM directus_collections WHERE collection = 'addresses';

      DROP TABLE IF EXISTS addresses;
    `);
  });
};
