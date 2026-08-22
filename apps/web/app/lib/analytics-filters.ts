import type { AnalyticsField, AnalyticsFilter } from "~/types/analytics"

export interface FilterOption {
  id: string
  label: string
}

/**
 * Konfigurasi cascade filter wilayah/KBLI. Semua nilai diambil dari endpoint
 * metadata/options yang ber-budget server-side (tabel referensi kecil +
 * statement timeout), jadi tidak ada jalur baru ke fact table 5,4 jt baris.
 */
export interface FilterCascade {
  /** Field yang menyediakan opsi induk (mis. kota untuk kecamatan). */
  parentField?: string
  /** Nilai filter aktif pada field induk yang menjadi scope opsi anak. */
  parentValue?: string
}

interface FilterFieldConfig {
  operators: Array<AnalyticsFilter["operator"]>
  /** Opsi statis bila nilai terhimpun dari enum kecil, bukan endpoint. */
  staticOptions?: FilterOption[]
  cascade?: (draft: { filters: AnalyticsFilter[] }) => FilterCascade | undefined
}

const EQUALITY_ONLY: Array<AnalyticsFilter["operator"]> = ["eq", "neq"]
const TEXT_OPERATORS: Array<AnalyticsFilter["operator"]> = ["eq", "neq", "contains", "starts_with"]

const SKALA_OPTIONS: FilterOption[] = [
  { id: "micro", label: "Mikro" },
  { id: "small", label: "Kecil" },
  { id: "medium", label: "Menengah" },
]

const STATUS_OPTIONS: FilterOption[] = [
  { id: "active", label: "Aktif" },
  { id: "archived", label: "Diarsipkan" },
]

function filterValue(filters: AnalyticsFilter[], fieldId: string): string | undefined {
  const filter = filters.find((item) => item.fieldId === fieldId && item.operator !== "neq")
  if (!filter) return undefined
  return Array.isArray(filter.value) ? filter.value[0] : filter.value
}

/** Peta perilaku filter per field. Field di luar peta memakai input teks. */
const FILTER_FIELDS = {
  kota_nama: { operators: EQUALITY_ONLY },
  kota_kode: { operators: EQUALITY_ONLY },
  kecamatan_nama: {
    operators: EQUALITY_ONLY,
    cascade: (draft: { filters: AnalyticsFilter[] }) => ({ parentField: "kota_nama", parentValue: filterValue(draft.filters, "kota_nama") }),
  },
  kelurahan_nama: {
    operators: EQUALITY_ONLY,
    cascade: (draft: { filters: AnalyticsFilter[] }) => ({ parentField: "kecamatan_nama", parentValue: filterValue(draft.filters, "kecamatan_nama") }),
  },
  sektor_kbli: { operators: EQUALITY_ONLY },
  kbli_kode: {
    operators: EQUALITY_ONLY,
    cascade: (draft: { filters: AnalyticsFilter[] }) => ({ parentField: "sektor_kbli", parentValue: filterValue(draft.filters, "sektor_kbli") }),
  },
  skala_dilaporkan: { operators: EQUALITY_ONLY, staticOptions: SKALA_OPTIONS },
  status_usaha: { operators: EQUALITY_ONLY, staticOptions: STATUS_OPTIONS },
} satisfies Record<string, FilterFieldConfig>

export type FilterFieldKey = keyof typeof FILTER_FIELDS

/** Akses ber-index yang aman: field tak dikenal mengembalikan undefined. */
export function filterConfigFor(fieldId: string): FilterFieldConfig | undefined {
  const config = Object.getOwnPropertyDescriptor(FILTER_FIELDS, fieldId)
  // SAFETY: getOwnPropertyDescriptor mengembalikan nilai bertipe FilterFieldConfig
  // untuk key milik FILTER_FIELDS, undefined untuk key lain — tanpa widening.
  return config?.value as FilterFieldConfig | undefined
}

/** Daftar field yang punya konfigurasi khusus (untuk dokumentasi/tests). */
export function isStructuredFilterField(fieldId: string): boolean {
  return Object.prototype.hasOwnProperty.call(FILTER_FIELDS, fieldId)
}

export function operatorsFor(field: AnalyticsField | undefined): Array<AnalyticsFilter["operator"]> {
  if (!field) return TEXT_OPERATORS
  return filterConfigFor(field.key)?.operators ?? TEXT_OPERATORS
}
