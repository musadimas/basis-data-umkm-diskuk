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
  geometryReady?: boolean
  geometrySource?: {
    name: string
    edition: string
    url: string
    regions: number
  }
  sectors: InfografisSectorItem[]
  topKbli: InfografisKbliItem[]
  kbli: InfografisKbliItem[]
  workforce?: {
    male: number
    female: number
    total: number
    malePercentage: number
    femalePercentage: number
  }
}
