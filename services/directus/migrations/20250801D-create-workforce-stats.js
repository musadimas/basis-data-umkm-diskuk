export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Table ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS statistik_tenaga_kerja (
        id                                   SERIAL PRIMARY KEY,
        usaha                                UUID NOT NULL UNIQUE REFERENCES usaha(id) ON DELETE CASCADE,
        dibayar_laki_laki                    INTEGER NOT NULL DEFAULT 0,
        dibayar_perempuan                    INTEGER NOT NULL DEFAULT 0,
        disabilitas_dibayar_laki_laki        INTEGER NOT NULL DEFAULT 0,
        disabilitas_dibayar_perempuan        INTEGER NOT NULL DEFAULT 0,
        tidak_dibayar_laki_laki              INTEGER NOT NULL DEFAULT 0,
        tidak_dibayar_perempuan              INTEGER NOT NULL DEFAULT 0,
        disabilitas_tidak_dibayar_laki_laki  INTEGER NOT NULL DEFAULT 0,
        disabilitas_tidak_dibayar_perempuan  INTEGER NOT NULL DEFAULT 0,
        date_updated                         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── Directus collection ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('statistik_tenaga_kerja', 'groups', NULL, NULL, FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 8, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields ───────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('statistik_tenaga_kerja', 'id',                                  NULL,          'input',    NULL, NULL,       NULL, TRUE,  TRUE,  1,  'full', NULL, NULL,                                                NULL, FALSE, NULL, NULL, NULL),
        ('statistik_tenaga_kerja', 'usaha',                               NULL,          NULL,       NULL, NULL,       NULL, FALSE, FALSE, 2,  'full', NULL, NULL,                                                NULL, TRUE,  NULL, NULL, NULL),
        ('statistik_tenaga_kerja', 'dibayar_laki_laki',                   NULL,          'input',    NULL, NULL,       NULL, FALSE, FALSE, 3,  'half', NULL, 'Tenaga kerja dibayar — laki-laki',                  NULL, FALSE, NULL, NULL, NULL),
        ('statistik_tenaga_kerja', 'dibayar_perempuan',                   NULL,          'input',    NULL, NULL,       NULL, FALSE, FALSE, 4,  'half', NULL, 'Tenaga kerja dibayar — perempuan',                  NULL, FALSE, NULL, NULL, NULL),
        ('statistik_tenaga_kerja', 'disabilitas_dibayar_laki_laki',       NULL,          'input',    NULL, NULL,       NULL, FALSE, FALSE, 5,  'half', NULL, 'Penyandang disabilitas dibayar — laki-laki',        NULL, FALSE, NULL, NULL, NULL),
        ('statistik_tenaga_kerja', 'disabilitas_dibayar_perempuan',       NULL,          'input',    NULL, NULL,       NULL, FALSE, FALSE, 6,  'half', NULL, 'Penyandang disabilitas dibayar — perempuan',        NULL, FALSE, NULL, NULL, NULL),
        ('statistik_tenaga_kerja', 'tidak_dibayar_laki_laki',             NULL,          'input',    NULL, NULL,       NULL, FALSE, FALSE, 7,  'half', NULL, 'Tenaga kerja tidak dibayar — laki-laki',            NULL, FALSE, NULL, NULL, NULL),
        ('statistik_tenaga_kerja', 'tidak_dibayar_perempuan',             NULL,          'input',    NULL, NULL,       NULL, FALSE, FALSE, 8,  'half', NULL, 'Tenaga kerja tidak dibayar — perempuan',            NULL, FALSE, NULL, NULL, NULL),
        ('statistik_tenaga_kerja', 'disabilitas_tidak_dibayar_laki_laki', NULL,          'input',    NULL, NULL,       NULL, FALSE, FALSE, 9,  'half', NULL, 'Penyandang disabilitas tidak dibayar — laki-laki',  NULL, FALSE, NULL, NULL, NULL),
        ('statistik_tenaga_kerja', 'disabilitas_tidak_dibayar_perempuan', NULL,          'input',    NULL, NULL,       NULL, FALSE, FALSE, 10, 'half', NULL, 'Penyandang disabilitas tidak dibayar — perempuan',  NULL, FALSE, NULL, NULL, NULL),
        ('statistik_tenaga_kerja', 'date_updated',                        'date-updated','datetime', NULL, 'datetime', NULL, TRUE,  TRUE,  11, 'full', NULL, NULL,                                                NULL, FALSE, NULL, NULL, NULL)
      ;

      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('statistik_tenaga_kerja', 'usaha', 'usaha', NULL, NULL, NULL, NULL, NULL, 'nullify')
      ;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('statistik_tenaga_kerja', 'usaha')
        );

      DELETE FROM directus_fields      WHERE collection = 'statistik_tenaga_kerja';
      DELETE FROM directus_collections WHERE collection = 'statistik_tenaga_kerja';

      DROP TABLE IF EXISTS statistik_tenaga_kerja;
    `);
  });
};
