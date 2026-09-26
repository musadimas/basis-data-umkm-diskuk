// Authentication foundation: user profile attributes (app role, agency, linked business for
// NIB login), single-use captcha store, and login audit trail.
const POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";
const READ_FIELDS_BEFORE = "id,email,first_name,last_name,avatar";
const READ_FIELDS_AFTER = "id,email,first_name,last_name,avatar,app_role,instansi";

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Profile attributes on directus_users ──────────────────────────────
      ALTER TABLE directus_users
        ADD COLUMN IF NOT EXISTS app_role TEXT NOT NULL DEFAULT 'provinsi'
          CHECK (app_role IN ('provinsi', 'kabkota', 'pendamping', 'umkm')),
        ADD COLUMN IF NOT EXISTS instansi VARCHAR(255),
        ADD COLUMN IF NOT EXISTS usaha UUID REFERENCES usaha(id) ON DELETE SET NULL;

      -- A business links to at most one account so NIB → account is unambiguous.
      CREATE UNIQUE INDEX IF NOT EXISTS directus_users_usaha_unique
        ON directus_users (usaha) WHERE usaha IS NOT NULL;

      -- ── Single-use captcha (ALTCHA) ──────────────────────────────────────
      CREATE TABLE IF NOT EXISTS auth_captcha_used (
        signature  VARCHAR(128) PRIMARY KEY,
        expires_at TIMESTAMPTZ  NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_captcha_used_expires_idx ON auth_captcha_used (expires_at);

      -- ── Login audit (success & failure) ──────────────────────────────────
      CREATE TABLE IF NOT EXISTS auth_login_audit (
        id         BIGSERIAL PRIMARY KEY,
        user_id    UUID REFERENCES directus_users(id) ON DELETE CASCADE,
        status     TEXT NOT NULL CHECK (status IN ('success', 'fail')),
        reason     VARCHAR(64),
        ip         VARCHAR(64),
        user_agent VARCHAR(1024),
        origin     VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS auth_login_audit_user_created_idx
        ON auth_login_audit (user_id, created_at DESC);

      -- The session activity log reads directus_activity per user.
      CREATE INDEX IF NOT EXISTS auth_directus_activity_user_ts_idx
        ON directus_activity ("user", "timestamp" DESC);

      -- ── Directus fields ──────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('directus_users', 'app_role', NULL, 'select-dropdown', '{"choices":[{"text":"Admin DISKUK Provinsi","value":"provinsi"},{"text":"Admin Kab/Kota","value":"kabkota"},{"text":"Pendamping","value":"pendamping"},{"text":"Pelaku UMKM","value":"umkm"}]}', 'labels', NULL, FALSE, FALSE, NULL, 'half', NULL, 'App role (profile badge)', NULL, TRUE, NULL, NULL, NULL),
        ('directus_users', 'instansi', NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, NULL, 'half', NULL, 'Agency or business name', NULL, FALSE, NULL, NULL, NULL),
        ('directus_users', 'usaha', 'm2o', 'select-dropdown-m2o', '{"template":"{{nama}} ({{nib}})"}', 'related-values', '{"template":"{{nama}}"}', FALSE, FALSE, NULL, 'full', NULL, 'Business owned by an UMKM account (used for NIB login)', NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('directus_users', 'usaha', 'usaha', NULL, NULL, NULL, NULL, NULL, 'nullify');
    `);

    await trx.raw(
      `UPDATE directus_permissions SET fields = ?
        WHERE policy = ? AND collection = 'directus_users' AND action = 'read'`,
      [READ_FIELDS_AFTER, POLICY_ID],
    );

    // Application users may edit their own name and password via PATCH /users/me (account settings).
    // The authentication extension's password guard requires and verifies current_password first.
    await trx.raw(
      `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
       SELECT 'directus_users', 'update', '{"id":{"_eq":"$CURRENT_USER"}}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'first_name,last_name,password', ?
        WHERE NOT EXISTS (
          SELECT 1 FROM directus_permissions
           WHERE policy = ? AND collection = 'directus_users' AND action = 'update'
        )`,
      [POLICY_ID, POLICY_ID],
    );
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `DELETE FROM directus_permissions
        WHERE policy = ? AND collection = 'directus_users' AND action = 'update' AND fields = 'first_name,last_name,password'`,
      [POLICY_ID],
    );
    await trx.raw(
      `UPDATE directus_permissions SET fields = ?
        WHERE policy = ? AND collection = 'directus_users' AND action = 'read'`,
      [READ_FIELDS_BEFORE, POLICY_ID],
    );
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection = 'directus_users' AND many_field = 'usaha';
      DELETE FROM directus_fields WHERE collection = 'directus_users' AND field IN ('app_role', 'instansi', 'usaha');

      DROP INDEX IF EXISTS auth_directus_activity_user_ts_idx;
      DROP TABLE IF EXISTS auth_login_audit;
      DROP TABLE IF EXISTS auth_captcha_used;
      DROP INDEX IF EXISTS directus_users_usaha_unique;

      ALTER TABLE directus_users
        DROP COLUMN IF EXISTS usaha,
        DROP COLUMN IF EXISTS instansi,
        DROP COLUMN IF EXISTS app_role;
    `);
  });
};
