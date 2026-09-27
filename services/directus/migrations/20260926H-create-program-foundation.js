// Brief Fitur Phase 0 (docs/brief-fitur-plan/main_plan.md): regional scope for Kab/Kota accounts,
// talent-programme and catalogue attributes on usaha, and the usaha_legalitas certificates
// shown on the map card, katalog and passport.
const POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";
// BEFORE is the read list left by 20260926D-operational-roles.js.
const READ_FIELDS_BEFORE = "id,email,first_name,last_name,avatar,app_role,instansi,usaha";
const READ_FIELDS_AFTER = "id,email,first_name,last_name,avatar,app_role,instansi,usaha,kota_scope";

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      -- ── Regional scope on directus_users ─────────────────────────────────
      ALTER TABLE directus_users
        ADD COLUMN IF NOT EXISTS kota_scope INTEGER REFERENCES kota(id) ON DELETE SET NULL;

      -- ── Programme attributes on usaha ────────────────────────────────────
      ALTER TABLE usaha
        ADD COLUMN IF NOT EXISTS talent_status TEXT NOT NULL DEFAULT 'none'
          CHECK (talent_status IN ('none', 'nominated', 'scouting', 'talent_pool', 'accelerator', 'champion')),
        ADD COLUMN IF NOT EXISTS talent_batch      VARCHAR(64),
        ADD COLUMN IF NOT EXISTS pdn_terverifikasi BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS ramah_disabilitas BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS nomor_whatsapp    VARCHAR(32);

      -- Most rows stay 'none'; the programme screens only list the rest.
      CREATE INDEX IF NOT EXISTS idx_usaha_talent_status
        ON usaha (talent_status) WHERE talent_status <> 'none';

      -- ── Certificates and permits per business ────────────────────────────
      CREATE TABLE IF NOT EXISTS usaha_legalitas (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usaha          UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE,
        jenis          TEXT NOT NULL CHECK (jenis IN ('halal', 'pirt', 'bpom', 'hki', 'sni', 'umku')),
        nomor          VARCHAR(128),
        status         TEXT NOT NULL DEFAULT 'dalam_proses'
                         CHECK (status IN ('dalam_proses', 'terbit', 'kedaluwarsa', 'dicabut')),
        berlaku_hingga DATE,
        berkas         UUID REFERENCES directus_files(id) ON DELETE SET NULL,
        date_created   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_usaha_legalitas_usaha ON usaha_legalitas (usaha, jenis);

      -- ── Directus collection ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('usaha_legalitas', 'verified', 'Sertifikat dan izin usaha', '{{jenis}} {{nomor}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      -- ── Directus fields ───────────────────────────────────────────────────
      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('directus_users', 'kota_scope', 'm2o', 'select-dropdown-m2o', '{"template":"{{nama}}"}', 'related-values', '{"template":"{{nama}}"}', FALSE, FALSE, NULL, 'half', NULL, 'Kab/Kota an Admin Kab/Kota account is limited to', NULL, FALSE, NULL, NULL, NULL),

        ('usaha', 'talent_status',     NULL, 'select-dropdown', '{"choices":[{"text":"Belum diajukan","value":"none"},{"text":"Diajukan","value":"nominated"},{"text":"Scouting","value":"scouting"},{"text":"Talent Pool","value":"talent_pool"},{"text":"Akselerator","value":"accelerator"},{"text":"Champion","value":"champion"}]}', 'labels', NULL, FALSE, FALSE, NULL, 'half', NULL, 'Tahap program Talent Scouting', NULL, TRUE, NULL, NULL, NULL),
        ('usaha', 'talent_batch',      NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, NULL, 'half', NULL, 'Batch program, mis. 2026-1', NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'pdn_terverifikasi', 'cast-boolean', 'boolean', NULL, 'boolean', NULL, FALSE, FALSE, NULL, 'half', NULL, 'Produk Dalam Negeri terverifikasi', NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'ramah_disabilitas', 'cast-boolean', 'boolean', NULL, 'boolean', NULL, FALSE, FALSE, NULL, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('usaha', 'nomor_whatsapp',    NULL, 'input',           NULL, NULL, NULL, FALSE, FALSE, NULL, 'half', NULL, 'Nomor WhatsApp usaha untuk katalog', NULL, FALSE, NULL, NULL, NULL),

        ('usaha_legalitas', 'id',             'uuid',         'input',           NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('usaha_legalitas', 'usaha',          'm2o',          'select-dropdown-m2o', '{"template":"{{nama}} ({{nib}})"}', 'related-values', '{"template":"{{nama}}"}', FALSE, FALSE, 2, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('usaha_legalitas', 'jenis',          NULL,           'select-dropdown', '{"choices":[{"text":"Halal","value":"halal"},{"text":"PIRT","value":"pirt"},{"text":"BPOM","value":"bpom"},{"text":"HKI","value":"hki"},{"text":"SNI","value":"sni"},{"text":"UMKU","value":"umku"}]}', 'labels', NULL, FALSE, FALSE, 3, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('usaha_legalitas', 'nomor',          NULL,           'input',           NULL, NULL, NULL, FALSE, FALSE, 4, 'half', NULL, 'Nomor sertifikat atau izin', NULL, FALSE, NULL, NULL, NULL),
        ('usaha_legalitas', 'status',         NULL,           'select-dropdown', '{"choices":[{"text":"Dalam proses","value":"dalam_proses"},{"text":"Terbit","value":"terbit"},{"text":"Kedaluwarsa","value":"kedaluwarsa"},{"text":"Dicabut","value":"dicabut"}]}', 'labels', NULL, FALSE, FALSE, 5, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('usaha_legalitas', 'berlaku_hingga', NULL,           'datetime',        NULL, 'datetime', NULL, FALSE, FALSE, 6, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('usaha_legalitas', 'berkas',         'file',         'file',            NULL, 'file', NULL, FALSE, FALSE, 7, 'full', NULL, 'Scan sertifikat', NULL, FALSE, NULL, NULL, NULL),
        ('usaha_legalitas', 'date_created',   'date-created', 'datetime',        NULL, 'datetime', NULL, TRUE, TRUE, 8, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('usaha_legalitas', 'date_updated',   'date-updated', 'datetime',        NULL, 'datetime', NULL, TRUE, TRUE, 9, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),

        ('usaha', 'legalitas', 'o2m', 'list-o2m', '{"template":"{{jenis}} {{nomor}}"}', 'related-values', '{"template":"{{jenis}}"}', FALSE, FALSE, NULL, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      -- ── Directus relations ────────────────────────────────────────────────
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('directus_users',  'kota_scope', 'kota',           NULL,        NULL, NULL, NULL, NULL, 'nullify'),
        ('usaha_legalitas', 'usaha',      'usaha',          'legalitas', NULL, NULL, NULL, NULL, 'delete'),
        ('usaha_legalitas', 'berkas',     'directus_files', NULL,        NULL, NULL, NULL, NULL, 'nullify');
    `);

    await trx.raw(
      `UPDATE directus_permissions SET fields = ?
        WHERE policy = ? AND collection = 'directus_users' AND action = 'read'`,
      [READ_FIELDS_AFTER, POLICY_ID],
    );
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `UPDATE directus_permissions SET fields = ?
        WHERE policy = ? AND collection = 'directus_users' AND action = 'read'`,
      [READ_FIELDS_BEFORE, POLICY_ID],
    );
    await trx.raw(`
      DELETE FROM directus_relations
        WHERE (many_collection, many_field) IN (
          ('directus_users', 'kota_scope'),
          ('usaha_legalitas', 'usaha'),
          ('usaha_legalitas', 'berkas')
        );

      DELETE FROM directus_fields WHERE collection = 'usaha_legalitas';
      DELETE FROM directus_fields WHERE collection = 'directus_users' AND field = 'kota_scope';
      DELETE FROM directus_fields
        WHERE collection = 'usaha'
          AND field IN ('talent_status', 'talent_batch', 'pdn_terverifikasi', 'ramah_disabilitas', 'nomor_whatsapp', 'legalitas');
      DELETE FROM directus_collections WHERE collection = 'usaha_legalitas';

      DROP TABLE IF EXISTS usaha_legalitas;
      DROP INDEX IF EXISTS idx_usaha_talent_status;

      ALTER TABLE usaha
        DROP COLUMN IF EXISTS nomor_whatsapp,
        DROP COLUMN IF EXISTS ramah_disabilitas,
        DROP COLUMN IF EXISTS pdn_terverifikasi,
        DROP COLUMN IF EXISTS talent_batch,
        DROP COLUMN IF EXISTS talent_status;

      ALTER TABLE directus_users DROP COLUMN IF EXISTS kota_scope;
    `);
  });
};
