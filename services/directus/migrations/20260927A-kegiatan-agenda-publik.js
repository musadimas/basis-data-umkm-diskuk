// Y07 (Brief Fitur Modul 7.2, M7-07…M7-10): the public agenda needs its operational contract
// before the endpoint and the calendar can be proven:
//  - kategori aligned with the brief (pelatihan/bimtek, sertifikasi, pameran, akselerasi,
//    literasi digital/PMSE) instead of the placeholder list from 20260926M;
//  - the call-to-action targets per status: `registration_url` (official form), `dokumen_url`
//    (supporting documents) and `materi_url` (materials/documentation after the event);
//  - `syarat_skala`/`syarat_wilayah`/`syarat_nib` so the detail page can state the requirements
//    without hiding them in free text;
//  - `status_publikasi = 'dibatalkan'` for an event that is withdrawn after curation: it stops
//    being public and its pending reminders are cancelled by the job (race curation ↔ reminders);
//  - `kegiatan_pengingat`: opt-in, schedule and delivery status for WhatsApp/email reminders.
//    It has NO public read grant: the target address is personal data (ADR-004) and only the
//    public endpoint, which answers with a masked address, may touch it.
export const KATEGORI = ["pelatihan", "sertifikasi", "pameran", "akselerasi", "literasi_digital"];

export const KATEGORI_LAMA_KE_BARU = {
  bazar: "pameran",
  seminar: "pelatihan",
  temu_bisnis: "akselerasi",
  lainnya: "pelatihan",
};

