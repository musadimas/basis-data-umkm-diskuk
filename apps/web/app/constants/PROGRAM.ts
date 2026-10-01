import type { JenisLegalitas, KesiapanLegalitas, KlinikJenisOutcome, LoiStatus, PengajuanStatus, StatusLegalitas, TalentStatus } from "~/types/program";
import { ATRIBUT_JABAR } from "./OPERASIONAL";

/** Peta label berkunci runtime (skala/fase): kunci di luar daftar tetap jatuh ke fallback pemanggil. */
interface LabelByKey {
  [key: string]: string;
}

export const TALENT_STATUS = {
  none: { label: "Belum diajukan", className: "bg-slate-100 text-slate-700" },
  nominated: { label: "Diajukan", className: "bg-sky-100 text-sky-800" },
  scouting: { label: "Scouting", className: "bg-indigo-100 text-indigo-800" },
  talent_pool: { label: "Talent Pool", className: "bg-emerald-100 text-emerald-800" },
  accelerator: { label: "Akselerator", className: "bg-amber-100 text-amber-900" },
  champion: { label: "Champion", className: "bg-yellow-300 text-yellow-950" },
} satisfies Record<TalentStatus, { label: string; className: string }>;

export const PENGAJUAN_STATUS = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  dinilai: { label: "Siap dikurasi", className: "bg-indigo-100 text-indigo-800" },
  disetujui: { label: "Disetujui", className: "bg-emerald-100 text-emerald-800" },
  ditolak: { label: "Ditolak", className: "bg-red-100 text-red-800" },
} satisfies Record<PengajuanStatus, { label: string; className: string }>;

export const JENIS_LEGALITAS: { value: JenisLegalitas; label: string }[] = [
  { value: "halal", label: "Halal" },
  { value: "pirt", label: "PIRT" },
  { value: "bpom", label: "BPOM" },
  { value: "hki", label: "HKI" },
  { value: "sni", label: "SNI" },
  { value: "umku", label: "UMKU" },
];

export const STATUS_LEGALITAS = {
  dalam_proses: { label: "Dalam proses", className: "bg-amber-100 text-amber-900" },
  terbit: { label: "Terbit", className: "bg-emerald-100 text-emerald-800" },
  kedaluwarsa: { label: "Kedaluwarsa", className: "bg-red-100 text-red-800" },
  dicabut: { label: "Dicabut", className: "bg-slate-200 text-slate-700" },
} satisfies Record<StatusLegalitas, { label: string; className: string }>;

export const KESIAPAN_LEGALITAS: { value: KesiapanLegalitas; label: string }[] = [
  { value: "belum", label: "Belum ada" },
  { value: "dalam_proses", label: "Dalam proses" },
  { value: "terbit", label: "Sudah terbit" },
];

export const SKALA_LABEL: LabelByKey = { micro: "Mikro", small: "Kecil", medium: "Menengah" };

export const SKOR_DIMENSI: { key: "finansial" | "pasar" | "legalitas" | "sdm"; label: string }[] = [
  { key: "finansial", label: "Finansial" },
  { key: "pasar", label: "Pasar" },
  { key: "legalitas", label: "Legalitas" },
  { key: "sdm", label: "SDM & Komitmen" },
];

/** Stored with scores computed by the placeholder rubric (see the program extension's scoring.js). */
export const PLACEHOLDER_RUBRIK = "placeholder-v0";

export const LAPORAN_STATUS = {
  menunggu: { label: "Menunggu review", className: "bg-amber-100 text-amber-900" },
  disetujui: { label: "Disetujui", className: "bg-emerald-100 text-emerald-800" },
  ditolak: { label: "Perlu perbaikan", className: "bg-red-100 text-red-800" },
  belum_mengirim: { label: "Belum mengirim", className: "bg-slate-200 text-slate-700" },
} satisfies Record<import("~/types/program").LaporanStatus | "belum_mengirim", { label: string; className: string }>;

export const FASE_LABEL: LabelByKey = {
  pra_akselerasi: "Pra-akselerasi",
  akselerasi: "Akselerasi",
  pasca_akselerasi: "Pasca-akselerasi",
};

/** Directus asset URL through the same-origin /panel proxy; `width` asks Directus for a resized copy. */
export function assetUrl(id: string, width?: number) {
  return `/panel/assets/${encodeURIComponent(id)}${width ? `?width=${width}&quality=75` : ""}`;
}

/**
 * Clinic attachment through the extension endpoint: the file lives in a private folder no Directus
 * policy exposes, so only the applicant on that ticket or clinic staff get bytes back.
 */
export function lampiranKlinikUrl(id: string) {
  return `/panel/v1/program/klinik/lampiran/${encodeURIComponent(id)}`;
}

/** Directus folder the Public policy may read (migration 20260926G); published photos live here. */
export const KATALOG_FOLDER_ID = "6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10";

/** Product photos wait for curation here (migration 20260926P); nothing in it is publicly readable. */
export const KURASI_FOLDER_ID = "6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f11";

export const KATEGORI_PRODUK: { value: string; label: string }[] = [
  { value: "makanan", label: "Makanan" },
  { value: "minuman", label: "Minuman" },
  { value: "fashion", label: "Fashion" },
  { value: "kerajinan", label: "Kerajinan" },
  { value: "kesehatan_kecantikan", label: "Kesehatan & Kecantikan" },
  { value: "agribisnis", label: "Agribisnis" },
  { value: "lainnya", label: "Lainnya" },
];

