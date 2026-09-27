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
