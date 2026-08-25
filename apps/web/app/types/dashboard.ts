export type ScaleCategory = 'total' | 'mikro' | 'kecil' | 'menengah' | 'neutral'

export interface ScaleStatItem {
  id: string
  title: string
  value: number | string
  formattedValue?: string
  category: ScaleCategory
  subtitle?: string
  buttonText?: string
  buttonHref?: string
}

export interface GenderDistributionData {
  malePercentage: number
  femalePercentage: number
  maleCount?: number
  femaleCount?: number
  totalWorkers?: number
}

export interface KbliCategoryItem {
  /** Huruf kategori KBLI (A–U). */
  code: string
  title: string
  totalUmkm: number
  /** Bagian dari total UMKM terfilter, dalam persen (0–100). */
  percentage?: number
  mikro?: number
  kecil?: number
  menengah?: number
}

/** Kode KBLI spesifik di bawah sebuah sektor, untuk drill-down. */
export interface KbliCodeItem {
  code: string
  title: string | null
  totalUmkm: number
  mikro?: number
  kecil?: number
  menengah?: number
}

export type SkalaUsaha = "mikro" | "kecil" | "menengah"

export interface TabularUmkmItem {
  id: string
  namaUsaha: string
  skala: SkalaUsaha
  kabupatenKota: string
  kecamatan: string
  desaKelurahan?: string
  produkUtama: string
  kegiatanUsaha: string
  kodeKbli: string
}

export interface MapRegionItem {
  id: string
  name: string
  count: number
  tier: 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4' | 'tier-5'
  pathData?: string
}

export interface SpasialUmkmItem extends TabularUmkmItem {
  /** Koordinat geografis (WGS84) untuk penempatan marker di peta. */
  latitude: number
  longitude: number
}

export interface DashboardNavMenuItem {
  title: string
  href: string
  iconName: string
  active?: boolean
  badge?: string
}