export const KURASI_STATUS = {
  menunggu: { label: "Menunggu kurasi", className: "bg-amber-100 text-amber-900" },
  tayang: { label: "Tayang", className: "bg-emerald-100 text-emerald-800" },
  rekomendasi_marketplace: { label: "Rekomendasi Marketplace", className: "bg-indigo-100 text-indigo-800" },
  ditolak: { label: "Ditolak", className: "bg-red-100 text-red-800" },
} satisfies Record<import("~/types/program").KurasiStatus, { label: string; className: string }>;

/** Tindak lanjut Letter of Intent pada panel kurasi katalog; `ditutup` final. */
export const LOI_STATUS = {
  baru: { label: "Baru", className: "bg-amber-100 text-amber-900" },
  ditindaklanjuti: { label: "Ditindaklanjuti", className: "bg-sky-100 text-sky-800" },
  ditutup: { label: "Ditutup", className: "bg-slate-200 text-slate-700" },
} satisfies Record<LoiStatus, { label: string; className: string }>;

/** Status profil kemitraan investor pada panel kurasi investor. */
export const KURASI_INVESTOR_STATUS = {
  disetujui: { label: "Disetujui", className: "bg-emerald-100 text-emerald-800" },
  menunggu: { label: "Menunggu kurasi", className: "bg-amber-100 text-amber-900" },
  belum_disetujui: { label: "Belum disetujui usaha", className: "bg-slate-100 text-slate-700" },
  dicabut: { label: "Persetujuan dicabut", className: "bg-slate-200 text-slate-700" },
};

/** Talent statuses the catalogue shows as a "Talent Jabar" badge. */
export const TALENT_BADGE_STATUS = ["talent_pool", "accelerator", "champion"] as const;

export const RADAR_DIMENSI: { key: keyof import("~/types/program").PassportSkor; label: string }[] = [
  { key: "finansial", label: "Finansial" },
  { key: "pasar", label: "Pasar" },
  { key: "legalitas", label: "Legalitas" },
  { key: "sdm", label: "SDM" },
  { key: "kinerja", label: "Kinerja Program" },
];

export const KLINIK_STATUS: { value: import("~/types/program").KlinikStatus; label: string }[] = [
  { value: "masuk", label: "Tiket Masuk" },
  { value: "dijadwalkan", label: "Jadwal Ditetapkan" },
  { value: "berjalan", label: "Sesi Berjalan" },
  { value: "tindak_lanjut", label: "Tindak Lanjut" },
  { value: "selesai", label: "Selesai" },
  { value: "batal", label: "Dibatalkan" },
];

/** Kanban petugas tetap lima kolom (B34, K23): tiket batal hanya tampil lewat toggle arsip. */
export const KANBAN_KOLOM: { value: Exclude<import("~/types/program").KlinikStatus, "batal">; label: string }[] = [
  { value: "masuk", label: "Tiket Masuk" },
  { value: "dijadwalkan", label: "Jadwal Ditetapkan" },
  { value: "berjalan", label: "Sesi Berjalan" },
  { value: "tindak_lanjut", label: "Tindak Lanjut" },
  { value: "selesai", label: "Selesai" },
];

/** Label status tiket; kode yang tak dikenal ditampilkan apa adanya, bukan "Batal" (B34). */
export function labelStatusKlinik(status: string | null | undefined): string {
  return KLINIK_STATUS.find((item) => item.value === status)?.label ?? String(status ?? "");
}

export const KLINIK_PRIORITAS = {
  normal: { label: "Normal", className: "bg-slate-100 text-slate-700" },
  tinggi: { label: "Tinggi", className: "bg-amber-100 text-amber-900" },
  mendesak: { label: "Mendesak", className: "bg-red-100 text-red-800" },
} satisfies Record<import("~/types/program").KlinikPrioritas, { label: string; className: string }>;

export const KLINIK_RUJUKAN: { value: import("~/types/program").KlinikRujukan; label: string }[] = [
  { value: "sarpras", label: "Program Bantuan Sarpras" },
  { value: "vokasi", label: "Pelatihan Vokasi" },
  { value: "mediasi_sapa", label: "Mediasi Kementerian / SAPA UMKM" },
  { value: "talent_lab", label: "Kurasi Talent Pool" },
];

/** Placeholder aspects until the official five-aspect framework is confirmed. */
export const KLINIK_ASPEK: { value: import("~/types/program").KlinikAspek; label: string }[] = [
  { value: "legalitas", label: "Legalitas" },
  { value: "keuangan", label: "Keuangan" },
  { value: "pemasaran", label: "Pemasaran" },
  { value: "produksi", label: "Produksi" },
  { value: "sdm", label: "SDM & Manajemen" },
];

/**
 * 15 atribut yang boleh menjadi outcome konsultasi (R04). Kunci di kawat memakai snake_case kolom
 * `usaha_atribut_jabar`; label dan urutan satu sumber dengan `ATRIBUT_JABAR`, dan tes menjaga keduanya
 * tetap sama dengan aturan server.
 */
export const KLINIK_ATRIBUT_OUTCOME: { value: string; label: string }[] = ATRIBUT_JABAR.map(({ key, label }) => ({
  value: key.replace(/[A-Z]/g, (huruf) => `_${huruf.toLowerCase()}`),
  label,
}));

export const KLINIK_JENIS_OUTCOME: { value: KlinikJenisOutcome; label: string }[] = [
  { value: "kepatuhan", label: "Kepatuhan" },
  { value: "perbaikan", label: "Perbaikan" },
];

/** Status outcome untuk lencana; server tetap mengirim `statusLabel`, ini hanya warnanya. */
export const KLINIK_STATUS_OUTCOME_WARNA = {
  diajukan: "bg-amber-100 text-amber-900",
  terverifikasi: "bg-emerald-100 text-emerald-800",
  dicabut: "bg-slate-200 text-slate-700",
} satisfies Record<import("~/types/program").KlinikStatusOutcome, string>;
