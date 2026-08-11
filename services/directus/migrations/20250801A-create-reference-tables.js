export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Extension ────────────────────────────────────────────────────────
      CREATE EXTENSION IF NOT EXISTS postgis;

      -- ── Tables ───────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS provinsi (
        id         SERIAL PRIMARY KEY,
        nama       VARCHAR(255) NOT NULL UNIQUE,
        kode       VARCHAR(50),
        geom       geometry(MultiPolygon, 4326),
        coordinate geometry(Point, 4326)
      );

      CREATE TABLE IF NOT EXISTS kota (
        id         SERIAL PRIMARY KEY,
        provinsi   INTEGER NOT NULL REFERENCES provinsi(id) ON DELETE RESTRICT,
        nama       VARCHAR(255) NOT NULL,
        kode       VARCHAR(50),
        geom       geometry(MultiPolygon, 4326),
        coordinate geometry(Point, 4326)
      );

      CREATE TABLE IF NOT EXISTS kecamatan (
        id         SERIAL PRIMARY KEY,
        kota       INTEGER NOT NULL REFERENCES kota(id) ON DELETE RESTRICT,
        nama       VARCHAR(255) NOT NULL,
        kode       VARCHAR(50),
        geom       geometry(MultiPolygon, 4326),
        coordinate geometry(Point, 4326)
      );

      CREATE TABLE IF NOT EXISTS kelurahan (
        id         SERIAL PRIMARY KEY,
        kecamatan  INTEGER NOT NULL REFERENCES kecamatan(id) ON DELETE RESTRICT,
        nama       VARCHAR(255) NOT NULL,
        kode       VARCHAR(50),
        geom       geometry(MultiPolygon, 4326),
        coordinate geometry(Point, 4326)
      );

      CREATE TABLE IF NOT EXISTS klasifikasi_usaha (
        id        SERIAL PRIMARY KEY,
        kode      VARCHAR(255) NOT NULL UNIQUE,
        kategori  VARCHAR(255) NOT NULL,
        deskripsi TEXT
      );

      -- ── Spatial indexes ───────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS idx_provinsi_geom           ON provinsi  USING GIST(geom);
      CREATE INDEX IF NOT EXISTS idx_provinsi_coordinate     ON provinsi  USING GIST(coordinate);
      CREATE INDEX IF NOT EXISTS idx_kota_geom               ON kota      USING GIST(geom);
      CREATE INDEX IF NOT EXISTS idx_kota_coordinate         ON kota      USING GIST(coordinate);
      CREATE INDEX IF NOT EXISTS idx_kecamatan_geom          ON kecamatan USING GIST(geom);
      CREATE INDEX IF NOT EXISTS idx_kecamatan_coordinate    ON kecamatan USING GIST(coordinate);
      CREATE INDEX IF NOT EXISTS idx_kelurahan_geom          ON kelurahan USING GIST(geom);
      CREATE INDEX IF NOT EXISTS idx_kelurahan_coordinate    ON kelurahan USING GIST(coordinate);

      -- ── Directus collections ──────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('provinsi',          'map',            NULL, '{{nama}}',                FALSE, FALSE, NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 1, NULL, 'open', NULL, FALSE),
        ('kota',              'location_city',  NULL, '{{nama}}',                FALSE, FALSE, NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 2, NULL, 'open', NULL, FALSE),
        ('kecamatan',         'holiday_village',NULL, '{{nama}}',                FALSE, FALSE, NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 3, NULL, 'open', NULL, FALSE),
        ('kelurahan',         'cottage',        NULL, '{{nama}}',                FALSE, FALSE, NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 4, NULL, 'open', NULL, FALSE),
        ('klasifikasi_usaha', 'category',       NULL, '{{kode}} - {{kategori}}', FALSE, FALSE, NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 5, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields: provinsi ─────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('provinsi', 'id',         NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                                      NULL, FALSE, NULL, NULL, NULL),
        ('provinsi', 'nama',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 2, 'full', NULL, NULL,                                      NULL, TRUE,  NULL, NULL, NULL),
        ('provinsi', 'kode',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 3, 'half', NULL, 'Kode wilayah BPS',                        NULL, FALSE, NULL, NULL, NULL),
        ('provinsi', 'geom',       NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  4, 'full', NULL, 'Batas MultiPolygon — WGS84 / EPSG:4326',  NULL, FALSE, NULL, NULL, NULL),
        ('provinsi', 'coordinate', NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  5, 'full', NULL, 'Titik pusat — WGS84 / EPSG:4326',         NULL, FALSE, NULL, NULL, NULL)
      ;

      -- ── Directus fields: kota ─────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('kota', 'id',         NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                                      NULL, FALSE, NULL, NULL, NULL),
        ('kota', 'provinsi',   NULL, NULL,    NULL, NULL, NULL, FALSE, FALSE, 2, 'full', NULL, NULL,                                      NULL, TRUE,  NULL, NULL, NULL),
        ('kota', 'nama',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 3, 'full', NULL, NULL,                                      NULL, TRUE,  NULL, NULL, NULL),
        ('kota', 'kode',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 4, 'half', NULL, 'Kode wilayah BPS',                        NULL, FALSE, NULL, NULL, NULL),
        ('kota', 'geom',       NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  5, 'full', NULL, 'Batas MultiPolygon — WGS84 / EPSG:4326',  NULL, FALSE, NULL, NULL, NULL),
        ('kota', 'coordinate', NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  6, 'full', NULL, 'Titik pusat — WGS84 / EPSG:4326',         NULL, FALSE, NULL, NULL, NULL)
      ;

      -- ── Directus fields: kecamatan ────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('kecamatan', 'id',         NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                                      NULL, FALSE, NULL, NULL, NULL),
        ('kecamatan', 'kota',       NULL, NULL,    NULL, NULL, NULL, FALSE, FALSE, 2, 'full', NULL, NULL,                                      NULL, TRUE,  NULL, NULL, NULL),
        ('kecamatan', 'nama',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 3, 'full', NULL, NULL,                                      NULL, TRUE,  NULL, NULL, NULL),
        ('kecamatan', 'kode',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 4, 'half', NULL, 'Kode wilayah BPS',                        NULL, FALSE, NULL, NULL, NULL),
        ('kecamatan', 'geom',       NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  5, 'full', NULL, 'Batas MultiPolygon — WGS84 / EPSG:4326',  NULL, FALSE, NULL, NULL, NULL),
        ('kecamatan', 'coordinate', NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  6, 'full', NULL, 'Titik pusat — WGS84 / EPSG:4326',         NULL, FALSE, NULL, NULL, NULL)
      ;

      -- ── Directus fields: kelurahan ────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('kelurahan', 'id',         NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                                      NULL, FALSE, NULL, NULL, NULL),
        ('kelurahan', 'kecamatan',  NULL, NULL,    NULL, NULL, NULL, FALSE, FALSE, 2, 'full', NULL, NULL,                                      NULL, TRUE,  NULL, NULL, NULL),
        ('kelurahan', 'nama',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 3, 'full', NULL, NULL,                                      NULL, TRUE,  NULL, NULL, NULL),
        ('kelurahan', 'kode',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 4, 'half', NULL, 'Kode wilayah BPS',                        NULL, FALSE, NULL, NULL, NULL),
        ('kelurahan', 'geom',       NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  5, 'full', NULL, 'Batas MultiPolygon — WGS84 / EPSG:4326',  NULL, FALSE, NULL, NULL, NULL),
        ('kelurahan', 'coordinate', NULL, 'input', NULL, NULL, NULL, TRUE,  TRUE,  6, 'full', NULL, 'Titik pusat — WGS84 / EPSG:4326',         NULL, FALSE, NULL, NULL, NULL)
      ;

      -- ── Directus fields: klasifikasi_usaha ───────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('klasifikasi_usaha', 'id',        NULL, 'input',           NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL,                 NULL, FALSE, NULL, NULL, NULL),
        ('klasifikasi_usaha', 'kode',      NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 2, 'half', NULL, 'Kode KBLI',          NULL, TRUE,  NULL, NULL, NULL),
        ('klasifikasi_usaha', 'kategori',  NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, 3, 'half', NULL, 'Nama kategori KBLI', NULL, TRUE,  NULL, NULL, NULL),
        ('klasifikasi_usaha', 'deskripsi', NULL, 'input-multiline', NULL, NULL, NULL, FALSE, FALSE, 4, 'full', NULL, NULL,                 NULL, FALSE, NULL, NULL, NULL)
      ;

      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('kota',      'provinsi',  'provinsi',  NULL, NULL, NULL, NULL, NULL, 'nullify'),
        ('kecamatan', 'kota',      'kota',      NULL, NULL, NULL, NULL, NULL, 'nullify'),
        ('kelurahan', 'kecamatan', 'kecamatan', NULL, NULL, NULL, NULL, NULL, 'nullify')
      ;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('kelurahan', 'kecamatan'),
          ('kecamatan', 'kota'),
          ('kota',      'provinsi')
        );

      DELETE FROM directus_fields
        WHERE collection IN (
          'provinsi', 'kota', 'kecamatan',
          'kelurahan', 'klasifikasi_usaha'
        );

      DELETE FROM directus_collections
        WHERE collection IN (
          'provinsi', 'kota', 'kecamatan',
          'kelurahan', 'klasifikasi_usaha'
        );

      DROP TABLE IF EXISTS klasifikasi_usaha;
      DROP TABLE IF EXISTS kelurahan;
      DROP TABLE IF EXISTS kecamatan;
      DROP TABLE IF EXISTS kota;
      DROP TABLE IF EXISTS provinsi;

      -- PostGIS extension is intentionally not dropped.
    `);
  });
};
