/**
 * Peta pesan error KPI yang murni (tanpa IndexedDB), dipakai outbox dan halaman KPI.
 * Kuncinya kode error `ProgramError` dari `kpi/service.js` dan `lib/access.js`; tes penjaga
 * memastikan tak ada kode server yang terlewat.
 */

export const PESAN_KPI = {
  LAPORAN_SUDAH_ADA: "Laporan minggu ini sudah terkirim sebelumnya.",
  MINGGU_TIDAK_VALID: "Minggu laporan belum dimulai.",
  BUKAN_HARI_LAPOR: "Laporan mingguan hanya dapat dibuat pada hari Jumat (WIB).",
  DIBUAT_PADA_TIDAK_VALID: "Laporan offline ini terlalu lama atau jam perangkat tidak sesuai. Buang lalu isi ulang pada hari Jumat.",
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
  PITCHING_BELUM_MEMENUHI: "Rekomendasi membutuhkan 4 minggu terbaru berturut-turut yang disetujui dan mencapai target.",
  INVALID_PAGE: "Nomor halaman antrean tidak valid. Muat ulang daftar.",
  AUTHENTICATION_REQUIRED: "Sesi berakhir. Masuk kembali lalu coba lagi.",
  KOTA_NOT_ASSIGNED: "Akun ini belum ditetapkan ke kabupaten/kota.",
  FORBIDDEN: "Akun ini tidak dapat mengirim laporan untuk usaha tersebut.",
} satisfies Record<string, string>;

/**
 * Jumat menurut Asia/Jakarta (M5-03): laporan baru hanya dibuat pada hari ini. Server tetap penentu
 * akhir (`BUKAN_HARI_LAPOR`); ini hanya mencegah pengguna mengisi form yang pasti ditolak.
 */
export function hariLaporWib(now = new Date()): boolean {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short" }).format(now) === "Fri";
}

export const PESAN_KPI_UMUM = "Laporan ditolak server. Periksa isian lalu kirim ulang.";

export function pesanKpi(code: string | undefined, fallback = PESAN_KPI_UMUM): string {
  // SAFETY: Object.hasOwn memastikan `code` adalah kunci PESAN_KPI.
  return code !== undefined && Object.hasOwn(PESAN_KPI, code) ? PESAN_KPI[code as keyof typeof PESAN_KPI] : fallback;
}
