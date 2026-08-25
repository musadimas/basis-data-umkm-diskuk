/** Tipe data API endpoint Directus `tabular` (halaman Data Tabular UMKM). */

export type TabularSkalaApi = "micro" | "small" | "medium"

/** Satu baris usaha dari endpoint /panel/tabular/. */
export interface TabularRowItem {
  id: string
  nama: string
  skala: TabularSkalaApi
  produkUtama: string | null
  kegiatanUtama: string | null
  kodeKbli: string | null
  kategoriKbli: string | null
  kota: string
  kecamatan: string
  kelurahan: string
}

export interface TabularRowsResponse {
  data: TabularRowItem[]
  meta: {
    filterCount: number
    page: number
    pageSize: number
    // Scale breakdown (single grouped COUNT, menghindari 3 request)
    mikro?: number
    kecil?: number
    menengah?: number
    // Cursor pagination (signed)
    nextCursor?: string | null
    hasNext?: boolean
  }
}

/** Satu titik spasial dari endpoint /panel/tabular/spasial. */
export interface TabularSpasialPoint {
  id: string
  nama: string
  skala: TabularSkalaApi
  produkUtama: string | null
  kegiatanUtama: string | null
  kodeKbli: string | null
  kategoriKbli: string | null
  kota: string
  kecamatan: string
  latitude: number
  longitude: number
}

export interface TabularSpasialResponse {
  data: TabularSpasialPoint[]
  meta: {
    filterCount: number
    mikro: number
    kecil: number
    menengah: number
    limit: number
  }
}

/** Satu titik spasial dari endpoint /panel/tabular/spasial. */
export interface TabularSpasialPoint {
  id: string
  nama: string
  skala: TabularSkalaApi
  produkUtama: string | null
  kegiatanUtama: string | null
  kodeKbli: string | null
  kategoriKbli: string | null
  kota: string
  kecamatan: string
  latitude: number
  longitude: number
}

export interface TabularSpasialResponse {
  data: TabularSpasialPoint[]
  meta: {
    filterCount: number
    mikro: number
    kecil: number
    menengah: number
    limit: number
  }
}

export interface TabularKotaOption {
  id: number
  nama: string
}

export interface TabularKecamatanOption {
  id: number
  nama: string
  kotaId: number
}

export interface TabularKbliOption {
  kode: string
  kategori: string
}

export interface TabularOptions {
  kota: TabularKotaOption[]
  kecamatan: TabularKecamatanOption[]
  kategori: string[]
  kbli: TabularKbliOption[]
}

export interface TabularKelurahanItem {
  id: number
  nama: string
}

/** Metadata arsip PMTiles titik UMKM dari /panel/tabular/spasial/tileset. */
export interface TabularSpatialTileset {
  url: string
  updatedAt: string
  pointCount: number
}

export interface TabularApiResponse<
  T,
> {
  data: T
}

/** State filter tabular (draft maupun terapan); "semua" = tanpa filter. */
export interface TabularFilters {
  kabupatenKota: string; // id kota dari Directus, "semua" = semua
  kecamatan: string;
  desaKelurahan: string;
  skala: string;
  kegiatanUsaha: string; // kategori KBLI
  kodeKbli: string;
}
