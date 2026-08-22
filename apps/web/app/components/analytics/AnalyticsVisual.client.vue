<script setup lang="ts">
import type { AnalyticsGroup, AnalyticsVisual } from "~/types/analytics"
import { Orientation, StackedBar } from "@unovis/ts"
import { VisAxis, VisStackedBar, VisTooltip, VisXYContainer } from "@unovis/vue"
import { formatAnalyticsNumber, formatAnalyticsPercent } from "~/lib/analytics-format"

const props = defineProps<{
  groups: AnalyticsGroup[]
  visual: AnalyticsVisual
  tableOpen?: boolean
  /** Key kelompok yang sedang menyeleksi canvas (cross-filter aktif). */
  selectedKey?: string | null
  /** Ikuti config.includeOthers: false = jangan agregasi “Lainnya” di klien. */
  includeOthers?: boolean
}>()
const emit = defineEmits<{ select: [group: AnalyticsGroup]; clearSelect: []; "update:tableOpen": [open: boolean] }>()

const CHART_LIMIT = 20
/** ux-spec §7: donut hanya untuk part-to-whole dengan maksimal 6 kategori. */
const DONUT_LIMIT = 6
const BAR_SLOT_HEIGHT = 22
const SERIES_COLORS = ["#059669", "#0d9488", "#0ea5e9", "#7c3aed", "#f59e0b", "#dc2626"]

const visualLabel = computed(() => ({
  kpi: "KPI",
  bar: "batang",
  stacked: "batang bertumpuk",
  donut: "donat",
  histogram: "histogram",
  choropleth: "peta",
  table: "tabel",
}[props.visual]))

/** Groups arrive as flat rows: one row per group, or one row per group+breakdown pair. */
const seriesKeys = computed(() => {
  const keys: string[] = []
  for (const group of props.groups) {
    const label = group.breakdown?.label
    if (label && !keys.includes(label)) keys.push(label)
  }
  return keys
})

interface TotalEntry { group: AnalyticsGroup; value: number; values: number[] }

/**
 * Satu baris per kelompok (breakdown dijumlahkan per seri). Saat includeOthers
 * aktif dan jumlah kelompok melewati batas chart/donut, sisanya diagregasi ke
 * satu baris “Lainnya” (product-spec §6.5) sehingga total tetap terjaga.
 */
const totals = computed<TotalEntry[]>(() => {
  const map = new Map<string, TotalEntry>()
  const keys = seriesKeys.value
  for (const group of props.groups) {
    const entry = map.get(group.key) || { group, value: 0, values: keys.map(() => 0) }
    entry.value += Number(group.value || 0)
    const index = group.breakdown?.label ? keys.indexOf(group.breakdown.label) : -1
    if (index >= 0) entry.values[index] = Number(group.value || 0)
    map.set(group.key, entry)
  }
  const sorted = [...map.values()].sort((a, b) => b.value - a.value)

  // Kelompok unknown/tidak diketahui tidak boleh hilang di dalam “Lainnya”.
  const isUnknown = (entry: TotalEntry) => entry.group.key === "unknown" || /tidak diketahui|tidak ada kode|tidak terpetakan/i.test(entry.group.label)
  // Server (query-service.js) sudah bisa mengirim grup “Lainnya” hasil agregasi
  // includeOthers-nya sendiri. Jangan dihitung ulang — pisahkan, gabungkan dengan
  // overflow klien, dan tempatkan di urutan terakhir agar tidak pernah tampil
  // sebagai kelompok peringkat atas.
  const isServerOthers = (entry: TotalEntry) => entry.group.key === "others"
  const limit = props.visual === "donut" ? DONUT_LIMIT : CHART_LIMIT
  const keepUnknown = sorted.filter(isUnknown)
  const serverOthers = sorted.filter(isServerOthers)
  const regular = sorted.filter((entry) => !isUnknown(entry) && !isServerOthers(entry))
  const overflowValue = regular.slice(limit).reduce((sum, entry) => sum + entry.value, 0)
  const kept = [...regular.slice(0, limit), ...keepUnknown]
  kept.sort((a, b) => b.value - a.value)
  const grandTotal = kept.reduce((sum, entry) => sum + entry.value, 0) + overflowValue + serverOthers.reduce((sum, entry) => sum + entry.value, 0)
  const othersValue = serverOthers.reduce((sum, entry) => sum + entry.value, 0)
  const includeOverflow = Boolean(overflowValue) && props.includeOthers !== false
  const totalOthers = othersValue + (includeOverflow ? overflowValue : 0)
  if (!totalOthers) return kept
  const othersShare = grandTotal ? Number((totalOthers * 100 / grandTotal).toFixed(1)) : 0
  return [...kept, { group: { key: "others", label: "Lainnya", value: totalOthers, share: othersShare }, value: totalOthers, values: keys.map(() => 0) }]
})

