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

export interface ClusterItem {
  id: string
  name: string
  value: number
  formattedValue?: string
  percentage?: number
}

export interface TopCategoryItem {
  code: string
  name: string
  value: number
  formattedValue?: string
}

export interface GenderDistributionData {
  malePercentage: number
  femalePercentage: number
  maleCount?: number
  femaleCount?: number
  totalWorkers?: number
}

export interface KbliSubItem {
  title: string
  value: number | string
  formattedValue?: string
  category: ScaleCategory
}

export interface KbliCategoryItem {
  code: string
  title: string
  description: string
  totalUmkm: number | string
  formattedTotal?: string
  subItems?: KbliSubItem[]
  isExpandedDefault?: boolean
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
  desil?: string
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
