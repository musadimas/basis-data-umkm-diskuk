const PROVINSI_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
const KABKOTA_ROLE_ID = "ade3c009-8725-46ba-a7a0-904eeba89d01";
const PENDAMPING_ROLE_ID = "d824230f-46db-407d-b8ea-fb2ed58c6c4f";
const UMKM_ROLE_ID = "d821d35e-62e1-4f27-a323-843845d6c965";

const PROVINSI_POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";
const KABKOTA_POLICY_ID = "542bb438-226b-49b6-8792-bcfc614560a5";
const PENDAMPING_POLICY_ID = "81086586-a5a3-4d9e-a650-eca9bac81c23";
const UMKM_POLICY_ID = "98524352-468a-45bd-b638-d4075243d27d";

const KABKOTA_ACCESS_ID = "7cc0f55e-5d61-4d7c-8220-b4c8006ded0c";
const PENDAMPING_ACCESS_ID = "a9d792fa-e506-40f7-96d3-6c0a08bf3e86";
const UMKM_ACCESS_ID = "c876f629-d471-46b6-b068-2325b95600dc";

const USER_READ_FIELDS = "id,email,first_name,last_name,avatar,role,kota,usaha";
const PASSWORD_POLICY = "^(?!\\d{13}$).{12,}$";

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `UPDATE directus_roles SET name = 'Admin Provinsi', description = 'Eksekutif / Admin DISKUK Provinsi Jawa Barat' WHERE id = ?`,
      [PROVINSI_ROLE_ID],
    );

    await trx.raw(
      `INSERT INTO directus_roles (id, name, icon, description)
       VALUES (?, 'Admin Kab/Kota', 'location_city', 'Admin dinas kabupaten/kota dengan scoping wilayah')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, description = EXCLUDED.description;`,
      [KABKOTA_ROLE_ID],
    );
    await trx.raw(
      `INSERT INTO directus_roles (id, name, icon, description)
       VALUES (?, 'Pendamping', 'support_agent', 'Pendamping program akselerasi UMKM')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, description = EXCLUDED.description;`,
      [PENDAMPING_ROLE_ID],
    );
    await trx.raw(
      `INSERT INTO directus_roles (id, name, icon, description)
       VALUES (?, 'Pelaku UMKM', 'storefront', 'Pelaku usaha peserta program')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, description = EXCLUDED.description;`,
      [UMKM_ROLE_ID],
    );

    for (const [policyId, name, icon, description] of [
      [KABKOTA_POLICY_ID, "Operasional Kab/Kota", "location_city", "Akses dashboard operasional terkunci pada wilayah kab/kota"],
      [PENDAMPING_POLICY_ID, "Operasional Pendamping", "support_agent", "Akses dashboard operasional terkunci pada peserta binaan"],
      [UMKM_POLICY_ID, "Operasional Pelaku UMKM", "storefront", "Akses dashboard operasional terkunci pada usaha sendiri"],
    ]) {
      await trx.raw(
        `INSERT INTO directus_policies (id, name, icon, description, admin_access, app_access, enforce_tfa)
         VALUES (?, ?, ?, ?, FALSE, FALSE, FALSE)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, icon = EXCLUDED.icon, description = EXCLUDED.description,
           admin_access = FALSE, app_access = FALSE, enforce_tfa = FALSE;`,
        [policyId, name, icon, description],
      );
    }

    for (const [accessId, policyId, roleId] of [
      [KABKOTA_ACCESS_ID, KABKOTA_POLICY_ID, KABKOTA_ROLE_ID],
      [PENDAMPING_ACCESS_ID, PENDAMPING_POLICY_ID, PENDAMPING_ROLE_ID],
      [UMKM_ACCESS_ID, UMKM_POLICY_ID, UMKM_ROLE_ID],
    ]) {
      await trx.raw(
        `INSERT INTO directus_access (id, policy, role, sort)
         VALUES (?, ?, ?, 1)
         ON CONFLICT DO NOTHING;`,
        [accessId, policyId, roleId],
      );
    }

    await trx.raw(`
      ALTER TABLE directus_users
        ADD COLUMN IF NOT EXISTS kota INTEGER REFERENCES kota(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS usaha UUID REFERENCES usaha(id) ON DELETE SET NULL;
    `);

    await trx.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_directus_users_usaha
        ON directus_users(usaha) WHERE usaha IS NOT NULL;
    `);

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

    for (const policyId of [KABKOTA_POLICY_ID, PENDAMPING_POLICY_ID, UMKM_POLICY_ID]) {
      await trx.raw(
        `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
         SELECT 'directus_users', 'read', '{"id":{"_eq":"$CURRENT_USER"}}'::jsonb, '{}'::jsonb, '{}'::jsonb, ?::text, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM directus_permissions WHERE policy = ? AND collection = 'directus_users' AND action = 'read'
         );`,
        [USER_READ_FIELDS, policyId, policyId],
      );
    }

    for (const policyId of [PROVINSI_POLICY_ID, KABKOTA_POLICY_ID, PENDAMPING_POLICY_ID, UMKM_POLICY_ID]) {
      await trx.raw(
        `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
         SELECT 'directus_users', 'update', '{"id":{"_eq":"$CURRENT_USER"}}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'password'::text, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM directus_permissions WHERE policy = ? AND collection = 'directus_users' AND action = 'update'
         );`,
        [policyId, policyId],
      );
    }

    await trx.raw(`UPDATE directus_settings SET auth_password_policy = ?;`, [PASSWORD_POLICY]);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    for (const policyId of [PROVINSI_POLICY_ID, KABKOTA_POLICY_ID, PENDAMPING_POLICY_ID, UMKM_POLICY_ID]) {
      await trx.raw(
        `DELETE FROM directus_permissions WHERE policy = ? AND collection = 'directus_users' AND action = 'update';`,
        [policyId],
      );
    }
    await trx.raw(
      `DELETE FROM directus_permissions WHERE policy IN (?, ?, ?) AND collection = 'directus_users' AND action = 'read';`,
      [KABKOTA_POLICY_ID, PENDAMPING_POLICY_ID, UMKM_POLICY_ID],
    );
    await trx.raw(
      `UPDATE directus_permissions SET fields = 'id,email,first_name,last_name,avatar'
       WHERE policy = ? AND collection = 'directus_users' AND action = 'read';`,
      [PROVINSI_POLICY_ID],
    );
    await trx.raw(
      `DELETE FROM directus_relations WHERE many_collection = 'directus_users' AND many_field IN ('kota', 'usaha');`,
    );
    await trx.raw(`DELETE FROM directus_fields WHERE collection = 'directus_users' AND field IN ('kota', 'usaha');`);
    await trx.raw(`DROP INDEX IF EXISTS ux_directus_users_usaha;`);
    await trx.raw(`ALTER TABLE directus_users DROP COLUMN IF EXISTS usaha, DROP COLUMN IF EXISTS kota;`);
    await trx.raw(`UPDATE directus_settings SET auth_password_policy = NULL;`);

    // Role/policy removal assumes the disposable dummy accounts were deleted first
    // (scripts/cleanup-dummy-operasional.sql + seed script cleanup).
    await trx.raw(
      `DELETE FROM directus_access WHERE policy IN (?, ?, ?);`,
      [KABKOTA_POLICY_ID, PENDAMPING_POLICY_ID, UMKM_POLICY_ID],
    );
    await trx.raw(
      `DELETE FROM directus_policies WHERE id IN (?, ?, ?);`,
      [KABKOTA_POLICY_ID, PENDAMPING_POLICY_ID, UMKM_POLICY_ID],
    );
    await trx.raw(
      `DELETE FROM directus_roles WHERE id IN (?, ?, ?);`,
      [KABKOTA_ROLE_ID, PENDAMPING_ROLE_ID, UMKM_ROLE_ID],
    );
    await trx.raw(
      `UPDATE directus_roles SET name = 'Application User', description = 'Least-privilege private dashboard analyst' WHERE id = ?;`,
      [PROVINSI_ROLE_ID],
    );
  });
};
