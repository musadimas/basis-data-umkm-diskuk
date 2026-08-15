export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Table ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS alamat (
        id           SERIAL PRIMARY KEY,
        kelurahan    INTEGER REFERENCES kelurahan(id) ON DELETE SET NULL,
        alamat_jalan TEXT,
        rt           VARCHAR(10),
        rw           VARCHAR(10)
      );

      -- ── Directus collection ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('alamat', 'home', NULL, '{{alamat_jalan}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 6, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields ───────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('alamat', 'id',           NULL, 'input',           NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                  NULL, FALSE, NULL, NULL, NULL),
        ('alamat', 'kelurahan',    NULL, NULL,              NULL, NULL, NULL, FALSE, FALSE, 2, 'full', NULL, NULL,                  NULL, FALSE, NULL, NULL, NULL),
        ('alamat', 'alamat_jalan', NULL, 'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 3, 'full', NULL, NULL,                  NULL, FALSE, NULL, NULL, NULL),
        ('alamat', 'rt',           NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 4, 'half', NULL, 'RT (Rukun Tetangga)', NULL, FALSE, NULL, NULL, NULL),
        ('alamat', 'rw',           NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 5, 'half', NULL, 'RW (Rukun Warga)',    NULL, FALSE, NULL, NULL, NULL);
      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('alamat', 'kelurahan', 'kelurahan', NULL, NULL, NULL, NULL, NULL, 'nullify');
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('alamat', 'kelurahan')
        );

      DELETE FROM directus_fields      WHERE collection = 'alamat';
      DELETE FROM directus_collections WHERE collection = 'alamat';

      DROP TABLE IF EXISTS alamat;
    `);
  });
};