interface ChartRow extends TotalEntry {
  index: number
  label: string
  share: number
}

/** Horizontal bars grow upwards from index 0, so indexes are inverted to keep the largest group on top. */
const chartRows = computed<ChartRow[]>(() => {
  const list = totals.value
  return list.map((entry, position) => ({
    ...entry,
    index: list.length - 1 - position,
    label: entry.group.label,
    share: entry.group.share,
  }))
})
/**
 * “Lainnya” mengubah hitungan kelompok tampil vs tersembunyi; bandingkan jumlah
 * key unik sumber dengan jumlah baris chart.
 */
const hiddenCount = computed(() =>
  Math.max(0, new Set(props.groups.map((group) => group.key)).size + (totals.value.some((entry) => entry.group.key === "others") ? 1 : 0) - totals.value.filter((entry) => entry.group.key !== "others").length),
)
const stacked = computed(() => props.visual === "stacked" && seriesKeys.value.length > 0)
const donut = computed(() => props.visual === "donut")

// ── Choropleth: geometri referensi + nilai dari agregat analitik ────────────
/**
 * Geometri diambil sekali dari endpoint infografis/map (poligon batas wilayah
 * hasil validasi BIG/Peta Nusa — tabel referensi, bukan fact table) dan
 * di-cache pada level modul. Nilai per-wilayah TIDAK diambil dari endpoint
 * tersebut, melainkan dicocokkan dari grup agregat analitik yang sedang aktif,
 * sehingga tidak ada query agregasi baru ke 5,4 jt baris.
 */
interface RegionGeometry { id: string; name: string; code?: string; geometry?: unknown }
let geometryCache: RegionGeometry[] | null = null
let geometryPromise: Promise<RegionGeometry[]> | null = null

async function loadGeometry(): Promise<RegionGeometry[]> {
  if (geometryCache) return geometryCache
  geometryPromise ||= $fetch<{ data: { regions: RegionGeometry[] } }>("/panel/infografis/map")
    .then((response) => {
      geometryCache = response.data.regions || []
      return geometryCache
    })
    .catch(() => {
      geometryCache = []
      return geometryCache
    })
    .finally(() => { geometryPromise = null })
  return geometryPromise
}

const showChoropleth = computed(() => props.visual === "choropleth" && !props.tableOpen)
const regionRows = ref<Array<{ id: string; name: string; value: number; share: number; geometry?: unknown }>>([])
const choroplethPending = ref(false)
const choroplethFailed = ref(false)

watch([showChoropleth, () => props.groups], async ([active]) => {
  if (!active) return
  // Cocokkan nama wilayah secara case-insensitive; kode wilayah dipakai untuk
  // dimensi kota_kode/kota_id yang key-nya berupa kode BPS.
  const byName = new Map<string, AnalyticsGroup>()
  const byCode = new Map<string, AnalyticsGroup>()
  for (const group of props.groups) {
    byName.set(group.label.toLowerCase(), group)
    byCode.set(String(group.key), group)
  }
  choroplethPending.value = true
  try {
    const regions = await loadGeometry()
    if (!showChoropleth.value) return
    regionRows.value = regions.map((region) => {
      const group = byName.get(region.name.toLowerCase()) ?? (region.code ? byCode.get(region.code) : undefined)
      return {
        id: region.id,
        name: region.name,
        value: Number(group?.value ?? 0),
        share: Number(group?.share ?? 0),
        geometry: region.geometry,
      }
    })
    const matchedValue = regionRows.value.reduce((sum, row) => sum + row.value, 0)
    const totalValue = props.groups.reduce((sum, group) => sum + Number(group.value || 0), 0)
    choroplethFailed.value = matchedValue === 0 && totalValue > 0
  } finally {
    choroplethPending.value = false
  }
}, { immediate: true })

