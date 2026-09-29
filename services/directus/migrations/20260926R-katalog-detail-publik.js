// Y06/M7-01…M7-05: data for the public catalogue detail, all inside the ADR-006 public-read
// model (allowlist fields, item filters, no PII).
//  - `kota` gets a public read grant (id, nama) limited to Jawa Barat. The catalogue's region
//    filter must offer the 27 kabupaten/kota, not only the regions that already have products.
//  - `produk` copies NIB and the valid certificate numbers from `usaha`/`usaha_legalitas` through
//    the snapshot trigger, so the detail page can show legality status/number without ever
//    granting read on `usaha` (ADR-006 decision 5).
//  - `produk_loi` gains the contact-consent flag and a client idempotency key: a double click or a
//    retry stores ONE letter of intent.
export const JAWA_BARAT = "JAWA BARAT";
export const KOTA_PUBLIC_FIELDS = "id,nama";
export const KOTA_PUBLIC_PERMISSIONS = JSON.stringify({ provinsi: { nama: { _eq: JAWA_BARAT } } });
export const PRODUK_DETAIL_FIELDS = ["usaha_nib", "usaha_legalitas"];

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE produk ADD COLUMN IF NOT EXISTS usaha_nib VARCHAR(255);
      ALTER TABLE produk ADD COLUMN IF NOT EXISTS usaha_legalitas JSONB NOT NULL DEFAULT '[]'::jsonb;

      -- ── Public copy of business attributes, now with NIB and certificate numbers ──
      CREATE OR REPLACE FUNCTION produk_usaha_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        SELECT u.nama, u.nib, u.skala, u.talent_status, u.pdn_terverifikasi, u.ramah_disabilitas, u.nomor_whatsapp,
               ko.id, ko.nama,
               COALESCE((SELECT ',' || string_agg(DISTINCT l.jenis, ',' ORDER BY l.jenis) || ','
                           FROM usaha_legalitas l
                          WHERE l.usaha = u.id AND l.status = 'terbit'
                            AND (l.berlaku_hingga IS NULL OR l.berlaku_hingga >= CURRENT_DATE)), ''),
               COALESCE((SELECT jsonb_agg(jsonb_build_object('jenis', l.jenis, 'nomor', l.nomor,
                                                            'berlakuHingga', l.berlaku_hingga) ORDER BY l.jenis)
                           FROM usaha_legalitas l
                          WHERE l.usaha = u.id AND l.status = 'terbit'
                            AND (l.berlaku_hingga IS NULL OR l.berlaku_hingga >= CURRENT_DATE)), '[]'::jsonb)
          INTO NEW.usaha_nama, NEW.usaha_nib, NEW.usaha_skala, NEW.usaha_talent_status, NEW.usaha_pdn,
               NEW.usaha_ramah_disabilitas, NEW.usaha_whatsapp, NEW.usaha_kota, NEW.usaha_kota_nama,
               NEW.usaha_sertifikasi, NEW.usaha_legalitas
          FROM usaha u
          LEFT JOIN alamat a     ON a.id = u.alamat
          LEFT JOIN kelurahan kl ON kl.id = a.kelurahan
          LEFT JOIN kecamatan kc ON kc.id = kl.kecamatan
          LEFT JOIN kota ko      ON ko.id = kc.kota
         WHERE u.id = NEW.usaha;
        RETURN NEW;
      END $$;

      -- NIB is part of the public copy, so changes to it must re-run the snapshot too.
      DROP TRIGGER IF EXISTS trg_usaha_refresh_produk ON usaha;
      CREATE TRIGGER trg_usaha_refresh_produk
        AFTER UPDATE OF nama, nib, skala, talent_status, pdn_terverifikasi, ramah_disabilitas, nomor_whatsapp, alamat ON usaha
        FOR EACH ROW
        WHEN ((OLD.nama, OLD.nib, OLD.skala, OLD.talent_status, OLD.pdn_terverifikasi, OLD.ramah_disabilitas, OLD.nomor_whatsapp, OLD.alamat)
              IS DISTINCT FROM
              (NEW.nama, NEW.nib, NEW.skala, NEW.talent_status, NEW.pdn_terverifikasi, NEW.ramah_disabilitas, NEW.nomor_whatsapp, NEW.alamat))
        EXECUTE FUNCTION produk_refresh_usaha();

      -- ── Letters of intent: consent and idempotency ─────────────────────
      ALTER TABLE produk_loi ADD COLUMN IF NOT EXISTS persetujuan_kontak BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE produk_loi ADD COLUMN IF NOT EXISTS idempotency_key UUID;
      ALTER TABLE produk_loi ADD COLUMN IF NOT EXISTS ip_hash CHAR(64);
      CREATE UNIQUE INDEX IF NOT EXISTS ux_produk_loi_idempotency ON produk_loi (idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_produk_loi_ip ON produk_loi (ip_hash, date_created DESC);

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('produk', 'usaha_nib',       NULL, 'input', NULL, NULL, NULL, TRUE, FALSE, 26, 'half', NULL,
         'Disalin otomatis dari usaha', NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'usaha_legalitas', 'cast-json', 'list', NULL, NULL, NULL, TRUE, TRUE, 27, 'half', NULL,
         'Sertifikat terbit beserta nomornya', NULL, FALSE, NULL, NULL, NULL),
        ('produk_loi', 'persetujuan_kontak', 'cast-boolean', 'boolean', NULL, 'boolean', NULL, TRUE, FALSE, 11, 'half', NULL,
         'Pembeli menyetujui dihubungi kembali', NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;
    `);

    // Public read on the region reference table, limited to Jawa Barat: the catalogue filter
    // offers every kabupaten/kota even when no product is published there yet.
    await trx.raw(
      `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
       SELECT ?, 'read', ?::jsonb, '{}'::jsonb, '{}'::jsonb, ?, a.policy
         FROM directus_access a
        WHERE a.role IS NULL AND a."user" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM directus_permissions p
             WHERE p.policy = a.policy AND p.collection = ? AND p.action = 'read'
          )`,
      ["kota", KOTA_PUBLIC_PERMISSIONS, KOTA_PUBLIC_FIELDS, "kota"],
    );

    // produk already has a public read grant (20260926K); widen its allowlist with the detail fields.
    await trx.raw(
      `UPDATE directus_permissions
          SET fields = fields || ',usaha_nib,usaha_legalitas'
        WHERE collection = 'produk' AND action = 'read'
          AND fields NOT LIKE '%usaha_nib%'
          AND policy IN (SELECT policy FROM directus_access WHERE role IS NULL AND "user" IS NULL)`,
    );
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `UPDATE directus_permissions
          SET fields = replace(fields, ',usaha_nib,usaha_legalitas', '')
        WHERE collection = 'produk' AND action = 'read'
          AND policy IN (SELECT policy FROM directus_access WHERE role IS NULL AND "user" IS NULL)`,
    );
    await trx.raw(
      `DELETE FROM directus_permissions
        WHERE collection = 'kota' AND action = 'read'
          AND policy IN (SELECT policy FROM directus_access WHERE role IS NULL AND "user" IS NULL)`,
    );
    await trx.raw(`
      DELETE FROM directus_fields WHERE collection = 'produk_loi' AND field = 'persetujuan_kontak';
      DELETE FROM directus_fields WHERE collection = 'produk' AND field IN ('usaha_nib', 'usaha_legalitas');
      DROP INDEX IF EXISTS ux_produk_loi_idempotency;
      DROP INDEX IF EXISTS idx_produk_loi_ip;
      ALTER TABLE produk_loi DROP COLUMN IF EXISTS ip_hash;
      ALTER TABLE produk_loi DROP COLUMN IF EXISTS idempotency_key;
      ALTER TABLE produk_loi DROP COLUMN IF EXISTS persetujuan_kontak;
      ALTER TABLE produk DROP COLUMN IF EXISTS usaha_legalitas;
      ALTER TABLE produk DROP COLUMN IF EXISTS usaha_nib;
    `);
  });
};
