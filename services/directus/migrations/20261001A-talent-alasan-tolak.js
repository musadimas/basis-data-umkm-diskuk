/**
 * BUG-008: alasan penolakan kurasi Talent Scouting disimpan terpisah dari catatan pengaju.
 * Baris yang sudah ditolak sebelum migration ini memakai `catatan` sebagai alasan (perilaku lama
 * menimpanya dengan COALESCE), jadi nilainya disalin sebagai alasan_tolak.
 */
export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE talent_pengajuan
        ADD COLUMN IF NOT EXISTS alasan_tolak TEXT,
        ADD COLUMN IF NOT EXISTS ditolak_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS ditolak_at TIMESTAMPTZ;

      UPDATE talent_pengajuan
         SET alasan_tolak = catatan, ditolak_at = date_updated
       WHERE status = 'ditolak' AND alasan_tolak IS NULL;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      SELECT v.collection, v.field, v.special, v.interface, NULL, v.display, NULL, TRUE, FALSE, v.sort, v.width, NULL,
             v.note, NULL, FALSE, NULL, NULL, NULL
        FROM (VALUES
          ('talent_pengajuan', 'alasan_tolak', NULL, 'input-multiline', NULL, 22, 'full', 'Alasan penolakan kurasi'),
          ('talent_pengajuan', 'ditolak_oleh', 'm2o', 'select-dropdown-m2o', 'user', 23, 'half', NULL),
          ('talent_pengajuan', 'ditolak_at', NULL, 'datetime', 'datetime', 24, 'half', NULL)
        ) AS v(collection, field, special, interface, display, sort, width, note)
       WHERE NOT EXISTS (SELECT 1 FROM directus_fields f WHERE f.collection = v.collection AND f.field = v.field);

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field, one_collection_field,
         one_allowed_collections, junction_field, sort_field, one_deselect_action)
      SELECT 'talent_pengajuan', 'ditolak_oleh', 'directus_users', NULL, NULL, NULL, NULL, NULL, 'nullify'
       WHERE NOT EXISTS (SELECT 1 FROM directus_relations WHERE many_collection = 'talent_pengajuan' AND many_field = 'ditolak_oleh');
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection = 'talent_pengajuan' AND many_field = 'ditolak_oleh';
      DELETE FROM directus_fields WHERE collection = 'talent_pengajuan' AND field IN ('alasan_tolak', 'ditolak_oleh', 'ditolak_at');
      ALTER TABLE talent_pengajuan
        DROP COLUMN IF EXISTS ditolak_at,
        DROP COLUMN IF EXISTS ditolak_oleh,
        DROP COLUMN IF EXISTS alasan_tolak;
    `);
  });
};
