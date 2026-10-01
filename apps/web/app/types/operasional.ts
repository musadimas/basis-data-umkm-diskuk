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
  /** Hanya hasil konsultasi klinik yang terverifikasi (R04); tanpa diagnosis, catatan, atau rencana aksi. */
  hasilKonsultasi: UsahaHasilKonsultasi[];
}

/** Satu outcome klinik terverifikasi pada profil usaha; `atribut` memakai kunci camelCase `ATRIBUT_JABAR`. */
export interface UsahaHasilKonsultasi {
  id: string;
  versi: number;
  nomorTiket: string;
  poli: string;
  diverifikasiOleh: string | null;
  diverifikasiPada: string | null;
  items: { atribut: string; jenis: "kepatuhan" | "perbaikan" }[];
}

/**
 * Profil operator dari kontrak `GET /panel/operasional/me` (phase Y01).
 * Bentuk camelCase milik ekstensi operasional — bukan bentuk `directus_users`.
 * (RoleKey/OperatorProfile yang lama dihapus §2.5: tak ada pemakai; peran dibaca
 * sebagai AppRole lewat useAuth dan badge lewat appRoleBadge.)
 */

export interface AspekPerkembangan {
  totalUsaha: number;
  sumber: string;
  definisiVersi: string;
  kepatuhanRegulasi: false;
  aspek: Array<{
    id: string;
    label: string;
    indikator: Array<{
      id: string;
      label: string;
      sumber: string;
      ya: number;
      tidak: number;
      diketahui: number;
      belumAdaData: number;
      total: number;
      persentase: number | null;
    }>;
  }>;
}
