/**
 * M5-03: laporan KPI hanya dibuat pada hari Jumat (Asia/Jakarta). Laporan yang disusun offline
 * pada Jumat boleh tersinkron sesudahnya; waktu pembuatan menurut perangkat disimpan di sini
 * sebagai provenance, terpisah dari `date_created` (waktu server menerima). NULL = dikirim
 * langsung (server memakai jam sendiri).
 */
export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE kpi_laporan ADD COLUMN IF NOT EXISTS dibuat_pada_klien TIMESTAMPTZ;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      SELECT 'kpi_laporan', 'dibuat_pada_klien', NULL, 'datetime', NULL, 'datetime', NULL, TRUE, FALSE, 14, 'half', NULL,
             'Waktu laporan disusun di perangkat (sinkron offline)', NULL, FALSE, NULL, NULL, NULL
       WHERE NOT EXISTS (SELECT 1 FROM directus_fields WHERE collection = 'kpi_laporan' AND field = 'dibuat_pada_klien');
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_fields WHERE collection = 'kpi_laporan' AND field = 'dibuat_pada_klien';
      ALTER TABLE kpi_laporan DROP COLUMN IF EXISTS dibuat_pada_klien;
    `);
  });
};
