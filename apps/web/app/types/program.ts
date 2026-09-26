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

export type KurasiStatus = "menunggu" | "tayang" | "rekomendasi_marketplace" | "ditolak";

/** A published product as the Directus Public policy exposes it (collection `produk`). */
export interface ProdukPublik {
  id: string;
  nama: string;
  deskripsi: string | null;
  kategori: string | null;
  kbli: string | null;
  harga_retail: number | null;
  harga_grosir: number | null;
  moq: number | null;
  video_url: string | null;
  dimensi: string | null;
  berat: string | null;
  shelf_life: string | null;
  bahan_baku: string | null;
  tkdn_persen: number | string | null;
  kapasitas_bulanan: string | null;
  lead_time: string | null;
  persen_bahan_lokal: number | string | null;
  pdn_deklarasi: boolean;
  status_kurasi: KurasiStatus;
  foto: { directus_files_id: string }[];
  usaha_nama: string | null;
  usaha_skala: string | null;
  usaha_talent_status: TalentStatus | null;
  usaha_pdn: boolean;
  usaha_ramah_disabilitas: boolean;
  usaha_whatsapp: string | null;
  usaha_kota: number | null;
  usaha_kota_nama: string | null;
  usaha_sertifikasi: string;
  date_created: string;
}

/** A product as its owner and the curators see it (/v1/program/katalog). */
export interface Produk {
  id: string;
  usaha: string;
  nama: string;
  deskripsi: string | null;
  kategori: string | null;
  kbli: string | null;
  hargaRetail: number | null;
  hargaGrosir: number | null;
  moq: number | null;
  videoUrl: string | null;
  dimensi: string | null;
  berat: string | null;
  shelfLife: string | null;
  bahanBaku: string | null;
  tkdnPersen: number | null;
  kapasitasBulanan: string | null;
  leadTime: string | null;
  persenBahanLokal: number | null;
  pdnDeklarasi: boolean;
  foto: string[];
  statusKurasi: KurasiStatus;
  catatanKurasi: string | null;
  dikurasiAt: string | null;
  usahaNama: string | null;
  usahaKota: string | null;
  dateCreated: string;
  dateUpdated: string;
}

export type ProdukInput = Omit<Produk, "id" | "usaha" | "statusKurasi" | "catatanKurasi" | "dikurasiAt" | "usahaNama" | "usahaKota" | "dateCreated" | "dateUpdated">;

export interface UsahaPilihan {
  id: string;
  nama: string;
  nib: string | null;
  kota: string | null;
}

export interface ProdukLoi {
  id: string;
  produk: string;
  produkNama: string;
  usahaNama: string | null;
  nama: string;
  instansi: string | null;
  email: string;
  telepon: string | null;
  jumlah: string | null;
  pesan: string;
  status: "baru" | "ditindaklanjuti" | "ditutup";
  dateCreated: string;
}

export interface PassportSkor {
  finansial: number;
  pasar: number;
  legalitas: number;
  sdm: number;
  kinerja: number;
}

/** The signed, public part of a Talent Passport. */
export interface PassportPayload {
  versi: number;
  kode: string;
  usaha: { nama: string; skala: string | null; kota: string | null; kbli: string | null };
  statusBadge: string;
  skor: PassportSkor;
  rubrikVersi: string;
  sertifikasi: JenisLegalitas[];
  pdnTerverifikasi: boolean;
  diterbitkanAt: string;
}

export interface Passport {
  id: string;
  kode: string;
  status: "aktif" | "dicabut";
  statusBadge: string;
  skor: PassportSkor;
  payload: PassportPayload;
  diterbitkanAt: string;
}

export interface PassportDetail {
  usaha: { id: string; nama: string; talentStatus: TalentStatus };
  eligible: boolean;
  alasan: string | null;
  bisaMenerbitkan: boolean;
  passport: Passport | null;
}

export interface PassportPortfolioItem {
  id: string;
  nama: string;
  deskripsi: string | null;
  videoUrl: string | null;
  dimensi: string | null;
  berat: string | null;
  shelfLife: string | null;
  bahanBaku: string | null;
  tkdnPersen: number | string | null;
  kapasitasBulanan: string | null;
  leadTime: string | null;
  foto: string[];
}

export type PassportVerification =
  | { kode: string; valid: true; status: "aktif"; passport: PassportPayload; portfolio: PassportPortfolioItem[] }
  | { kode: string; valid: false; status: "tidak_valid" | "dicabut"; dicabutAt?: string };

export type KategoriKegiatan = "pelatihan" | "pameran" | "bazar" | "seminar" | "temu_bisnis" | "lainnya";

/** A published event as the Directus Public policy exposes it (collection `kegiatan`). */
export interface Kegiatan {
  id: string;
  judul: string;
  ringkasan: string | null;
  kategori: KategoriKegiatan;
  penyelenggara: string | null;
  kota_nama: string | null;
  metode: "luring" | "daring" | "hybrid";
  ramah_disabilitas: boolean;
  tanggal_mulai: string;
  tanggal_selesai: string;
  batas_registrasi: string | null;
  lokasi: string | null;
  link: string | null;
  kuota: number | null;
  terisi: number;
  silabus: string | null;
  narasumber: string | null;
  fasilitas: string | null;
  syarat: string | null;
  poster: string | null;
}

export interface FaqEntry {
  id: number;
  pertanyaan: string;
  jawaban: string;
  kategori: string | null;
  sort: number | null;
}

export interface KontakHotline {
  id: number;
  nama_layanan: string;
  whatsapp: string | null;
  telepon: string | null;
  email: string | null;
  jam_layanan: string | null;
  alamat: string | null;
}
