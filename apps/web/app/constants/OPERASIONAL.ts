export interface AtributJabarItem {
  key: string;
  label: string;
}

export const ATRIBUT_JABAR: AtributJabarItem[] = [
  { key: "npwpUsaha", label: "NPWP Usaha" },
  { key: "izinEdar", label: "Izin Edar" },
  { key: "sertifikatHalal", label: "Sertifikat Halal" },
  { key: "pirtBpom", label: "PIRT/BPOM" },
  { key: "hkiMerek", label: "HKI/Merek" },
  { key: "sni", label: "SNI" },
  { key: "rekeningTerpisah", label: "Rekening Usaha Terpisah" },
  { key: "sopTertulis", label: "SOP Tertulis" },
  { key: "ecommerce", label: "Pemanfaatan E-commerce" },
  { key: "medsosBisnis", label: "Media Sosial Bisnis" },
  { key: "qris", label: "QRIS" },
  { key: "pembukuanDigital", label: "Pembukuan Digital" },
  { key: "aksesKur", label: "Akses KUR/Perbankan" },
  { key: "rantaiPasokIndustri", label: "Rantai Pasok Industri" },
  { key: "kontrakOfftaker", label: "Kontrak Offtaker" },
];

export interface TalentaStatusItem {
  value: string;
  label: string;
  badgeClass: string;
}

export const TALENTA_STATUS: TalentaStatusItem[] = [
  { value: "diajukan", label: "Diajukan", badgeClass: "bg-slate-200 text-slate-800" },
  { value: "dinilai", label: "Dinilai", badgeClass: "bg-sky-100 text-sky-800" },
  { value: "scouting", label: "Talent Pool — Scouting", badgeClass: "bg-indigo-100 text-indigo-800" },
  { value: "talent_lab", label: "Talent Lab", badgeClass: "bg-violet-100 text-violet-800" },
  { value: "accelerator", label: "Accelerator", badgeClass: "bg-emerald-100 text-emerald-800" },
  { value: "champion", label: "UMKM Champion", badgeClass: "bg-amber-100 text-amber-900" },
  { value: "ditolak", label: "Ditolak", badgeClass: "bg-rose-100 text-rose-800" },
];

export function talentaStatusLabel(status: string): string {
  return TALENTA_STATUS.find((s) => s.value === status)?.label ?? status;
}

export function talentaStatusClass(status: string): string {
  return TALENTA_STATUS.find((s) => s.value === status)?.badgeClass ?? "bg-slate-200 text-slate-800";
}

export const FOLDER_OPERASIONAL_NOTE = "Unggah simulasi: berkas tersimpan pada folder operasional.";

export interface LaporanStatusItem {
  value: string;
  label: string;
  badgeClass: string;
}

export const LAPORAN_STATUS: LaporanStatusItem[] = [
  { value: "menunggu", label: "Menunggu Persetujuan", badgeClass: "bg-amber-100 text-amber-900" },
  { value: "disetujui", label: "Telah Disetujui", badgeClass: "bg-emerald-100 text-emerald-800" },
  { value: "ditolak", label: "Perlu Perbaikan", badgeClass: "bg-rose-100 text-rose-800" },
];

export function laporanStatusLabel(status: string): string {
  return LAPORAN_STATUS.find((s) => s.value === status)?.label ?? status;
}

export function laporanStatusClass(status: string): string {
  return LAPORAN_STATUS.find((s) => s.value === status)?.badgeClass ?? "bg-slate-200 text-slate-800";
}

export const TALENTA_ASPEK_LABELS = [
  "Aspek Finansial & Omzet (Bobot 25%)",
  "Kesiapan Pasar & Produk (Bobot 25%)",
  "Legalitas & Kepatuhan Usaha (Bobot 25%)",
  "Kapasitas Pengelolaan & SDM (Bobot 25%)",
] as const;
