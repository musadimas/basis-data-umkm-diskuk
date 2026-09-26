/** DTOs of the /v1/program endpoints (services/directus/extensions/program). */

export type TalentStatus = "none" | "nominated" | "scouting" | "talent_pool" | "accelerator" | "champion";
export type JenisLegalitas = "halal" | "pirt" | "bpom" | "hki" | "sni" | "umku";
export type StatusLegalitas = "dalam_proses" | "terbit" | "kedaluwarsa" | "dicabut";
export type KesiapanLegalitas = "belum" | "dalam_proses" | "terbit";
export type PengajuanStatus = "draft" | "dinilai" | "disetujui" | "ditolak";

export interface Legalitas {
  id: string;
  jenis: JenisLegalitas;
  nomor: string | null;
  status: StatusLegalitas;
  berlakuHingga: string | null;
  berkas: string | null;
}

export interface UsahaSummary {
  id: string;
  nama: string;
  nib: string | null;
  skala: "micro" | "small" | "medium" | null;
  kodeKbli: string | null;
  kegiatanUtama: string | null;
  produkUtama: string | null;
  omzetTahunan: number | null;
  totalAset: number | null;
  kota: string | null;
  kecamatan: string | null;
  tenagaKerja: number;
  talentStatus: TalentStatus;
  talentBatch: string | null;
  pdnTerverifikasi: boolean;
  ramahDisabilitas: boolean;
  pemilik: { nama: string | null; nikMasked: string };
}

export interface TalentSkor {
  finansial: number;
  pasar: number;
  legalitas: number;
  sdm: number;
  total: number;
  rubrikVersi: string;
}

export interface TalentPengajuan {
  id: string;
  usaha: string;
  status: PengajuanStatus;
  kapasitasProduksi: number | null;
  satuan: string | null;
  kesiapanLegalitas: Partial<Record<JenisLegalitas, KesiapanLegalitas>>;
  literasiQris: boolean;
  literasiPembukuanDigital: boolean;
  suratKomitmen: string | null;
  skor: TalentSkor | null;
  dinilaiAt: string | null;
  catatan: string | null;
  beritaAcara: string | null;
  dateCreated: string;
  dateUpdated: string;
}

export interface TalentPengajuanListItem extends TalentPengajuan {
  usahaInfo: { nama: string; nib: string | null; skala: string | null; kota: string | null };
}

export interface TalentUsahaDetail {
  usaha: UsahaSummary;
  legalitas: Legalitas[];
  pengajuan: TalentPengajuan | null;
}

export interface TalentPengajuanInput {
  kapasitasProduksi: number | null;
  satuan: string | null;
  kesiapanLegalitas: Partial<Record<JenisLegalitas, KesiapanLegalitas>>;
  literasiQris: boolean;
  literasiPembukuanDigital: boolean;
  suratKomitmen: string | null;
  catatan: string | null;
}

export interface BeritaAcara {
  id: string;
  nomor: string;
  tanggal: string;
  catatan: string | null;
  berkas: string | null;
  dateCreated: string;
  jumlahPengajuan: number;
}

export type LaporanStatus = "menunggu" | "disetujui" | "ditolak";

export interface KpiPeserta {
  id: string;
  usaha: { id: string; nama: string; nib: string | null; skala: string | null; kota: string | null };
  batch: string;
  fase: string;
  pendamping: { id: string; nama: string | null } | null;
  tanggalMulai: string;
  jumlahMinggu: number;
  /** 0 before the programme starts. */
  mingguBerjalan: number;
  targetMingguan: number;
  rekomendasiPitching: boolean;
  status: "aktif" | "selesai" | "keluar";
}

export interface KpiPesertaListItem extends KpiPeserta {
  laporanTerkirim: number;
  statusMingguIni: LaporanStatus | "belum_mengirim" | null;
}

export interface KpiLaporan {
  id: string;
  peserta: string;
  mingguKe: number;
  target: number;
  realisasiOmzet: number;
  jumlahTransaksi: number;
  capaianPersen: number | null;
  kendala: string | null;
  bukti: string[];
  status: LaporanStatus;
  catatanPendamping: string | null;
  direviewAt: string | null;
  clientUuid: string;
  dateCreated: string;
  dateUpdated: string;
}

export interface KpiLaporanQueueItem extends KpiLaporan {
  pesertaInfo: KpiPeserta | null;
}

export interface KpiPesertaDetail {
  peserta: KpiPeserta;
  laporan: KpiLaporan[];
  pitching: { streak: number; dibutuhkan: number; memenuhi: boolean };
  akses: { kirim: boolean; review: boolean };
}

export interface KpiLaporanInput {
  mingguKe: number;
  realisasiOmzet: number;
  jumlahTransaksi: number;
  kendala: string | null;
  bukti: string[];
  clientUuid: string;
}