const STATUS_PUBLIKASI = ["draft", "terbit", "dibatalkan"];

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS registration_url VARCHAR(500);
      ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS dokumen_url      VARCHAR(500);
      ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS materi_url       VARCHAR(500);
      ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS syarat_skala     VARCHAR(160);
      ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS syarat_wilayah   VARCHAR(160);
      ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS syarat_nib       BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // Categories: drop the old check, translate the placeholder values, install the new one.
    await trx.raw(`ALTER TABLE kegiatan DROP CONSTRAINT IF EXISTS kegiatan_kategori_check;`);
    for (const [lama, baru] of Object.entries(KATEGORI_LAMA_KE_BARU)) {
      await trx.raw(`UPDATE kegiatan SET kategori = ? WHERE kategori = ?`, [baru, lama]);
    }
    await trx.raw(`
      ALTER TABLE kegiatan ADD CONSTRAINT kegiatan_kategori_check
        CHECK (kategori IN (${KATEGORI.map((value) => `'${value}'`).join(", ")}));
      ALTER TABLE kegiatan DROP CONSTRAINT IF EXISTS kegiatan_status_publikasi_check;
      ALTER TABLE kegiatan ADD CONSTRAINT kegiatan_status_publikasi_check
        CHECK (status_publikasi IN (${STATUS_PUBLIKASI.map((value) => `'${value}'`).join(", ")}));
    `);

    await trx.raw(`
      CREATE TABLE IF NOT EXISTS kegiatan_pengingat (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kegiatan      UUID NOT NULL REFERENCES kegiatan(id) ON DELETE CASCADE,
        kanal         TEXT NOT NULL CHECK (kanal IN ('email', 'whatsapp')),
        tujuan        VARCHAR(160) NOT NULL,
        tujuan_masked VARCHAR(160) NOT NULL,
        jadwal_kirim  TIMESTAMPTZ NOT NULL,
        status        TEXT NOT NULL DEFAULT 'menunggu'
                        CHECK (status IN ('menunggu', 'mengirim', 'menunggu_gateway', 'terkirim', 'gagal', 'dibatalkan')),
        percobaan     INTEGER NOT NULL DEFAULT 0 CHECK (percobaan >= 0),
        provider_id   VARCHAR(200),
        alasan        VARCHAR(200),
        dikirim_at    TIMESTAMPTZ,
        dibatalkan_at TIMESTAMPTZ,
        token         UUID NOT NULL DEFAULT gen_random_uuid(),
        date_created  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      -- One opt-in per event, channel and address: a retry or a double click updates the row.
      CREATE UNIQUE INDEX IF NOT EXISTS ux_kegiatan_pengingat_tujuan ON kegiatan_pengingat (kegiatan, kanal, tujuan);
      CREATE UNIQUE INDEX IF NOT EXISTS ux_kegiatan_pengingat_token  ON kegiatan_pengingat (token);
      CREATE INDEX IF NOT EXISTS idx_kegiatan_pengingat_jadwal ON kegiatan_pengingat (status, jadwal_kirim);
    `);

    await trx.raw(`
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('kegiatan_pengingat', 'notifications', 'Pengingat WhatsApp/email (opt-in) untuk agenda publik', '{{tujuan_masked}} {{jadwal_kirim}}', FALSE, FALSE,
         NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('kegiatan', 'registration_url', NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 24, 'half', NULL,
         'Tautan pendaftaran resmi (https). Bila kosong, tombol Daftar dinonaktifkan.', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'dokumen_url',      NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 25, 'half', NULL,
         'Dokumen pendukung, mis. panduan atau syarat (https)', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'materi_url',       NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 26, 'half', NULL,
         'Materi/dokumentasi setelah acara selesai (https)', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'syarat_skala',     NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 21, 'half', NULL,
         'Skala usaha yang boleh ikut, mis. Mikro, Kecil', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'syarat_wilayah',   NULL, 'input', NULL, NULL, NULL, FALSE, FALSE, 22, 'half', NULL,
         'Wilayah peserta, mis. Kabupaten Subang', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan', 'syarat_nib',       'cast-boolean', 'boolean', NULL, 'boolean', NULL, FALSE, FALSE, 23, 'half', NULL,
         'Wajib memiliki NIB untuk mendaftar', NULL, FALSE, NULL, NULL, NULL),

        ('kegiatan_pengingat', 'id',            'uuid',          'input',           NULL, NULL, NULL, TRUE,  TRUE,  1, 'full', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'kegiatan',      NULL,            'select-dropdown-m2o', '{"template":"{{judul}}"}'::jsonb, NULL, NULL, TRUE, FALSE, 2, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'kanal',         NULL,            'select-dropdown', '{"choices":[{"text":"Email","value":"email"},{"text":"WhatsApp","value":"whatsapp"}]}', 'labels', NULL, TRUE, FALSE, 3, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'tujuan',        NULL,            'input',           NULL, NULL, NULL, TRUE,  TRUE,  4, 'half', NULL, 'Alamat tujuan (data pribadi, jangan diekspor)', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'tujuan_masked', NULL,            'input',           NULL, NULL, NULL, TRUE,  FALSE, 5, 'half', NULL, 'Tujuan tersamarkan untuk tampilan', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'jadwal_kirim',  NULL,            'datetime',        NULL, 'datetime', NULL, TRUE, FALSE, 6, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'status',        NULL,            'select-dropdown', '{"choices":[{"text":"Menunggu","value":"menunggu"},{"text":"Sedang dikirim","value":"mengirim"},{"text":"Menunggu gateway WhatsApp","value":"menunggu_gateway"},{"text":"Terkirim","value":"terkirim"},{"text":"Gagal","value":"gagal"},{"text":"Dibatalkan","value":"dibatalkan"}]}', 'labels', NULL, TRUE, FALSE, 7, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'percobaan',     NULL,            'input',           NULL, NULL, NULL, TRUE, FALSE, 8, 'half', NULL, 'Jumlah percobaan pengiriman', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'provider_id',   NULL,            'input',           NULL, NULL, NULL, TRUE, FALSE, 9, 'half', NULL, 'ID pesan dari provider (bukti kirim)', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'alasan',        NULL,            'input',           NULL, NULL, NULL, TRUE, FALSE, 10, 'half', NULL, 'Alasan status terakhir, mis. gateway_belum_tersedia', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'dikirim_at',    NULL,            'datetime',        NULL, 'datetime', NULL, TRUE, FALSE, 11, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'dibatalkan_at', NULL,            'datetime',        NULL, 'datetime', NULL, TRUE, FALSE, 12, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'token',         NULL,            'input',           NULL, NULL, NULL, TRUE,  TRUE,  13, 'half', NULL, 'Token pembatalan langganan', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'date_created',  'date-created',  'datetime',        NULL, 'datetime', NULL, TRUE, TRUE, 14, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'date_updated',  'date-updated',  'datetime',        NULL, 'datetime', NULL, TRUE, TRUE, 15, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      SELECT 'kegiatan_pengingat', 'kegiatan', 'kegiatan', NULL, NULL, NULL, NULL, NULL, 'cascade'
       WHERE NOT EXISTS (
         SELECT 1 FROM directus_relations
          WHERE many_collection = 'kegiatan_pengingat' AND many_field = 'kegiatan'
       );

      -- The Data Studio dropdowns must offer exactly the brief's categories and the new status.
      UPDATE directus_fields
         SET options = '{"choices":[{"text":"Pelatihan/Bimtek","value":"pelatihan"},{"text":"Sertifikasi","value":"sertifikasi"},{"text":"Pameran","value":"pameran"},{"text":"Akselerasi UMKM Talent","value":"akselerasi"},{"text":"Literasi Digital/PMSE","value":"literasi_digital"}]}'::jsonb
       WHERE collection = 'kegiatan' AND field = 'kategori';
      UPDATE directus_fields
         SET options = '{"choices":[{"text":"Draft","value":"draft"},{"text":"Terbit","value":"terbit"},{"text":"Dibatalkan","value":"dibatalkan"}]}'::jsonb
       WHERE collection = 'kegiatan' AND field = 'status_publikasi';
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DROP TABLE IF EXISTS kegiatan_pengingat;
      DELETE FROM directus_fields WHERE collection = 'kegiatan_pengingat';
      DELETE FROM directus_collections WHERE collection = 'kegiatan_pengingat';
      DELETE FROM directus_relations WHERE many_collection = 'kegiatan_pengingat';
      DELETE FROM directus_fields
       WHERE collection = 'kegiatan'
         AND field IN ('registration_url', 'dokumen_url', 'materi_url', 'syarat_skala', 'syarat_wilayah', 'syarat_nib');

      UPDATE directus_fields
         SET options = '{"choices":[{"text":"Pelatihan","value":"pelatihan"},{"text":"Pameran","value":"pameran"},{"text":"Bazar","value":"bazar"},{"text":"Seminar","value":"seminar"},{"text":"Temu bisnis","value":"temu_bisnis"},{"text":"Lainnya","value":"lainnya"}]}'::jsonb
       WHERE collection = 'kegiatan' AND field = 'kategori';
      UPDATE directus_fields
         SET options = '{"choices":[{"text":"Draft","value":"draft"},{"text":"Terbit","value":"terbit"}]}'::jsonb
       WHERE collection = 'kegiatan' AND field = 'status_publikasi';

      ALTER TABLE kegiatan DROP CONSTRAINT IF EXISTS kegiatan_status_publikasi_check;
      UPDATE kegiatan SET status_publikasi = 'draft' WHERE status_publikasi = 'dibatalkan';
      ALTER TABLE kegiatan ADD CONSTRAINT kegiatan_status_publikasi_check
        CHECK (status_publikasi IN ('draft', 'terbit'));

      ALTER TABLE kegiatan DROP CONSTRAINT IF EXISTS kegiatan_kategori_check;
      UPDATE kegiatan SET kategori = 'lainnya' WHERE kategori IN ('sertifikasi', 'akselerasi', 'literasi_digital');
      ALTER TABLE kegiatan ADD CONSTRAINT kegiatan_kategori_check
        CHECK (kategori IN ('pelatihan', 'pameran', 'bazar', 'seminar', 'temu_bisnis', 'lainnya'));

      ALTER TABLE kegiatan DROP COLUMN IF EXISTS syarat_nib;
      ALTER TABLE kegiatan DROP COLUMN IF EXISTS syarat_wilayah;
      ALTER TABLE kegiatan DROP COLUMN IF EXISTS syarat_skala;
      ALTER TABLE kegiatan DROP COLUMN IF EXISTS materi_url;
      ALTER TABLE kegiatan DROP COLUMN IF EXISTS dokumen_url;
      ALTER TABLE kegiatan DROP COLUMN IF EXISTS registration_url;
    `);
  });
};
