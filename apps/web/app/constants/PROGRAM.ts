import type { JenisLegalitas, KesiapanLegalitas, PengajuanStatus, StatusLegalitas, TalentStatus } from "~/types/program";

export const TALENT_STATUS: Record<TalentStatus, { label: string; className: string }> = {
  none: { label: "Belum diajukan", className: "bg-slate-100 text-slate-700" },
  nominated: { label: "Diajukan", className: "bg-sky-100 text-sky-800" },
  scouting: { label: "Scouting", className: "bg-indigo-100 text-indigo-800" },
  talent_pool: { label: "Talent Pool", className: "bg-emerald-100 text-emerald-800" },
  accelerator: { label: "Akselerator", className: "bg-amber-100 text-amber-900" },
  champion: { label: "Champion", className: "bg-yellow-300 text-yellow-950" },
};

export const PENGAJUAN_STATUS: Record<PengajuanStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  dinilai: { label: "Dinilai", className: "bg-indigo-100 text-indigo-800" },
  disetujui: { label: "Disetujui", className: "bg-emerald-100 text-emerald-800" },
  ditolak: { label: "Ditolak", className: "bg-red-100 text-red-800" },
};

export const JENIS_LEGALITAS: { value: JenisLegalitas; label: string }[] = [
  { value: "halal", label: "Halal" },
  { value: "pirt", label: "PIRT" },
  { value: "bpom", label: "BPOM" },
  { value: "hki", label: "HKI" },
  { value: "sni", label: "SNI" },
  { value: "umku", label: "UMKU" },
];

export const STATUS_LEGALITAS: Record<StatusLegalitas, { label: string; className: string }> = {
  dalam_proses: { label: "Dalam proses", className: "bg-amber-100 text-amber-900" },
  terbit: { label: "Terbit", className: "bg-emerald-100 text-emerald-800" },
  kedaluwarsa: { label: "Kedaluwarsa", className: "bg-red-100 text-red-800" },
  dicabut: { label: "Dicabut", className: "bg-slate-200 text-slate-700" },
};

export const KESIAPAN_LEGALITAS: { value: KesiapanLegalitas; label: string }[] = [
  { value: "belum", label: "Belum ada" },
  { value: "dalam_proses", label: "Dalam proses" },
  { value: "terbit", label: "Sudah terbit" },
];

export const SKALA_LABEL: Record<string, string> = { micro: "Mikro", small: "Kecil", medium: "Menengah" };

export const SKOR_DIMENSI: { key: "finansial" | "pasar" | "legalitas" | "sdm"; label: string }[] = [
  { key: "finansial", label: "Finansial" },
  { key: "pasar", label: "Pasar" },
  { key: "legalitas", label: "Legalitas" },
  { key: "sdm", label: "SDM & Komitmen" },
];

/** Stored with scores computed by the placeholder rubric (see the program extension's scoring.js). */
export const PLACEHOLDER_RUBRIK = "placeholder-v0";

export const LAPORAN_STATUS: Record<import("~/types/program").LaporanStatus | "belum_mengirim", { label: string; className: string }> = {
  menunggu: { label: "Menunggu review", className: "bg-amber-100 text-amber-900" },
  disetujui: { label: "Disetujui", className: "bg-emerald-100 text-emerald-800" },
  ditolak: { label: "Perlu perbaikan", className: "bg-red-100 text-red-800" },
  belum_mengirim: { label: "Belum mengirim", className: "bg-slate-200 text-slate-700" },
};

export const FASE_LABEL: Record<string, string> = {
  pra_akselerasi: "Pra-akselerasi",
  akselerasi: "Akselerasi",
  pasca_akselerasi: "Pasca-akselerasi",
};

/** Directus asset URL through the same-origin /panel proxy; `width` asks Directus for a resized copy. */
export function assetUrl(id: string, width?: number) {
  return `/panel/assets/${encodeURIComponent(id)}${width ? `?width=${width}&quality=75` : ""}`;
}
