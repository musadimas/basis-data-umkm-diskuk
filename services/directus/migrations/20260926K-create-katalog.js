// Brief Fitur Phase 6.1 (Modul 7, Katalog): products with curation, their photos and buyer
// letters of intent. The public catalogue reads through the Directus Public policy (ADR-006),
// so everything a visitor filters on is copied from usaha onto produk by triggers; usaha itself
// is never public.
const KATALOG_FOLDER_ID = "6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10";
const PUBLISHED = '{"_in":["tayang","rekomendasi_marketplace"]}';

const PUBLIC_GRANTS = [
  {
    collection: "produk",
    permissions: `{"status_kurasi":${PUBLISHED}}`,
    fields:
      "id,nama,deskripsi,kategori,kbli,harga_retail,harga_grosir,moq,video_url,dimensi,berat,shelf_life," +
      "bahan_baku,tkdn_persen,kapasitas_bulanan,lead_time,persen_bahan_lokal,pdn_deklarasi,status_kurasi,foto," +
      "usaha_nama,usaha_skala,usaha_talent_status,usaha_pdn,usaha_ramah_disabilitas,usaha_whatsapp," +
      "usaha_kota,usaha_kota_nama,usaha_sertifikasi,date_created",
  },
  {
    collection: "produk_foto",
    permissions: `{"produk_id":{"status_kurasi":${PUBLISHED}}}`,
    fields: "id,produk_id,directus_files_id,sort",
  },
  {
    collection: "directus_files",
    permissions: `{"folder":{"_eq":"${KATALOG_FOLDER_ID}"}}`,
    fields: "id,title,type,width,height,filename_download",
  },
];

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `INSERT INTO directus_folders (id, name, parent) VALUES (?, 'Katalog Publik', NULL) ON CONFLICT (id) DO NOTHING`,
      [KATALOG_FOLDER_ID],
    );

    await trx.raw(`
      CREATE TABLE IF NOT EXISTS produk (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usaha                   UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE,
        nama                    VARCHAR(160) NOT NULL,
        deskripsi               TEXT,
        kategori                VARCHAR(64),
        kbli                    VARCHAR(16),
        harga_retail            BIGINT CHECK (harga_retail >= 0),
        harga_grosir            BIGINT CHECK (harga_grosir >= 0),
        moq                     INTEGER CHECK (moq >= 1),
        video_url               VARCHAR(500),
        dimensi                 VARCHAR(100),
        berat                   VARCHAR(50),
        shelf_life              VARCHAR(50),
        bahan_baku              TEXT,
        tkdn_persen             NUMERIC(5, 2) CHECK (tkdn_persen BETWEEN 0 AND 100),
        kapasitas_bulanan       VARCHAR(100),
        lead_time               VARCHAR(100),
        persen_bahan_lokal      NUMERIC(5, 2) CHECK (persen_bahan_lokal BETWEEN 0 AND 100),
        pdn_deklarasi           BOOLEAN NOT NULL DEFAULT FALSE,
        status_kurasi           TEXT NOT NULL DEFAULT 'menunggu'
                                  CHECK (status_kurasi IN ('menunggu', 'tayang', 'rekomendasi_marketplace', 'ditolak')),
        catatan_kurasi          TEXT,
        dikurasi_oleh           UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        dikurasi_at             TIMESTAMPTZ,
        -- Public copy of the business attributes the catalogue shows and filters on.
        usaha_nama              VARCHAR(255),
        usaha_skala             TEXT,
        usaha_talent_status     TEXT,
        usaha_pdn               BOOLEAN NOT NULL DEFAULT FALSE,
        usaha_ramah_disabilitas BOOLEAN NOT NULL DEFAULT FALSE,
        usaha_whatsapp          VARCHAR(32),
        usaha_kota              INTEGER REFERENCES kota(id) ON DELETE SET NULL,
        usaha_kota_nama         VARCHAR(255),
        -- Valid certificates as ",halal,pirt," so a public "_contains" filter matches whole words.
        usaha_sertifikasi       VARCHAR(64) NOT NULL DEFAULT '',
        date_created            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_produk_usaha ON produk (usaha);
      CREATE INDEX IF NOT EXISTS idx_produk_status ON produk (status_kurasi, date_created DESC);

      CREATE TABLE IF NOT EXISTS produk_foto (
        id                SERIAL PRIMARY KEY,
        produk_id         UUID NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
        directus_files_id UUID NOT NULL REFERENCES directus_files(id) ON DELETE CASCADE,
        sort              INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_produk_foto_produk ON produk_foto (produk_id, sort);

      CREATE TABLE IF NOT EXISTS produk_loi (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        produk       UUID NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
        nama         VARCHAR(120) NOT NULL,
        instansi     VARCHAR(160),
        email        VARCHAR(160) NOT NULL,
        telepon      VARCHAR(32),
        jumlah       VARCHAR(100),
        pesan        TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'ditindaklanjuti', 'ditutup')),
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_produk_loi_created ON produk_loi (date_created DESC);

      -- ── At most five photos per product ─────────────────────────────────
      CREATE OR REPLACE FUNCTION produk_foto_limit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF (SELECT COUNT(*) FROM produk_foto WHERE produk_id = NEW.produk_id) >= 5 THEN
          RAISE EXCEPTION 'A product has at most 5 photos' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS trg_produk_foto_limit ON produk_foto;
      CREATE TRIGGER trg_produk_foto_limit BEFORE INSERT ON produk_foto
        FOR EACH ROW EXECUTE FUNCTION produk_foto_limit();

      -- ── Public copy of business attributes ──────────────────────────────
      CREATE OR REPLACE FUNCTION produk_usaha_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        SELECT u.nama, u.skala, u.talent_status, u.pdn_terverifikasi, u.ramah_disabilitas, u.nomor_whatsapp,
               ko.id, ko.nama,
               COALESCE((SELECT ',' || string_agg(DISTINCT l.jenis, ',' ORDER BY l.jenis) || ','
                           FROM usaha_legalitas l
                          WHERE l.usaha = u.id AND l.status = 'terbit'
                            AND (l.berlaku_hingga IS NULL OR l.berlaku_hingga >= CURRENT_DATE)), '')
          INTO NEW.usaha_nama, NEW.usaha_skala, NEW.usaha_talent_status, NEW.usaha_pdn,
               NEW.usaha_ramah_disabilitas, NEW.usaha_whatsapp, NEW.usaha_kota, NEW.usaha_kota_nama,
               NEW.usaha_sertifikasi
          FROM usaha u
          LEFT JOIN alamat a     ON a.id = u.alamat
          LEFT JOIN kelurahan kl ON kl.id = a.kelurahan
          LEFT JOIN kecamatan kc ON kc.id = kl.kecamatan
          LEFT JOIN kota ko      ON ko.id = kc.kota
         WHERE u.id = NEW.usaha;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS trg_produk_usaha_snapshot ON produk;
      CREATE TRIGGER trg_produk_usaha_snapshot BEFORE INSERT OR UPDATE OF usaha ON produk
        FOR EACH ROW EXECUTE FUNCTION produk_usaha_snapshot();

      -- Listing "usaha" in SET re-runs the snapshot trigger for that business's products.
      CREATE OR REPLACE FUNCTION produk_refresh_usaha() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_TABLE_NAME = 'usaha' THEN
          UPDATE produk SET usaha = usaha WHERE usaha = NEW.id;
          RETURN NULL;
        END IF;
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
          UPDATE produk SET usaha = usaha WHERE usaha = OLD.usaha;
        END IF;
        IF TG_OP IN ('INSERT', 'UPDATE') THEN
          UPDATE produk SET usaha = usaha WHERE usaha = NEW.usaha;
        END IF;
        RETURN NULL;
      END $$;
      DROP TRIGGER IF EXISTS trg_usaha_refresh_produk ON usaha;
      CREATE TRIGGER trg_usaha_refresh_produk
        AFTER UPDATE OF nama, skala, talent_status, pdn_terverifikasi, ramah_disabilitas, nomor_whatsapp, alamat ON usaha
        FOR EACH ROW
        WHEN ((OLD.nama, OLD.skala, OLD.talent_status, OLD.pdn_terverifikasi, OLD.ramah_disabilitas, OLD.nomor_whatsapp, OLD.alamat)
              IS DISTINCT FROM
              (NEW.nama, NEW.skala, NEW.talent_status, NEW.pdn_terverifikasi, NEW.ramah_disabilitas, NEW.nomor_whatsapp, NEW.alamat))
        EXECUTE FUNCTION produk_refresh_usaha();
      DROP TRIGGER IF EXISTS trg_usaha_legalitas_refresh_produk ON usaha_legalitas;
      CREATE TRIGGER trg_usaha_legalitas_refresh_produk AFTER INSERT OR UPDATE OR DELETE ON usaha_legalitas
        FOR EACH ROW EXECUTE FUNCTION produk_refresh_usaha();

      -- ── Directus metadata ───────────────────────────────────────────────
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('produk',      'inventory_2', 'Katalog produk UMKM (tayang publik setelah kurasi)', '{{nama}} · {{usaha_nama}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('produk_foto', 'import_export', NULL, NULL, TRUE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('produk_loi',  'handshake', 'Letter of Intent dari calon pembeli (formulir katalog publik)', '{{nama}} · {{produk.nama}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('produk', 'id',                      'uuid',         'input',               NULL, NULL, NULL, TRUE,  TRUE,  1,  'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'usaha',                   'm2o',          'select-dropdown-m2o', '{"template":"{{nama}} ({{nib}})"}', 'related-values', '{"template":"{{nama}}"}', FALSE, FALSE, 2, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('produk', 'nama',                    NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 3,  'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('produk', 'status_kurasi',           NULL,           'select-dropdown',     '{"choices":[{"text":"Menunggu kurasi","value":"menunggu"},{"text":"Tayang","value":"tayang"},{"text":"Rekomendasi marketplace","value":"rekomendasi_marketplace"},{"text":"Ditolak","value":"ditolak"}]}', 'labels', NULL, FALSE, FALSE, 4, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('produk', 'kategori',                NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 5,  'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'deskripsi',               NULL,           'input-multiline',     NULL, NULL, NULL, FALSE, FALSE, 6,  'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'foto',                    'm2m',          'files',               '{"folder":"${KATALOG_FOLDER_ID}"}', 'related-values', NULL, FALSE, FALSE, 7, 'full', NULL, 'Maksimal 5 foto', NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'kbli',                    NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 8,  'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'harga_retail',            NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 9,  'half', NULL, 'Rp', NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'harga_grosir',            NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 10, 'half', NULL, 'Rp', NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'moq',                     NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 11, 'half', NULL, 'Minimum order quantity', NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'video_url',               NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 12, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'dimensi',                 NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 13, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'berat',                   NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 14, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'shelf_life',              NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 15, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'bahan_baku',              NULL,           'input-multiline',     NULL, NULL, NULL, FALSE, FALSE, 16, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'tkdn_persen',             NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 17, 'half', NULL, '%', NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'persen_bahan_lokal',      NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 18, 'half', NULL, '%', NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'kapasitas_bulanan',       NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 19, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'lead_time',               NULL,           'input',               NULL, NULL, NULL, FALSE, FALSE, 20, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'pdn_deklarasi',           'cast-boolean', 'boolean',             NULL, 'boolean', NULL, FALSE, FALSE, 21, 'half', NULL, 'Deklarasi mandiri Produk Dalam Negeri', NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'catatan_kurasi',          NULL,           'input-multiline',     NULL, NULL, NULL, FALSE, FALSE, 22, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'dikurasi_oleh',           'm2o',          'select-dropdown-m2o', NULL, 'user', NULL, TRUE, FALSE, 23, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'dikurasi_at',             NULL,           'datetime',            NULL, 'datetime', NULL, TRUE, FALSE, 24, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'usaha_nama',              NULL,           'input',               NULL, NULL, NULL, TRUE, FALSE, 25, 'half', NULL, 'Disalin otomatis dari usaha', NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'usaha_skala',             NULL,           'input',               NULL, NULL, NULL, TRUE, TRUE, 26, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'usaha_talent_status',     NULL,           'input',               NULL, NULL, NULL, TRUE, TRUE, 27, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'usaha_pdn',               'cast-boolean', 'boolean',             NULL, NULL, NULL, TRUE, TRUE, 28, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'usaha_ramah_disabilitas', 'cast-boolean', 'boolean',             NULL, NULL, NULL, TRUE, TRUE, 29, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'usaha_whatsapp',          NULL,           'input',               NULL, NULL, NULL, TRUE, TRUE, 30, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'usaha_kota',              NULL,           'input',               NULL, NULL, NULL, TRUE, TRUE, 31, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'usaha_kota_nama',         NULL,           'input',               NULL, NULL, NULL, TRUE, TRUE, 32, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'usaha_sertifikasi',       NULL,           'input',               NULL, NULL, NULL, TRUE, TRUE, 33, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'date_created',            'date-created', 'datetime',            NULL, 'datetime', NULL, TRUE, TRUE, 34, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk', 'date_updated',            'date-updated', 'datetime',            NULL, 'datetime', NULL, TRUE, TRUE, 35, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),

        ('produk_foto', 'id',                NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 1, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk_foto', 'produk_id',         NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 2, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk_foto', 'directus_files_id', NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 3, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk_foto', 'sort',              NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, 4, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),

        ('produk_loi', 'id',           'uuid',         'input',               NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk_loi', 'produk',       'm2o',          'select-dropdown-m2o', '{"template":"{{nama}}"}', 'related-values', '{"template":"{{nama}}"}', TRUE, FALSE, 2, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('produk_loi', 'status',       NULL,           'select-dropdown',     '{"choices":[{"text":"Baru","value":"baru"},{"text":"Ditindaklanjuti","value":"ditindaklanjuti"},{"text":"Ditutup","value":"ditutup"}]}', 'labels', NULL, FALSE, FALSE, 3, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('produk_loi', 'nama',         NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 4, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('produk_loi', 'instansi',     NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 5, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk_loi', 'email',        NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 6, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('produk_loi', 'telepon',      NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 7, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('produk_loi', 'jumlah',       NULL,           'input',               NULL, NULL, NULL, TRUE,  FALSE, 8, 'half', NULL, 'Perkiraan jumlah pesanan', NULL, FALSE, NULL, NULL, NULL),
        ('produk_loi', 'pesan',        NULL,           'input-multiline',     NULL, NULL, NULL, TRUE,  FALSE, 9, 'full', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('produk_loi', 'date_created', 'date-created', 'datetime',            NULL, 'datetime', NULL, TRUE, FALSE, 10, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('produk',      'usaha',             'usaha',          NULL,   NULL, NULL, NULL,                NULL,   'nullify'),
        ('produk',      'dikurasi_oleh',     'directus_users', NULL,   NULL, NULL, NULL,                NULL,   'nullify'),
        ('produk_foto', 'produk_id',         'produk',         'foto', NULL, NULL, 'directus_files_id', 'sort', 'delete'),
        ('produk_foto', 'directus_files_id', 'directus_files', NULL,   NULL, NULL, 'produk_id',         NULL,   'nullify'),
        ('produk_loi',  'produk',            'produk',         NULL,   NULL, NULL, NULL,                NULL,   'delete');
    `);

    // Public read grants (ADR-006): explicit field allowlists, published items only.
    for (const grant of PUBLIC_GRANTS) {
      await trx.raw(
        `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
         SELECT ?, 'read', ?::jsonb, '{}'::jsonb, '{}'::jsonb, ?, a.policy
           FROM directus_access a
          WHERE a.role IS NULL AND a."user" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM directus_permissions p
               WHERE p.policy = a.policy AND p.collection = ? AND p.action = 'read'
            )`,
        [grant.collection, grant.permissions, grant.fields, grant.collection],
      );
    }
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    for (const grant of PUBLIC_GRANTS) {
      await trx.raw(
        `DELETE FROM directus_permissions
          WHERE collection = ? AND action = 'read' AND fields = ?
            AND policy IN (SELECT policy FROM directus_access WHERE role IS NULL AND "user" IS NULL)`,
        [grant.collection, grant.fields],
      );
    }
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection IN ('produk', 'produk_foto', 'produk_loi');
      DELETE FROM directus_fields WHERE collection IN ('produk', 'produk_foto', 'produk_loi');
      DELETE FROM directus_collections WHERE collection IN ('produk', 'produk_foto', 'produk_loi');

      DROP TRIGGER IF EXISTS trg_usaha_legalitas_refresh_produk ON usaha_legalitas;
      DROP TRIGGER IF EXISTS trg_usaha_refresh_produk ON usaha;
      DROP TABLE IF EXISTS produk_loi;
      DROP TABLE IF EXISTS produk_foto;
      DROP TABLE IF EXISTS produk;
      DROP FUNCTION IF EXISTS produk_refresh_usaha();
      DROP FUNCTION IF EXISTS produk_usaha_snapshot();
      DROP FUNCTION IF EXISTS produk_foto_limit();
    `);
    await trx.raw(`DELETE FROM directus_folders WHERE id = ?`, [KATALOG_FOLDER_ID]);
  });
};
