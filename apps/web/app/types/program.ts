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
