export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Table ────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS usaha (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sumber_id           VARCHAR(255),
        pelaku_usaha        UUID    NOT NULL REFERENCES pelaku_usaha(id) ON DELETE RESTRICT,
        nib                 VARCHAR(255) UNIQUE,
        nama                VARCHAR(255) NOT NULL,
        kegiatan_utama      TEXT,
        produk_utama        TEXT,
        klasifikasi         INTEGER REFERENCES klasifikasi_usaha(id) ON DELETE SET NULL,
        status_hukum        TEXT CHECK (status_hukum IN (
                              'sole_proprietorship', 'cv', 'pt', 'firm', 'cooperative', 'other'
                            )),
        skala               TEXT CHECK (skala IN ('micro', 'small', 'medium')),
        modal_pendirian     BIGINT,
        bulan_mulai_operasi SMALLINT CHECK (bulan_mulai_operasi BETWEEN 1 AND 12),
        tahun_mulai_operasi SMALLINT,
        omzet_tahunan       BIGINT,
        total_aset          BIGINT,
        alamat              INTEGER REFERENCES alamat(id) ON DELETE SET NULL,
        latitude            DECIMAL(10, 8),
        longitude           DECIMAL(11, 8),
        foto                VARCHAR(255),
        date_created        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ── Directus collection ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('usaha', 'storefront', NULL, '{{nama}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, 8, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields ───────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('usaha', 'id',                  'uuid',        'input',           NULL,                                                                                                                                                              NULL,       NULL,     TRUE,  TRUE,  1,  'full', NULL, NULL,                   NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'sumber_id',           NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 2,  'full', NULL, 'ID dari sistem sumber', NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'pelaku_usaha',        NULL,          NULL,              NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 3,  'full', NULL, NULL,                   NULL, TRUE,  NULL, NULL, NULL),
        ('usaha', 'nib',                 NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 4,  'full', NULL, 'Nomor Induk Berusaha',  NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'nama',                NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 5,  'full', NULL, NULL,                   NULL, TRUE,  NULL, NULL, NULL),
        ('usaha', 'kegiatan_utama',      NULL,          'input-multiline', NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 6,  'full', NULL, NULL,                   NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'produk_utama',        NULL,          'input-multiline', NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 7,  'full', NULL, NULL,                   NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'klasifikasi',         NULL,          NULL,              NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 8,  'full', NULL, 'Klasifikasi KBLI',      NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'status_hukum',        NULL,          'select-dropdown', '{"choices":[{"text":"Perorangan","value":"sole_proprietorship"},{"text":"CV","value":"cv"},{"text":"PT","value":"pt"},{"text":"Firma","value":"firm"},{"text":"Koperasi","value":"cooperative"},{"text":"Lainnya","value":"other"}]}', NULL, NULL, FALSE, FALSE, 9,  'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'skala',               NULL,          'select-dropdown', '{"choices":[{"text":"Mikro","value":"micro"},{"text":"Kecil","value":"small"},{"text":"Menengah","value":"medium"}]}',                                               NULL,       NULL,     FALSE, FALSE, 10, 'half', NULL, NULL,                   NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'modal_pendirian',     NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 11, 'half', NULL, 'Rupiah (IDR)',          NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'bulan_mulai_operasi', NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 12, 'half', NULL, '1 – 12',               NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'tahun_mulai_operasi', NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 13, 'half', NULL, NULL,                   NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'omzet_tahunan',       NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 14, 'half', NULL, 'Rupiah (IDR)',          NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'total_aset',          NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 15, 'half', NULL, 'Rupiah (IDR)',          NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'alamat',              NULL,          NULL,              NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 16, 'full', NULL, NULL,                   NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'latitude',            NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 17, 'half', NULL, NULL,                   NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'longitude',           NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 18, 'half', NULL, NULL,                   NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'foto',                NULL,          'input',           NULL,                                                                                                                                                              NULL,       NULL,     FALSE, FALSE, 19, 'full', NULL, 'URL foto dari sumber',  NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'date_created',        'date-created','datetime',        NULL,                                                                                                                                                              'datetime', NULL,     TRUE,  TRUE,  20, 'full', NULL, NULL,                   NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'date_updated',        'date-updated','datetime',        NULL,                                                                                                                                                              'datetime', NULL,     TRUE,  TRUE,  21, 'full', NULL, NULL,                   NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT (collection, field) DO NOTHING;

      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('usaha', 'pelaku_usaha', 'pelaku_usaha',    NULL, NULL, NULL, NULL, NULL, 'nullify'),
        ('usaha', 'klasifikasi',  'klasifikasi_usaha', NULL, NULL, NULL, NULL, NULL, 'nullify'),
        ('usaha', 'alamat',       'alamat',            NULL, NULL, NULL, NULL, NULL, 'nullify')
      ON CONFLICT (many_collection, many_field) DO NOTHING;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('usaha', 'pelaku_usaha'),
          ('usaha', 'klasifikasi'),
          ('usaha', 'alamat')
        );

      DELETE FROM directus_fields      WHERE collection = 'usaha';
      DELETE FROM directus_collections WHERE collection = 'usaha';

      DROP TABLE IF EXISTS usaha;
    `);
  });
};
