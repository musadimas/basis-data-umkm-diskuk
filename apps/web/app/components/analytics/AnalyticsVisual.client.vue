<script setup lang="ts">
import type { AnalyticsGroup, AnalyticsVisual } from "~/types/analytics"
import { Orientation, StackedBar } from "@unovis/ts"
import { VisAxis, VisStackedBar, VisTooltip, VisXYContainer } from "@unovis/vue"
import { formatAnalyticsNumber, formatAnalyticsPercent } from "~/lib/analytics-format"

const props = defineProps<{
  groups: AnalyticsGroup[]
  visual: AnalyticsVisual
  tableOpen?: boolean
}>()
const emit = defineEmits<{ select: [group: AnalyticsGroup]; "update:tableOpen": [open: boolean] }>()

const CHART_LIMIT = 20
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
const totals = computed(() => {
  const map = new Map<string, { group: AnalyticsGroup; value: number; values: number[] }>()
  for (const group of props.groups) {
    const entry = map.get(group.key) || { group, value: 0, values: seriesKeys.value.map(() => 0) }
    entry.value += Number(group.value || 0)
    const index = group.breakdown?.label ? seriesKeys.value.indexOf(group.breakdown.label) : -1
    if (index >= 0) entry.values[index] = Number(group.value || 0)
    map.set(group.key, entry)
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
})
/** Horizontal bars grow upwards from index 0, so indexes are inverted to keep the largest group on top. */
const chartRows = computed(() => {
  const list = totals.value.slice(0, CHART_LIMIT)
  return list.map((entry, position) => ({
    index: list.length - 1 - position,
    label: entry.group.label,
    group: entry.group,
    value: entry.value,
    share: entry.group.share,
    values: entry.values,
  }))
})
type ChartRow = (typeof chartRows.value)[number]
const hiddenCount = computed(() => Math.max(0, totals.value.length - chartRows.value.length))
const stacked = computed(() => props.visual === "stacked" && seriesKeys.value.length > 0)
const donut = computed(() => props.visual === "donut")
const showChart = computed(() => props.visual !== "table" && !props.tableOpen && chartRows.value.length > 0)

const barX = (row: ChartRow) => row.index
const barY = computed(() =>
  stacked.value
    ? seriesKeys.value.map((_, index) => (row: ChartRow) => row.values[index] || 0)
    : [(row: ChartRow) => row.value],
)
const barColors = computed(() => (stacked.value ? seriesKeys.value.map((_, index) => SERIES_COLORS[index % SERIES_COLORS.length]!) : SERIES_COLORS[0]!))
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
      <button type="button" class="shrink-0 text-xs font-semibold underline" @click="emit('update:tableOpen', !tableOpen)">
        {{ tableOpen ? "Sembunyikan tabel" : "Lihat tabel" }}
      </button>
    </div>

    <p class="sr-only">
      {{ groups.map((group) => `${group.label}: ${formatAnalyticsNumber(group.value)} UMKM`).join(". ") }}
    </p>

    <div class="min-h-0 flex-1 overflow-auto" data-lenis-prevent-wheel>
      <div v-if="showChart" :class="donut ? 'h-full min-h-[140px]' : undefined" :style="donut ? undefined : { height: `${barHeight}px` }">
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
      <span v-if="hiddenCount">Menampilkan {{ chartRows.length }} kelompok teratas; {{ hiddenCount }} lainnya ada di panel rincian.</span>
      <span v-else-if="donut">Klik segmen untuk menyorot; filter kelompok dari panel rincian.</span>
      <span v-else>Klik batang untuk memfilter kelompok.</span>
      <span v-if="visual === 'choropleth'"> Peta belum tersedia untuk kelompok ini; ditampilkan sebagai batang.</span>
      <span v-if="stacked"> Seri: {{ seriesKeys.join(", ") }}.</span>
    </p>
  </section>
</template>
