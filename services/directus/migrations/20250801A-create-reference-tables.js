export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Extension ────────────────────────────────────────────────────────
      CREATE EXTENSION IF NOT EXISTS postgis;

      -- ── Tables ───────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS provinces (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL UNIQUE,
        code       VARCHAR(50),
        geom       geometry(MultiPolygon, 4326),
        coordinate geometry(Point, 4326)
      );

      CREATE TABLE IF NOT EXISTS cities (
        id         SERIAL PRIMARY KEY,
        province   INTEGER NOT NULL REFERENCES provinces(id) ON DELETE RESTRICT,
        name       VARCHAR(255) NOT NULL,
        code       VARCHAR(50),
        geom       geometry(MultiPolygon, 4326),
        coordinate geometry(Point, 4326)
      );

      CREATE TABLE IF NOT EXISTS districts (
        id         SERIAL PRIMARY KEY,
        city       INTEGER NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
        name       VARCHAR(255) NOT NULL,
        code       VARCHAR(50),
        geom       geometry(MultiPolygon, 4326),
        coordinate geometry(Point, 4326)
      );

      CREATE TABLE IF NOT EXISTS sub_districts (
        id         SERIAL PRIMARY KEY,
        district   INTEGER NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
        name       VARCHAR(255) NOT NULL,
        code       VARCHAR(50),
        geom       geometry(MultiPolygon, 4326),
        coordinate geometry(Point, 4326)
      );

      CREATE TABLE IF NOT EXISTS business_classifications (
        id          SERIAL PRIMARY KEY,
        code        VARCHAR(255) NOT NULL UNIQUE,
        category    VARCHAR(255) NOT NULL,
        description TEXT
      );

      -- ── Spatial indexes ───────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_provinces_geom           ON provinces     USING GIST(geom);
      CREATE INDEX IF NOT EXISTS idx_provinces_coordinate     ON provinces     USING GIST(coordinate);
      CREATE INDEX IF NOT EXISTS idx_cities_geom              ON cities        USING GIST(geom);
      CREATE INDEX IF NOT EXISTS idx_cities_coordinate        ON cities        USING GIST(coordinate);
      CREATE INDEX IF NOT EXISTS idx_districts_geom           ON districts     USING GIST(geom);
      CREATE INDEX IF NOT EXISTS idx_districts_coordinate     ON districts     USING GIST(coordinate);
      CREATE INDEX IF NOT EXISTS idx_sub_districts_geom       ON sub_districts USING GIST(geom);
      CREATE INDEX IF NOT EXISTS idx_sub_districts_coordinate ON sub_districts USING GIST(coordinate);

      -- ── Directus collections ──────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('provinces',                'map',            NULL, '{{name}}',                FALSE, FALSE, NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 1, NULL, 'open', NULL, FALSE),
        ('cities',                   'location_city',  NULL, '{{name}}',                FALSE, FALSE, NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 2, NULL, 'open', NULL, FALSE),
        ('districts',                'holiday_village',NULL, '{{name}}',                FALSE, FALSE, NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 3, NULL, 'open', NULL, FALSE),
        ('sub_districts',            'cottage',        NULL, '{{name}}',                FALSE, FALSE, NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 4, NULL, 'open', NULL, FALSE),
        ('business_classifications', 'category',       NULL, '{{code}} - {{category}}', FALSE, FALSE, NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 5, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields: provinces ────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('provinces', 'id',         NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                                        NULL, FALSE, NULL, NULL, NULL),
        ('provinces', 'name',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 2, 'full', NULL, NULL,                                        NULL, TRUE,  NULL, NULL, NULL),
        ('provinces', 'code',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 3, 'half', NULL, 'BPS region code',                           NULL, FALSE, NULL, NULL, NULL),
        ('provinces', 'geom',       NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  4, 'full', NULL, 'MultiPolygon boundary — WGS84 / EPSG:4326', NULL, FALSE, NULL, NULL, NULL),
        ('provinces', 'coordinate', NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  5, 'full', NULL, 'Center point — WGS84 / EPSG:4326',          NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT (collection, field) DO NOTHING;

      -- ── Directus fields: cities ───────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('cities', 'id',         NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                                        NULL, FALSE, NULL, NULL, NULL),
        ('cities', 'province',   NULL, NULL,    NULL, NULL, NULL, FALSE, FALSE, 2, 'full', NULL, NULL,                                        NULL, TRUE,  NULL, NULL, NULL),
        ('cities', 'name',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 3, 'full', NULL, NULL,                                        NULL, TRUE,  NULL, NULL, NULL),
        ('cities', 'code',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 4, 'half', NULL, 'BPS region code',                           NULL, FALSE, NULL, NULL, NULL),
        ('cities', 'geom',       NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  5, 'full', NULL, 'MultiPolygon boundary — WGS84 / EPSG:4326', NULL, FALSE, NULL, NULL, NULL),
        ('cities', 'coordinate', NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  6, 'full', NULL, 'Center point — WGS84 / EPSG:4326',          NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT (collection, field) DO NOTHING;

      -- ── Directus fields: districts ────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('districts', 'id',         NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                                        NULL, FALSE, NULL, NULL, NULL),
        ('districts', 'city',       NULL, NULL,    NULL, NULL, NULL, FALSE, FALSE, 2, 'full', NULL, NULL,                                        NULL, TRUE,  NULL, NULL, NULL),
        ('districts', 'name',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 3, 'full', NULL, NULL,                                        NULL, TRUE,  NULL, NULL, NULL),
        ('districts', 'code',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 4, 'half', NULL, 'BPS region code',                           NULL, FALSE, NULL, NULL, NULL),
        ('districts', 'geom',       NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  5, 'full', NULL, 'MultiPolygon boundary — WGS84 / EPSG:4326', NULL, FALSE, NULL, NULL, NULL),
        ('districts', 'coordinate', NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  6, 'full', NULL, 'Center point — WGS84 / EPSG:4326',          NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT (collection, field) DO NOTHING;

      -- ── Directus fields: sub_districts ───────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('sub_districts', 'id',         NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                                        NULL, FALSE, NULL, NULL, NULL),
        ('sub_districts', 'district',   NULL, NULL,    NULL, NULL, NULL, FALSE, FALSE, 2, 'full', NULL, NULL,                                        NULL, TRUE,  NULL, NULL, NULL),
        ('sub_districts', 'name',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 3, 'full', NULL, NULL,                                        NULL, TRUE,  NULL, NULL, NULL),
        ('sub_districts', 'code',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 4, 'half', NULL, 'BPS region code',                           NULL, FALSE, NULL, NULL, NULL),
        ('sub_districts', 'geom',       NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  5, 'full', NULL, 'MultiPolygon boundary — WGS84 / EPSG:4326', NULL, FALSE, NULL, NULL, NULL),
        ('sub_districts', 'coordinate', NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  6, 'full', NULL, 'Center point — WGS84 / EPSG:4326',          NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT (collection, field) DO NOTHING;

      -- ── Directus fields: business_classifications ─────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('business_classifications', 'id',          NULL, 'input',           NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                NULL, FALSE, NULL, NULL, NULL),
        ('business_classifications', 'code',        NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 2, 'half', NULL, 'KBLI code',         NULL, TRUE,  NULL, NULL, NULL),
        ('business_classifications', 'category',    NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 3, 'half', NULL, 'KBLI category name', NULL, TRUE,  NULL, NULL, NULL),
        ('business_classifications', 'description', NULL, 'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 4, 'full', NULL, NULL,                NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT (collection, field) DO NOTHING;

      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('cities',        'province', 'provinces', NULL, NULL, NULL, NULL, NULL, 'nullify'),
        ('districts',     'city',     'cities',    NULL, NULL, NULL, NULL, NULL, 'nullify'),
        ('sub_districts', 'district', 'districts', NULL, NULL, NULL, NULL, NULL, 'nullify')
      ON CONFLICT (many_collection, many_field) DO NOTHING;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('sub_districts', 'district'),
          ('districts',     'city'),
          ('cities',        'province')
        );

      DELETE FROM directus_fields
        WHERE collection IN (
          'provinces', 'cities', 'districts',
          'sub_districts', 'business_classifications'
        );

      DELETE FROM directus_collections
        WHERE collection IN (
          'provinces', 'cities', 'districts',
          'sub_districts', 'business_classifications'
        );

      DROP TABLE IF EXISTS business_classifications;
      DROP TABLE IF EXISTS sub_districts;
      DROP TABLE IF EXISTS districts;
      DROP TABLE IF EXISTS cities;
      DROP TABLE IF EXISTS provinces;

      -- PostGIS extension is intentionally not dropped.
    `);
  });
};
