/**
 * Peta pesan error KPI yang murni (tanpa IndexedDB), dipakai outbox dan halaman KPI.
 * Kuncinya kode error `ProgramError` dari `kpi/service.js` dan `lib/access.js`; tes penjaga
 * memastikan tak ada kode server yang terlewat.
 */

export const PESAN_KPI = {
  LAPORAN_SUDAH_ADA: "Laporan minggu ini sudah terkirim sebelumnya.",
  MINGGU_TIDAK_VALID: "Minggu laporan belum dimulai.",
  PESERTA_TIDAK_AKTIF: "Kepesertaan program sudah tidak aktif.",
  CLIENT_UUID_CONFLICT: "Laporan ini terkait peserta lain. Buang lalu isi ulang.",
  BUKTI_TIDAK_VALID: "Foto bukti harus berupa gambar yang Anda unggah sendiri.",
  INVALID_REFERENCE: "Foto bukti tidak ditemukan di server.",
  INVALID_PAYLOAD: "Isian laporan tidak valid. Periksa lalu kirim ulang.",
  INVALID_ID: "Data tidak valid.",
  PESERTA_NOT_FOUND: "Peserta tidak ditemukan.",
  LAPORAN_NOT_FOUND: "Laporan tidak ditemukan.",
  LAPORAN_SUDAH_DIREVIEW: "Laporan ini sudah ditinjau. Muat ulang daftar.",
  CATATAN_WAJIB: "Tulis alasan penolakan untuk pelaku usaha.",
  PITCHING_BELUM_MEMENUHI: "Rekomendasi pitching membutuhkan 4 minggu berturut-turut yang disetujui dan mencapai target.",
  AUTHENTICATION_REQUIRED: "Sesi berakhir. Masuk kembali lalu coba lagi.",
  KOTA_NOT_ASSIGNED: "Akun ini belum ditetapkan ke kabupaten/kota.",
  FORBIDDEN: "Akun ini tidak dapat mengirim laporan untuk usaha tersebut.",
} satisfies Record<string, string>;

export const PESAN_KPI_UMUM = "Laporan ditolak server. Periksa isian lalu kirim ulang.";

export function pesanKpi(code: string | undefined, fallback = PESAN_KPI_UMUM): string {
  // SAFETY: Object.hasOwn memastikan `code` adalah kunci PESAN_KPI.
  return code !== undefined && Object.hasOwn(PESAN_KPI, code) ? PESAN_KPI[code as keyof typeof PESAN_KPI] : fallback;
}