/** Satu poligon wilayah yang siap dirender: path SVG + warna + nilai. */
interface RegionPolygon { id: string; name: string; path: string; color: string; value: number; share: number }

type Coordinates = number[] | Coordinates[]

/**
 * Semua poligon diproyeksikan dengan SATU transformasi bersama (equirectangular
 * + normalisasi ke viewBox 100×62), bukan per fitur, agar posisi antarwilayah
 * tetap benar secara geografis. Koordinat Jabar hanya ~1°×~2° sehingga distorsi
 * equirectangular dapat diterima untuk visual ringkas tanpa library peta.
 */
function buildRegionPolygons(rows: Array<{ id: string; name: string; value: number; share: number; geometry?: unknown }>): RegionPolygon[] {
  const ringsPerRow: Array<Array<Array<[number, number]>>> = []
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity
  for (const row of rows) {
    // SAFETY: geometri berasal dari endpoint infografis/map (GeoJSON Polygon/MultiPolygon
    // yang sudah lolos ST_IsValid di server); bentuk non-objek/array diabaikan.
    const geometry = row.geometry
    if (!geometry || Array.isArray(geometry)) { ringsPerRow.push([]); continue }
    // SAFETY: geometry sudah diverifikasi objek non-array; endpoint map hanya
    // mengirim GeoJSON { type, coordinates } (lihat attachAuthoritativeGeometry).
    const record = geometry as { type?: string; coordinates?: unknown }
    if (!record.coordinates) { ringsPerRow.push([]); continue }
    // MultiPolygon: polygon → ring → titik. Polygon langsung: ring → titik.
    // SAFETY: cabang di atas sudah memverifikasi type === "MultiPolygon" untuk bentuk bersarang tiga level.
    const polygons = record.type === "MultiPolygon" ? record.coordinates as Coordinates[] : [record.coordinates as Coordinates]
    const rings: Array<Array<[number, number]>> = []
    for (const polygon of polygons) {
      // SAFETY: polygon berasal dari GeoJSON terverifikasi di atas; ring adalah daftar titik [lng, lat].
      for (const ring of polygon as Coordinates[]) {
        // SAFETY: filter type-guard memastikan hanya pasangan angka [lng, lat] yang lolos.
        const points = (ring as unknown[]).filter((point): point is [number, number] =>
          Array.isArray(point) && typeof point[0] === "number" && typeof point[1] === "number")
        if (points.length < 3) continue
        // Proyeksi awal: skala tetap, sumbu Y dibalik (lintang utara = atas).
        // SAFETY: lng/lat sudah diverifikasi number oleh type-guard points di atas.
        const projected = points.map(([lng, lat]) => [lng * 100, -lat * 100] as [number, number])
        for (const [x, y] of projected) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
        rings.push(projected)
      }
    }
    ringsPerRow.push(rings)
  }
  if (!ringsPerRow.some((rings) => rings.length)) return []
  const width = Math.max(maxX - minX, 0.001)
  const height = Math.max(maxY - minY, 0.001)
  const scale = Math.min(96 / width, 58 / height)
  const offsetX = (100 - width * scale) / 2 - minX * scale
  const offsetY = (62 - height * scale) / 2 - minY * scale
  const toPath = (rings: Array<Array<[number, number]>>) => rings.map((ring) =>
    ring.map(([x, y], index) => `${index === 0 ? "M" : "L"}${(x * scale + offsetX).toFixed(2)} ${(y * scale + offsetY).toFixed(2)}`).join("") + "Z",
  ).join("")
  return rows.flatMap((row, rowIndex) => {
    const path = toPath(ringsPerRow[rowIndex] || [])
    if (!path) return []
    return [{ id: row.id, name: row.name, path, color: regionColor(row), value: row.value, share: row.share }]
  })
}

const choroplethPolygons = computed(() => buildRegionPolygons(regionRows.value))

