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

export interface TabularApiResponse<
  T,
> {
  data: T
}
