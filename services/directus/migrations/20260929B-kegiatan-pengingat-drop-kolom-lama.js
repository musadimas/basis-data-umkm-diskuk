/**
 * Kandidat 02 langkah 8: sisa kolom kirim `kegiatan_pengingat`.
 *
 * Sejak `20260928H` tabel ini hanyalah *langganan* (`menunggu | dijadwalkan | dibatalkan`);
 * percobaan, ID provider, dan waktu kirim hidup di `notifikasi_outbox` (`attempts`,
 * `provider_message_id`, `terkirim_at`). Riwayat lama sudah disalin oleh `20260928H` sebelum
 * kolomnya dibuang di sini, jadi migrasi ini tidak kehilangan data yang masih dipakai.
 * `alasan` dan `dibatalkan_at` tetap: `optInPengingat` dan pembatalan masih menulisnya.
 */
export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE kegiatan_pengingat
        DROP COLUMN IF EXISTS percobaan,
        DROP COLUMN IF EXISTS provider_id,
        DROP COLUMN IF EXISTS dikirim_at;
      DELETE FROM directus_fields
       WHERE collection = 'kegiatan_pengingat' AND field IN ('percobaan', 'provider_id', 'dikirim_at');
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE kegiatan_pengingat
        ADD COLUMN IF NOT EXISTS percobaan INTEGER NOT NULL DEFAULT 0 CHECK (percobaan >= 0),
        ADD COLUMN IF NOT EXISTS provider_id VARCHAR(200),
        ADD COLUMN IF NOT EXISTS dikirim_at TIMESTAMPTZ;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('kegiatan_pengingat', 'percobaan',   NULL, 'input',    NULL, NULL,       NULL, TRUE, FALSE, 8,  'half', NULL, 'Jumlah percobaan pengiriman', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'provider_id', NULL, 'input',    NULL, NULL,       NULL, TRUE, FALSE, 9,  'half', NULL, 'ID pesan dari provider (bukti kirim)', NULL, FALSE, NULL, NULL, NULL),
        ('kegiatan_pengingat', 'dikirim_at',  NULL, 'datetime', NULL, 'datetime', NULL, TRUE, FALSE, 11, 'half', NULL, NULL, NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;
    `);
  });
};