const choroplethMax = computed(() => Math.max(0, ...regionRows.value.map((row) => row.value)))
function regionColor(row: { value: number }): string {
  const max = choroplethMax.value
  if (max <= 0 || row.value <= 0) return "#e2e8f0"
  const ratio = row.value / max
  if (ratio > 0.75) return "#0e7490"
  if (ratio > 0.5) return "#2563eb"
  if (ratio > 0.25) return "#16a75c"
  return "#fb923c"
}
function onRegionClick(region: { name: string }) {
  const group = props.groups.find((item) => item.label.toLowerCase() === region.name.toLowerCase())
  if (!group) return
  // Klik wilayah yang sudah terpilih = batal pilih (toggle), sesuai model cross-filter.
  if (props.selectedKey === group.key) emit("clearSelect")
  else emit("select", group)
}

const showChart = computed(() => props.visual !== "table" && !props.tableOpen && !showChoropleth.value && chartRows.value.length > 0)

const barX = (row: ChartRow) => row.index
/**
 * Selected state cross-filter harus terlihat jelas selain warna (ux-spec §8):
 * batang terpilih memakai warna seri, sisanya diredupkan ke abu-abu.
 */
function barColorFor(row: ChartRow): string {
  if (!props.selectedKey) return SERIES_COLORS[0]!
  return row.group.key === props.selectedKey ? SERIES_COLORS[0]! : "#cbd5e1"
}
const barColors = computed(() =>
  stacked.value
    ? seriesKeys.value.map((_, index) => SERIES_COLORS[index % SERIES_COLORS.length]!)
    : (row: ChartRow) => barColorFor(row),
)
const selectedRow = computed(() => chartRows.value.find((row) => row.group.key === props.selectedKey) || null)
const categoryTicks = computed(() => chartRows.value.map((row) => row.index))
const categoryLabels = computed(() => new Map(chartRows.value.map((row) => [row.index, row.label])))
const categoryTick = (tick: number | Date) => categoryLabels.value.get(Number(tick)) || ""
const valueTick = (tick: number | Date) => formatAnalyticsNumber(Number(tick))
const tooltip = computed(() => ({
  [StackedBar.selectors.bar]: (row: ChartRow) =>
    `<div class="rounded-md border bg-background px-2 py-1 text-xs shadow-sm"><strong>${row.label}</strong><br>${formatAnalyticsNumber(row.value)} · ${formatAnalyticsPercent(row.share)}</div>`,
}))
const barEvents = computed(() => ({
  [StackedBar.selectors.bar]: { click: (row: ChartRow) => emit("select", row.group) },
}))

const barY = computed(() =>
  stacked.value
    ? seriesKeys.value.map((_, index) => (row: ChartRow) => row.values[index] || 0)
    : [(row: ChartRow) => row.value],
)
const donutRows = computed(() => chartRows.value.map((row) => ({ label: row.label, value: row.value })))
/** Bars keep a fixed slot height so category labels never collide; the panel scrolls instead. */
const barHeight = computed(() => Math.max(140, chartRows.value.length * BAR_SLOT_HEIGHT + 24))
</script>

