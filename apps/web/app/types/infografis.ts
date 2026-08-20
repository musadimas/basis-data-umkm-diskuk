export interface InfografisKbliItem {
  code: string
  name: string
  description: string | null
  total: number
  mikro: number
  kecil: number
  menengah: number
}

export interface InfografisSectorItem {
  code: string
  name: string
  total: number
  mikro: number
  kecil: number
  menengah: number
  percentage: number
}

export interface InfografisNibData {
  total: number
  withNib: number
  withoutNib: number
  withPercentage: number
  withoutPercentage: number
}

export interface InfografisMarketingMethod {
  key: string
  label: string
  value: number
  percentage: number
}

export interface InfografisRegion {
  id: string
  name: string
  value: number
  code?: string
  geometry?: {
    type: "Polygon" | "MultiPolygon"
    coordinates: unknown[]
  }
}

export interface InfografisData {
  scales: {
    total: number
    mikro: number
    kecil: number
    menengah: number
  }
  regions: InfografisRegion[]
  regionLevel?: "kota" | "kecamatan" | "kelurahan"
  geometryReady?: boolean
  geometryMissing?: number
  geometrySource?: {
    name: string
    edition: string
    url: string
    regions: number
  }
  sectors: InfografisSectorItem[]
  topKbli: InfografisKbliItem[]
  kbli: InfografisKbliItem[]
  nib?: InfografisNibData
  marketingMethods?: InfografisMarketingMethod[]
  workforce?: {
    male: number
    female: number
    total: number
    malePercentage: number
    femalePercentage: number
  }
}
