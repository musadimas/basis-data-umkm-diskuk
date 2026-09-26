// Fondasi dashboard operasional.
//
// Peran operasional TIDAK dibuat sebagai role Directus tersendiri: identitas peran dibaca dari
// kolom `directus_users.app_role` (dibuat 20260926A-create-auth-login.js) dan seluruh pengguna
// operasional memakai satu policy aplikasi. Migrasi ini karena itu hanya menyiapkan penugasan
// wilayah (`kota`) dan memperluas field baca directus_users.
const PROVINSI_POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";

// Setara READ_FIELDS_AFTER milik 20260926A, ditambah kolom penugasan wilayah supaya web bisa
// membaca kota/usaha milik akun sendiri untuk mengunci filter dan halaman "Usaha Saya".
const USER_READ_FIELDS = "id,email,first_name,last_name,avatar,app_role,instansi,kota,usaha";

const PASSWORD_POLICY = "^(?!\\d{13}$).{12,}$";

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE directus_users
        ADD COLUMN IF NOT EXISTS kota INTEGER REFERENCES kota(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS usaha UUID REFERENCES usaha(id) ON DELETE SET NULL;
    `);

    // Tidak ada unique index kedua untuk `usaha`: 20260926A sudah membuat
    // `directus_users_usaha_unique` pada kolom yang sama.

    for (const [field, note] of [
      ["kota", "Wilayah penugasan Admin Kab/Kota"],
      ["usaha", "Usaha milik akun Pelaku UMKM"],
    ]) {
      await trx.raw(
        `INSERT INTO directus_fields (collection, field, special, interface, note)
         SELECT 'directus_users', ?, 'm2o', 'select-dropdown-m2o', ?
         WHERE NOT EXISTS (
           SELECT 1 FROM directus_fields WHERE collection = 'directus_users' AND field = ?
         );`,
        [field, note, field],
      );
    }

    for (const [field, related] of [
      ["kota", "kota"],
      ["usaha", "usaha"],
    ]) {
      await trx.raw(
        `INSERT INTO directus_relations (many_collection, many_field, one_collection, one_deselect_action)
         SELECT 'directus_users', ?, ?, 'nullify'
         WHERE NOT EXISTS (
           SELECT 1 FROM directus_relations WHERE many_collection = 'directus_users' AND many_field = ?
         );`,
        [field, related, field],
      );
    }

    await trx.raw(
      `UPDATE directus_permissions SET fields = ? WHERE policy = ? AND collection = 'directus_users' AND action = 'read';`,
      [USER_READ_FIELDS, PROVINSI_POLICY_ID],
    );

    await trx.raw(`UPDATE directus_settings SET auth_password_policy = ?;`, [PASSWORD_POLICY]);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    // Kembalikan ke keadaan 20260926A, bukan ke keadaan sebelum migrasi itu.
    await trx.raw(
      `UPDATE directus_permissions SET fields = ?
        WHERE policy = ? AND collection = 'directus_users' AND action = 'read';`,
      ["id,email,first_name,last_name,avatar,app_role,instansi", PROVINSI_POLICY_ID],
    );
    await trx.raw(
      `DELETE FROM directus_relations WHERE many_collection = 'directus_users' AND many_field IN ('kota');`,
    );
    await trx.raw(
      `DELETE FROM directus_fields WHERE collection = 'directus_users' AND field IN ('kota');`,
    );
    await trx.raw(`ALTER TABLE directus_users DROP COLUMN IF EXISTS kota;`);
    await trx.raw(`UPDATE directus_settings SET auth_password_policy = NULL;`);
  });
};
