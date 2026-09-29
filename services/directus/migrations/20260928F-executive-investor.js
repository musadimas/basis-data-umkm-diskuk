// R02: private investor data and idempotent regional risk assignments. No Public-policy grants.
const INVESTOR_ROLE_ID = "5e5d15ec-b985-4cc4-a92d-783b7b7806bb";
const INVESTOR_POLICY_ID = "89167fa4-30ad-4aec-9d97-d5256d5518df";
const INVESTOR_ACCESS_ID = "35cb707d-c99d-416a-9f93-ff7079c4f1f4";

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`INSERT INTO directus_roles (id, name, icon, description)
      VALUES (?, 'Investor Terverifikasi', 'business', 'Akun investor terpisah untuk direktori kemitraan')`, [INVESTOR_ROLE_ID]);
    await trx.raw(`INSERT INTO directus_policies (id, name, icon, description, admin_access, app_access, enforce_tfa)
      VALUES (?, 'Investor Terverifikasi', 'lock', 'Hanya identitas akun sendiri; data deal melalui API terverifikasi', FALSE, TRUE, FALSE)`, [INVESTOR_POLICY_ID]);
    await trx.raw(`INSERT INTO directus_access (id, policy, role, sort) VALUES (?, ?, ?, 1)`,
      [INVESTOR_ACCESS_ID, INVESTOR_POLICY_ID, INVESTOR_ROLE_ID]);
    await trx.raw(`INSERT INTO directus_permissions
      (collection, action, permissions, validation, presets, fields, policy)
      VALUES ('directus_users', 'read', '{"id":{"_eq":"$CURRENT_USER"}}'::jsonb,
        '{}'::jsonb, '{}'::jsonb,
        'id,email,first_name,last_name,avatar,app_role,instansi,usaha,kota_scope', ?)`,
      [INVESTOR_POLICY_ID]);
    await trx.raw(`
      CREATE TABLE investor_verifikasi (
        pengguna UUID PRIMARY KEY REFERENCES directus_users(id) ON DELETE CASCADE,
        diverifikasi_oleh UUID NOT NULL REFERENCES directus_users(id),
        diverifikasi_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        dicabut_pada TIMESTAMPTZ
      );
      CREATE TABLE investor_profil (
        usaha UUID PRIMARY KEY REFERENCES usaha(id) ON DELETE CASCADE,
        jenama VARCHAR(160) NOT NULL,
        kebutuhan_modal BIGINT CHECK (kebutuhan_modal > 0),
        skema TEXT[] NOT NULL DEFAULT '{}',
        kapasitas_pasok VARCHAR(300),
        margin_persen NUMERIC(5,2) CHECK (margin_persen BETWEEN 0 AND 100),
        margin_sumber TEXT NOT NULL DEFAULT 'deklarasi'
          CHECK (margin_sumber IN ('deklarasi', 'terverifikasi')),
        pitch_deck UUID REFERENCES directus_files(id) ON DELETE SET NULL,
        disetujui_berbagi_oleh UUID REFERENCES directus_users(id),
        disetujui_berbagi_pada TIMESTAMPTZ,
        disetujui_kurator_oleh UUID REFERENCES directus_users(id),
        disetujui_kurator_pada TIMESTAMPTZ,
        dicabut_pada TIMESTAMPTZ,
        date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT investor_profil_consent_pair CHECK (
          (disetujui_berbagi_oleh IS NULL) = (disetujui_berbagi_pada IS NULL)
        ),
        CONSTRAINT investor_profil_approval_pair CHECK (
          (disetujui_kurator_oleh IS NULL) = (disetujui_kurator_pada IS NULL)
        ),
        CONSTRAINT investor_profil_schemes CHECK (
          skema <@ ARRAY['kur','lpdb','offtaker','penyertaan_modal','konsinyasi','ekspor']::text[]
        )
      );
      CREATE INDEX idx_investor_profil_modal ON investor_profil (kebutuhan_modal)
        WHERE dicabut_pada IS NULL AND disetujui_kurator_pada IS NOT NULL;
      CREATE INDEX idx_investor_profil_skema ON investor_profil USING gin (skema);
      ALTER TABLE produk_loi ADD COLUMN investor_pengguna UUID REFERENCES directus_users(id) ON DELETE SET NULL;
      CREATE INDEX idx_produk_loi_investor ON produk_loi (investor_pengguna, date_created DESC)
        WHERE investor_pengguna IS NOT NULL;
      CREATE TABLE investor_akses_audit (
        id BIGSERIAL PRIMARY KEY,
        pengguna UUID NOT NULL REFERENCES directus_users(id),
        usaha UUID NOT NULL REFERENCES usaha(id),
        aksi TEXT NOT NULL CHECK (aksi IN ('list', 'detail', 'pdf', 'pitch_deck', 'loi')),
        diakses_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_investor_akses_audit_usaha ON investor_akses_audit (usaha, diakses_pada DESC);
      CREATE TABLE pendamping_tugas_risiko (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        peserta UUID NOT NULL REFERENCES program_peserta(id) ON DELETE CASCADE,
        pendamping UUID NOT NULL REFERENCES directus_users(id),
        minggu_akhir SMALLINT NOT NULL,
        status TEXT NOT NULL DEFAULT 'terbuka' CHECK (status IN ('terbuka','selesai')),
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (peserta, minggu_akhir)
      );
      CREATE INDEX idx_pendamping_tugas_risiko_pendamping ON pendamping_tugas_risiko (pendamping, status);
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DROP TABLE IF EXISTS pendamping_tugas_risiko;
      DROP TABLE IF EXISTS investor_akses_audit;
      DROP TABLE IF EXISTS investor_profil;
      DROP TABLE IF EXISTS investor_verifikasi;
      ALTER TABLE produk_loi DROP COLUMN IF EXISTS investor_pengguna;
    `);
    await trx.raw(`DELETE FROM directus_permissions WHERE policy = ?`, [INVESTOR_POLICY_ID]);
    await trx.raw(`DELETE FROM directus_access WHERE id = ?`, [INVESTOR_ACCESS_ID]);
    await trx.raw(`DELETE FROM directus_policies WHERE id = ?`, [INVESTOR_POLICY_ID]);
    await trx.raw(`UPDATE directus_users SET role = NULL WHERE role = ?`, [INVESTOR_ROLE_ID]);
    await trx.raw(`DELETE FROM directus_roles WHERE id = ?`, [INVESTOR_ROLE_ID]);
  });
};
