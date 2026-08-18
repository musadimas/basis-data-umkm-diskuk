const APPLICATION_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
const POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      INSERT INTO directus_roles (id, name, icon, description, admin_access, app_access)
      VALUES (?, 'Application User', 'account_circle', 'Least-privilege private dashboard analyst', FALSE, TRUE)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        admin_access = FALSE,
        app_access = TRUE;

      INSERT INTO directus_policies (id, name, icon, description, admin_access, app_access, enforce_tfa)
      VALUES (?, 'Private Dashboard Analyst', 'lock', 'Private dashboard access policy', FALSE, TRUE, FALSE)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        admin_access = FALSE,
        app_access = TRUE;

      INSERT INTO directus_access (policy, role, sort)
      VALUES (?, ?, 1)
      ON CONFLICT DO NOTHING;
    `, [APPLICATION_ROLE_ID, POLICY_ID, POLICY_ID, APPLICATION_ROLE_ID]);

    // Keep the role capable of bootstrapping /users/me, while custom dashboard
    // endpoints enforce the fixed role before touching their database.
    await trx.raw(`
      INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
      SELECT 'directus_users', 'read', '{"id":{"_eq":"$CURRENT_USER"}}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'id,email,first_name,last_name,avatar'::text, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM directus_permissions
        WHERE policy = ? AND collection = 'directus_users' AND action = 'read'
      );
    `, [POLICY_ID, POLICY_ID]);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_permissions WHERE policy = ?;
      DELETE FROM directus_access WHERE policy = ? OR role = ?;
      DELETE FROM directus_policies WHERE id = ?;
      DELETE FROM directus_roles WHERE id = ?;
    `, [POLICY_ID, POLICY_ID, APPLICATION_ROLE_ID, POLICY_ID, APPLICATION_ROLE_ID]);
  });
};