<template>
  <section
    class="flex h-[280px] min-h-0 flex-col gap-1.5 rounded-lg border bg-card p-2.5 lg:h-full"
    aria-labelledby="visual-title"
  >
    <div class="flex shrink-0 items-center justify-between gap-2">
      <h2 id="visual-title" class="truncate text-xs font-bold uppercase tracking-wide">Visualisasi {{ visualLabel }}</h2>
      <div class="flex shrink-0 items-center gap-2">
        <button
          v-if="selectedRow"
          type="button"
          class="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white"
          :title="'Klik untuk menghapus filter kelompok'"
          @click="emit('clearSelect')"
        >
          {{ selectedRow.label }} ✕
        </button>
        <button type="button" class="text-xs font-semibold underline" @click="emit('update:tableOpen', !tableOpen)">
          {{ tableOpen ? "Sembunyikan tabel" : "Lihat tabel" }}
        </button>
      </div>
    </div>

    <p class="sr-only">
      {{ groups.map((group) => `${group.label}: ${formatAnalyticsNumber(group.value)} UMKM`).join(". ") }}
    </p>

    <div class="min-h-0 flex-1 overflow-auto" data-lenis-prevent-wheel>
      <!-- Choropleth SVG ringan: poligon statis + tooltip native, tanpa tile peta -->
      <div v-if="showChoropleth" class="h-full min-h-[220px]">
        <p v-if="choroplethPending && !choroplethPolygons.length" class="py-8 text-center text-xs text-muted-foreground">Menyiapkan peta…</p>
        <div v-else-if="choroplethFailed" class="py-6 text-center">
          <p class="text-xs text-muted-foreground">Peta belum tersedia untuk kelompok ini.</p>
          <p class="mt-1 text-[10px] text-muted-foreground">Coba ganti “Kelompokkan menurut” ke Kabupaten/kota.</p>
        </div>
        <template v-else>
          <svg viewBox="0 0 100 62" class="w-full" role="img" aria-label="Peta sebaran UMKM per wilayah">
            <g
              v-for="polygon in choroplethPolygons"
              :key="polygon.id"
              :fill="selectedKey && selectedKey !== polygon.id ? '#cbd5e1' : polygon.color"
              :fill-opacity="!selectedKey || selectedKey === polygon.id ? 0.85 : 0.5"
              stroke="#ffffff"
              :stroke-width="selectedKey === polygon.id ? 0.5 : 0.15"
              class="cursor-pointer hover:[fill-opacity:1]"
              @click="onRegionClick(polygon)"
            >
              <title>{{ `${polygon.name}: ${formatAnalyticsNumber(polygon.value)} UMKM (${formatAnalyticsPercent(polygon.share)})` }}</title>
              <path :d="polygon.path" />
            </g>
          </svg>
          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span class="flex items-center gap-1"><span class="inline-block size-2 rounded-xs" style="background:#fb923c" /> rendah</span>
            <span class="flex items-center gap-1"><span class="inline-block size-2 rounded-xs" style="background:#16a75c" /> sedang</span>
            <span class="flex items-center gap-1"><span class="inline-block size-2 rounded-xs" style="background:#2563eb" /> tinggi</span>
            <span class="flex items-center gap-1"><span class="inline-block size-2 rounded-xs" style="background:#0e7490" /> tertinggi</span>
            <span>Klik wilayah untuk memfilter.</span>
          </div>
        </template>
      </div>

      <div v-else-if="showChart" :class="donut ? 'h-full min-h-[140px]' : undefined" :style="donut ? undefined : { height: `${barHeight}px` }">
        <UiDonutChart
          v-if="donut"
          class="h-full! w-full!"
          :data="donutRows"
          category="value"
          index="label"
          :colors="SERIES_COLORS"
          :value-formatter="(value: number) => formatAnalyticsNumber(value)"
        />
        <VisXYContainer
          v-else
          :data="chartRows"
          :style="{ height: '100%' }"
          :margin="{ top: 16, right: 8, bottom: 4, left: 0 }"
        >
          <VisStackedBar
            :x="barX"
            :y="barY"
            :color="barColors"
            :orientation="Orientation.Horizontal"
            :rounded-corners="3"
            :bar-padding="0.25"
            :bar-min-height="2"
            cursor="pointer"
            :events="barEvents"
          />
          <VisAxis
            type="y"
            position="left"
            :tick-values="categoryTicks"
            :tick-format="categoryTick"
            :tick-text-width="110"
            tick-text-trim-type="middle"
            tick-text-fit-mode="trim"
            :grid-line="false"
            :tick-line="false"
            :domain-line="false"
          />
          <VisAxis type="x" position="top" :num-ticks="3" :tick-format="valueTick" :domain-line="false" :tick-line="false" />
          <VisTooltip :triggers="tooltip" />
        </VisXYContainer>
      </div>

      <AnalyticsDataTable v-else-if="tableOpen || visual === 'table'" :groups="totals.map((entry) => entry.group)" />

      <p v-else class="py-8 text-center text-xs text-muted-foreground">Belum ada data untuk filter ini.</p>
    </div>

    <p v-if="showChart" class="shrink-0 text-[10px] text-muted-foreground">
      <span v-if="hiddenCount">Kelompok kecil diagregasi menjadi “Lainnya”; rincian lengkap ada di panel rincian.</span>
      <span v-else-if="donut">Klik segmen untuk menyorot; filter kelompok dari panel rincian.</span>
      <span v-else>Klik batang untuk memfilter kelompok.</span>
      <span v-if="stacked"> Seri: {{ seriesKeys.join(", ") }}.</span>
    </p>
  </section>
</template>
