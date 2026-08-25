/**
 * Rentang divisi KBLI 2020 per sektor huruf (A–U) plus nama kategori resmi BPS
 * dalam Bahasa Indonesia. Sumber nama: kategori.md di root project + Peraturan
 * BPS No. 2 Tahun 2020. Tetap konsisten dengan.database kolom `kategori_bps`
 * (lihat migration 20260822B-add-kategori-bps-to-klasifikasi-usaha.js).
 */
export const KBLI_SECTOR_DIVISIONS = [
  { code: "A", start: 1, end: 3, name: "Pertanian, Kehutanan, dan Perikanan" },
  { code: "B", start: 5, end: 9, name: "Pertambangan dan Penggalian" },
  { code: "C", start: 10, end: 33, name: "Industri Pengolahan" },
  {
    code: "D",
    start: 35,
    end: 35,
    name: "Pengadaan Listrik, Gas, Uap/Air Panas, dan Udara Dingin",
  },
  {
    code: "E",
    start: 36,
    end: 39,
    name: "Pengelolaan Air, Pengelolaan Air Limbah, Pengelolaan dan Daur Ulang Sampah, serta Aktivitas Remediasi",
  },
  { code: "F", start: 41, end: 43, name: "Konstruksi" },
  {
    code: "G",
    start: 45,
    end: 47,
    name: "Perdagangan Besar dan Eceran; Reparasi dan Perawatan Mobil dan Sepeda Motor",
  },
  { code: "H", start: 49, end: 53, name: "Pengangkutan dan Pergudangan" },
  {
    code: "I",
    start: 55,
    end: 56,
    name: "Penyediaan Akomodasi dan Penyediaan Makan Minum",
  },
  { code: "J", start: 58, end: 63, name: "Informasi dan Komunikasi" },
  { code: "K", start: 64, end: 66, name: "Aktivitas Keuangan dan Asuransi" },
  { code: "L", start: 68, end: 68, name: "Real Estat" },
  {
    code: "M",
    start: 69,
    end: 75,
    name: "Aktivitas Profesional, Ilmiah, dan Teknis",
  },
  {
    code: "N",
    start: 77,
    end: 82,
    name: "Aktivitas Penyewaan dan Sewa Guna Usaha Tanpa Hak Opsi, Ketenagakerjaan, Agen Perjalanan, dan Penunjang Usaha Lainnya",
  },
  {
    code: "O",
    start: 84,
    end: 84,
    name: "Administrasi Pemerintahan, Pertahanan, dan Jaminan Sosial Wajib",
  },
  { code: "P", start: 85, end: 85, name: "Pendidikan" },
  {
    code: "Q",
    start: 86,
    end: 88,
    name: "Aktivitas Kesehatan Manusia dan Aktivitas Sosial",
  },
  { code: "R", start: 90, end: 93, name: "Kesenian, Hiburan, dan Rekreasi" },
  { code: "S", start: 94, end: 96, name: "Aktivitas Jasa Lainnya" },
  {
    code: "T",
    start: 97,
    end: 98,
    name: "Aktivitas Rumah Tangga sebagai Pemberi Kerja; Aktivitas yang Menghasilkan Barang dan Jasa oleh Rumah Tangga yang Digunakan untuk Memenuhi Kebutuhan Sendiri",
  },
  {
    code: "U",
    start: 99,
    end: 99,
    name: "Aktivitas Badan Internasional dan Badan Ekstra Internasional Lainnya",
  },
] as const;

/** Huruf sektor untuk sebuah kode KBLI (berdasarkan 2 digit pertama), atau null bila tidak terpetakan. */
export function sectorForKbli(kode: string | null | undefined): string | null {
  const division = /^\d{2,5}$/.test(kode ?? "")
    ? Number(String(kode).slice(0, 2))
    : null;
  if (division === null) return null;
  return (
    KBLI_SECTOR_DIVISIONS.find(
      (sector) => division >= sector.start && division <= sector.end,
    )?.code ?? null
  );
}

/** Nama kategori BPS resmi untuk kode 5 digit, atau null bila tidak terpetakan. */
export function kategoriBpsFor(kode: string | null | undefined): string | null {
  const division = /^\d{2,5}$/.test(kode ?? "")
    ? Number(String(kode).slice(0, 2))
    : null;
  if (division === null) return null;
  return (
    KBLI_SECTOR_DIVISIONS.find(
      (sector) => division >= sector.start && division <= sector.end,
    )?.name ?? null
  );
}
