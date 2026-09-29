/**
 * Kandidat 02 langkah 3: satu outbox pesan untuk klinik dan pengingat kegiatan.
 *
 * `klinik_notifikasi` diubah namanya menjadi `notifikasi_outbox` (baris dan resi Y08 utuh) lalu
 * dilebarkan: kolom `kanal`, `pengingat`, `kedaluwarsa_pada`, `alasan`; `tiket` boleh NULL asalkan
 * tepat satu dari `tiket`/`pengingat` terisi. `kegiatan_pengingat` menjadi *langganan* murni
 * (`menunggu | dijadwalkan | dibatalkan`); riwayat kirim lama dipindahkan ke baris outbox.
 *
 * Nama berkas memakai versi `20260928H` karena `20260928A`..`G` sudah terpakai (Directus
 * mengidentifikasi migrasi lewat bagian sebelum tanda hubung pertama).
 */
const JENIS_LAMA = ["tiket_dibuat", "status_berubah", "pembatalan"];
const JENIS_BARU = [...JENIS_LAMA, "pengingat_kegiatan"];
const daftar = (items) => items.map((item) => `'${item}'`).join(", ");

const FIELD_STATUS_PENGINGAT =
  '{"choices":[{"text":"Menunggu","value":"menunggu"},{"text":"Dijadwalkan (pesan di outbox)","value":"dijadwalkan"},{"text":"Dibatalkan","value":"dibatalkan"}]}';
