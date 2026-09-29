// Y04/M6-04: product media is private until curation. Photos are uploaded into the "Katalog
// Kurasi" folder, which NO public policy grant reads; the curation decision moves them into the
// public "Katalog Publik" folder (tayang/rekomendasi) or back (menunggu/ditolak). The Public
// policy grant from 20260926K keeps covering only the public folder, so a photo of an uncured
// product is not anonymously readable and other owners cannot read it either (the app policy
// only grants uploaded_by, and the katalog endpoint additionally checks ownership).
// Also adds produk.uji_lab (lab test summary shown in the showroom).
export const KURASI_FOLDER_ID = "6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f11";

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`INSERT INTO directus_folders (id, name, parent) VALUES (?, 'Katalog Kurasi', NULL) ON CONFLICT (id) DO NOTHING`, [KURASI_FOLDER_ID]);

    await trx.raw(`
      ALTER TABLE produk ADD COLUMN IF NOT EXISTS uji_lab VARCHAR(200);

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('produk', 'uji_lab', NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 25, 'half', NULL,
         'Sertifikasi uji laboratorium (bila ada)', NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_fields WHERE collection = 'produk' AND field = 'uji_lab';
      ALTER TABLE produk DROP COLUMN IF EXISTS uji_lab;
      DELETE FROM directus_folders WHERE id = ?;
    `, [KURASI_FOLDER_ID]);
  });
};
