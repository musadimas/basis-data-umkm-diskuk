export interface UsahaLapanganSidt {
  nama: string | null;
  nib: string | null;
  kegiatanUtama: string | null;
  produkUtama: string | null;
  kodeKbli: string | null;
  skala: string | null;
  omzetTahunan: number | null;
  totalAset: number | null;
  latitude: number | null;
  longitude: number | null;
  status: string | null;
}

export interface UsahaLapangan {
  id: string;
  sidt: UsahaLapanganSidt;
  wilayah: {
    kota: string | null;
    kecamatan: string | null;
    kelurahan: string | null;
    alamatJalan: string | null;
  };
  pemilik: { nama: string | null };
  atribut: Record<string, boolean | null> | null;
  verifikasi: {
    terverifikasiOleh: { id: string; nama: string } | null;
    terverifikasiPada: string | null;
  };
  diperbaruiPada: string | null;
}

export interface TalentIndexHasil {
  finansial: number;
  pasar: number;
  legalitas: number;
  sdm: number;
  total: number;
  rekomendasi: string;
  rubrikVersi: number;
}

export interface TalentaPrefill {
  usaha: {
    id: string;
    nama: string | null;
    nib: string | null;
    nikTersamar: string | null;
    omzetTahunan: number | null;
    alamat: string | null;
    kota: string | null;
  };
  talentaAktif: { id: string; status: string } | null;
}

export interface TalentaForm {
  kapasitasProduksiBulanan: number;
  satuanKapasitas: "unit" | "kg";
  kesiapanHalal: boolean;
  kesiapanPirtBpom: boolean;
  kesiapanHki: boolean;
  adopsiQris: boolean;
  pencatatanKeuanganDigital: boolean;
  suratKomitmenFileId: string | null;
}

export interface TalentaRingkas {
  id: string;
  usaha: { id: string; nama: string | null };
  kota: { id: number | null; nama: string | null };
  status: string;
  skorTotal: number;
  rekomendasi: string;
  diajukanPada: string | null;
  beritaAcara: { id: string; nomor: string | null } | null;
}

export interface TalentaDetail extends Omit<TalentaRingkas, "skorTotal"> {
  form: Omit<TalentaForm, "suratKomitmenFileId">;
  skor: { finansial: number; pasar: number; legalitas: number; sdm: number; total: number };
  rubrikVersi: number;
  suratKomitmen: { id: string; nama: string } | null;
  riwayat: { tahap: string; oleh: string | null; pada: string | null }[];
  alasanPenolakan?: string | null;
}

export interface BeritaAcara {
  id: string;
  nomor: string;
  tanggal: string;
  catatan: string | null;
  jumlahTalenta: number;
  diterbitkanOleh: string | null;
}

// ── Y03: KPI mingguan ──

export interface UsahaSaya {
  usaha: {
    id: string;
    nama: string | null;
    nib: string | null;
    kota: string | null;
    skala: string | null;
    omzetTahunan: number | null;
  };
  pemilik: { nama: string | null };
  talenta: {
    id: string;
    status: string;
    batch: {
      id: string;
      kode: string;
      nama: string;
      tahap: string;
      tanggalMulai: string;
      jumlahMinggu: number;
    } | null;
    pendamping: { id: string; nama: string | null } | null;
    mingguBerjalan: number;
    targetMingguan: number | null;
    laporanMingguIni: { id: string; status: string } | null;
  } | null;
}

export interface LaporanSaya {
  id: string;
  mingguKe: number;
  omzet: number;
  jumlahTransaksi: number;
  target: number | null;
  status: string;
  catatanPendamping: string | null;
  dikirimPada: string | null;
  diverifikasiPada: string | null;
  bukti: { id: string } | null;
}

export interface Binaan {
  talentaId: string;
  usaha: { id: string; nama: string | null };
  pemilik: string | null;
  kota: string | null;
  batch: { nama: string } | null;
  status: string;
  mingguBerjalan: number;
  jumlahMinggu: number | null;
  targetMingguan: number | null;
  statusMingguIni: string;
  rekomendasiPitching: boolean;
  layakRekomendasi: boolean;
}

export interface AntreanItem {
  laporanId?: string;
  talentaId: string;
  usaha: { id: string; nama: string | null };
  mingguKe: number;
  omzet?: number;
  target?: number | null;
  capaianPersen?: number | null;
  dikirimPada?: string | null;
  status: string;
}

export interface LaporanDetail {
  laporanId: string;
  talentaId: string;
  usaha: { id: string; nama: string | null };
  pemilik: string | null;
  mingguKe: number;
  omzet: number;
  jumlahTransaksi: number;
  target: number | null;
  capaianPersen: number | null;
  catatanKendala: string | null;
  bukti: { id: string; tipe: string | null } | null;
  status: string;
  catatanPendamping: string | null;
  dikirimPada: string | null;
  diverifikasiOleh: string | null;
  diverifikasiPada: string | null;
}

export interface TrenMinggu {
  mingguKe: number;
  target: number | null;
  realisasi: number | null;
  status: string;
}

export interface BinaanDetail {
  talentaId: string;
  usaha: { id: string; nama: string | null };
  pemilik: string | null;
  batch: { id: string; nama: string; tahap: string } | null;
  status: string;
  mingguBerjalan: number;
  jumlahMinggu: number | null;
  targetMingguan: number | null;
  tren: TrenMinggu[];
  laporan: {
    id: string;
    mingguKe: number;
    omzet: number;
    jumlahTransaksi: number;
    target: number | null;
    capaianPersen: number | null;
    status: string;
    catatanPendamping: string | null;
    dikirimPada: string | null;
    diverifikasiPada: string | null;
  }[];
  rekomendasiPitching: boolean;
  rekomendasiOleh: string | null;
  rekomendasiPada: string | null;
  layakRekomendasi: boolean;
}

export function berkasUrl(id: string): string {
  return `/panel/operasional/berkas/${id}`;
}

/**
 * Profil operator dari kontrak `GET /panel/operasional/me` (phase Y01).
 * Bentuk camelCase milik ekstensi operasional — bukan bentuk `directus_users`.
 */

export type RoleKey = "provinsi" | "kabkota" | "pendamping" | "umkm";

export interface OperatorProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  role: RoleKey;
  roleLabel: string;
  instansi: string;
  kota: { id: number; nama: string } | null;
  usaha: { id: string; nama: string; nib: string | null } | null;
}

/** Satu baris log aktivitas sesi dari `GET /panel/operasional/aktivitas`. */
export interface AktivitasItem {
  id: number;
  action: string;
  collection: string;
  item: string | null;
  timestamp: string;
  ip: string | null;
  userAgent: string | null;
}