const FIELD_STATUS_PENGINGAT_LAMA =
  '{"choices":[{"text":"Menunggu","value":"menunggu"},{"text":"Sedang dikirim","value":"mengirim"},{"text":"Menunggu gateway WhatsApp","value":"menunggu_gateway"},{"text":"Terkirim","value":"terkirim"},{"text":"Gagal","value":"gagal"},{"text":"Dibatalkan","value":"dibatalkan"}]}';

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE klinik_notifikasi RENAME TO notifikasi_outbox;
      ALTER INDEX IF EXISTS klinik_notifikasi_pkey RENAME TO notifikasi_outbox_pkey;
      ALTER INDEX IF EXISTS klinik_notifikasi_idempotency_key_key RENAME TO notifikasi_outbox_idempotency_key_key;
      ALTER INDEX IF EXISTS idx_klinik_notifikasi_tiket RENAME TO idx_notifikasi_outbox_tiket;
      ALTER INDEX IF EXISTS ux_klinik_notifikasi_provider_id RENAME TO ux_notifikasi_outbox_provider_id;
      DROP INDEX IF EXISTS idx_klinik_notifikasi_antrean;

      ALTER TABLE notifikasi_outbox
        ADD COLUMN kanal TEXT NOT NULL DEFAULT 'whatsapp',
        ADD COLUMN pengingat UUID REFERENCES kegiatan_pengingat(id) ON DELETE CASCADE,
        ADD COLUMN kedaluwarsa_pada TIMESTAMPTZ,
        ADD COLUMN alasan VARCHAR(200);
      ALTER TABLE notifikasi_outbox
        ADD CONSTRAINT notifikasi_outbox_kanal_check CHECK (kanal IN ('whatsapp', 'email')),
        ALTER COLUMN tiket DROP NOT NULL,
        ADD CONSTRAINT notifikasi_outbox_sumber_check CHECK (num_nonnulls(tiket, pengingat) = 1),
        ALTER COLUMN tujuan TYPE VARCHAR(160),
        DROP CONSTRAINT IF EXISTS klinik_notifikasi_jenis_check,
        ADD CONSTRAINT notifikasi_outbox_jenis_check CHECK (jenis IN (${daftar(JENIS_BARU)}));
      ALTER TABLE notifikasi_outbox RENAME CONSTRAINT klinik_notifikasi_status_check TO notifikasi_outbox_status_check;

      -- Index klaim: dispatcher hanya mengklaim kanal yang punya adapter (invarian 3).
      CREATE INDEX idx_notifikasi_outbox_antrean ON notifikasi_outbox (status, kanal, next_attempt_at)
        WHERE status IN ('pending', 'mengirim');
      CREATE INDEX idx_notifikasi_outbox_pengingat ON notifikasi_outbox (pengingat) WHERE pengingat IS NOT NULL;
    `);

    // Riwayat kirim lama pindah ke outbox sebelum status langganan dipersempit. Pesan yang
    // sedang berjalan (`mengirim`/`menunggu_gateway`) belum terkirim: kembali `menunggu` supaya
    // diantrekan ulang saat jatuh tempo, dengan pesan yang dirender saat itu (keputusan 4).
    await trx.raw(`
      ALTER TABLE kegiatan_pengingat DROP CONSTRAINT IF EXISTS kegiatan_pengingat_status_check;
      UPDATE kegiatan_pengingat SET status = 'menunggu' WHERE status IN ('mengirim', 'menunggu_gateway');

      INSERT INTO notifikasi_outbox
        (pengingat, kanal, jenis, tujuan, consent, template, payload, status, attempts, last_error,
         provider_message_id, idempotency_key, next_attempt_at, terkirim_at, alasan, date_created)
      SELECT p.id, p.kanal, 'pengingat_kegiatan', p.tujuan, TRUE, 'pengingat_kegiatan', '{}'::jsonb,
             CASE p.status WHEN 'terkirim' THEN 'terkirim' ELSE 'gagal' END,
             p.percobaan, CASE p.status WHEN 'gagal' THEN COALESCE(p.alasan, 'migrasi_riwayat') END,
             p.provider_id,
             'pengingat:' || p.id || ':' || to_char(p.jadwal_kirim AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             p.jadwal_kirim, p.dikirim_at, 'migrasi_riwayat', p.date_created
        FROM kegiatan_pengingat p
       WHERE p.status IN ('terkirim', 'gagal')
      ON CONFLICT DO NOTHING;

      UPDATE kegiatan_pengingat SET status = 'dijadwalkan' WHERE status IN ('terkirim', 'gagal');
      ALTER TABLE kegiatan_pengingat
        ADD CONSTRAINT kegiatan_pengingat_status_check CHECK (status IN ('menunggu', 'dijadwalkan', 'dibatalkan'));
    `);

    await trx.raw(`
      UPDATE directus_collections
         SET collection = 'notifikasi_outbox', note = 'Outbox pesan (WhatsApp/email) untuk Klinik dan pengingat kegiatan'
       WHERE collection = 'klinik_notifikasi';
      UPDATE directus_fields SET collection = 'notifikasi_outbox' WHERE collection = 'klinik_notifikasi';
      UPDATE directus_relations SET many_collection = 'notifikasi_outbox' WHERE many_collection = 'klinik_notifikasi';
      UPDATE directus_permissions SET collection = 'notifikasi_outbox' WHERE collection = 'klinik_notifikasi';
      UPDATE directus_presets SET collection = 'notifikasi_outbox' WHERE collection = 'klinik_notifikasi';

      UPDATE directus_fields SET required = FALSE WHERE collection = 'notifikasi_outbox' AND field = 'tiket';
      UPDATE directus_fields SET note = 'Nomor/alamat tujuan, tidak ditampilkan penuh di UI'
       WHERE collection = 'notifikasi_outbox' AND field = 'tujuan';

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('notifikasi_outbox', 'kanal',            NULL, 'select-dropdown', '{"choices":[{"text":"WhatsApp","value":"whatsapp"},{"text":"Email","value":"email"}]}', 'labels', NULL, TRUE, FALSE, 22, 'half', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
        ('notifikasi_outbox', 'pengingat',        'm2o', 'select-dropdown-m2o', NULL, NULL, NULL, TRUE, FALSE, 23, 'half', NULL, 'Langganan pengingat kegiatan (sumber pesan, bila bukan tiket)', NULL, FALSE, NULL, NULL, NULL),
        ('notifikasi_outbox', 'kedaluwarsa_pada', NULL, 'datetime', NULL, 'datetime', NULL, TRUE, FALSE, 24, 'half', NULL, 'Lewat waktu ini pesan tidak dikirim lagi', NULL, FALSE, NULL, NULL, NULL),
        ('notifikasi_outbox', 'alasan',           NULL, 'input', NULL, NULL, NULL, TRUE, FALSE, 25, 'half', NULL, 'Alasan status terakhir, mis. kedaluwarsa', NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      SELECT 'notifikasi_outbox', 'pengingat', 'kegiatan_pengingat', NULL, NULL, NULL, NULL, NULL, 'cascade'
       WHERE NOT EXISTS (
         SELECT 1 FROM directus_relations WHERE many_collection = 'notifikasi_outbox' AND many_field = 'pengingat'
       );

      UPDATE directus_fields SET options = '${FIELD_STATUS_PENGINGAT}'::jsonb
       WHERE collection = 'kegiatan_pengingat' AND field = 'status';
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    // Status langganan dikembalikan dari pesan outbox-nya sebelum baris pesan pengingat dibuang.
    await trx.raw(`
      ALTER TABLE kegiatan_pengingat DROP CONSTRAINT IF EXISTS kegiatan_pengingat_status_check;
      UPDATE kegiatan_pengingat p
         SET status = CASE
               WHEN o.status IN ('terkirim', 'diterima') THEN 'terkirim'
               WHEN o.status = 'gagal' THEN 'gagal'
               WHEN o.status = 'batal' THEN 'dibatalkan'
               ELSE 'menunggu'
             END
        FROM (
          SELECT DISTINCT ON (pengingat) pengingat, status
            FROM notifikasi_outbox WHERE pengingat IS NOT NULL
           ORDER BY pengingat, date_created DESC
        ) o
       WHERE p.id = o.pengingat AND p.status = 'dijadwalkan';
      UPDATE kegiatan_pengingat SET status = 'menunggu' WHERE status = 'dijadwalkan';
      ALTER TABLE kegiatan_pengingat
        ADD CONSTRAINT kegiatan_pengingat_status_check
        CHECK (status IN ('menunggu', 'mengirim', 'menunggu_gateway', 'terkirim', 'gagal', 'dibatalkan'));
    `);

    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection = 'notifikasi_outbox' AND many_field = 'pengingat';
      DELETE FROM directus_fields
       WHERE collection = 'notifikasi_outbox' AND field IN ('kanal', 'pengingat', 'kedaluwarsa_pada', 'alasan');
      UPDATE directus_fields SET required = TRUE WHERE collection = 'notifikasi_outbox' AND field = 'tiket';
      UPDATE directus_fields SET note = 'Nomor tujuan, tidak ditampilkan penuh di UI'
       WHERE collection = 'notifikasi_outbox' AND field = 'tujuan';
      UPDATE directus_fields SET options = '${FIELD_STATUS_PENGINGAT_LAMA}'::jsonb
       WHERE collection = 'kegiatan_pengingat' AND field = 'status';

      UPDATE directus_collections
         SET collection = 'klinik_notifikasi', note = 'Antrean notifikasi WhatsApp Klinik Konsultasi'
       WHERE collection = 'notifikasi_outbox';
      UPDATE directus_fields SET collection = 'klinik_notifikasi' WHERE collection = 'notifikasi_outbox';
      UPDATE directus_relations SET many_collection = 'klinik_notifikasi' WHERE many_collection = 'notifikasi_outbox';
      UPDATE directus_permissions SET collection = 'klinik_notifikasi' WHERE collection = 'notifikasi_outbox';
      UPDATE directus_presets SET collection = 'klinik_notifikasi' WHERE collection = 'notifikasi_outbox';
    `);

    // Pesan pengingat (tiket NULL, email) tidak punya tempat di skema lama.
    await trx.raw(`
      DELETE FROM notifikasi_outbox WHERE tiket IS NULL;
      DROP INDEX IF EXISTS idx_notifikasi_outbox_pengingat;
      DROP INDEX IF EXISTS idx_notifikasi_outbox_antrean;
      ALTER TABLE notifikasi_outbox
        DROP CONSTRAINT notifikasi_outbox_sumber_check,
        DROP CONSTRAINT notifikasi_outbox_kanal_check,
        DROP CONSTRAINT notifikasi_outbox_jenis_check,
        DROP COLUMN pengingat,
        DROP COLUMN kanal,
        DROP COLUMN kedaluwarsa_pada,
        DROP COLUMN alasan,
        ALTER COLUMN tiket SET NOT NULL,
        ALTER COLUMN tujuan TYPE VARCHAR(32),
        ADD CONSTRAINT klinik_notifikasi_jenis_check CHECK (jenis IN (${daftar(JENIS_LAMA)}));
      ALTER TABLE notifikasi_outbox RENAME CONSTRAINT notifikasi_outbox_status_check TO klinik_notifikasi_status_check;
      ALTER INDEX IF EXISTS notifikasi_outbox_pkey RENAME TO klinik_notifikasi_pkey;
      ALTER INDEX IF EXISTS notifikasi_outbox_idempotency_key_key RENAME TO klinik_notifikasi_idempotency_key_key;
      ALTER INDEX IF EXISTS idx_notifikasi_outbox_tiket RENAME TO idx_klinik_notifikasi_tiket;
      ALTER INDEX IF EXISTS ux_notifikasi_outbox_provider_id RENAME TO ux_klinik_notifikasi_provider_id;
      CREATE INDEX idx_klinik_notifikasi_antrean ON notifikasi_outbox (status, next_attempt_at) WHERE status IN ('pending', 'mengirim');
      ALTER TABLE notifikasi_outbox RENAME TO klinik_notifikasi;
    `);
  });
};
