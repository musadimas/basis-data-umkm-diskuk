/**
 * Review QC 2026-10-02: backfill 20261001A menyalin `catatan` ke `alasan_tolak` untuk baris
 * ditolak lama tetapi membiarkan `catatan`, padahal di baris itu `catatan` sudah ditimpa alasan
 * kurator. "Ajukan ulang" lalu menyalin alasan kurator sebagai catatan pengaju. Baris hasil
 * backfill dikenali dari `ditolak_oleh IS NULL` (penolakan baru selalu mengisinya); teksnya
 * tetap utuh di `alasan_tolak`.
 */
export const up = async (knex) => {
  await knex.raw(`
    UPDATE talent_pengajuan
       SET catatan = NULL
     WHERE status = 'ditolak' AND ditolak_oleh IS NULL AND catatan = alasan_tolak
  `);
};

export const down = async (knex) => {
  await knex.raw(`
    UPDATE talent_pengajuan
       SET catatan = alasan_tolak
     WHERE status = 'ditolak' AND ditolak_oleh IS NULL AND catatan IS NULL AND alasan_tolak IS NOT NULL
  `);
};
