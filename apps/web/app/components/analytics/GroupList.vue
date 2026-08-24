<script setup lang="ts">
import type { AnalyticsGroup, AnalyticsMetric } from "~/types/analytics"
import { formatAnalyticsMetricValue, formatAnalyticsPercent } from "~/lib/analytics-format"

const props = defineProps<{
  groups: AnalyticsGroup[]
  metric?: AnalyticsMetric
  dimensionLabel?: string
  drillField?: string | null
  /** Key kelompok yang sedang menyeleksi canvas (cross-filter aktif). */
  selectedKey?: string | null
}>()
const emit = defineEmits<{ select: [group: AnalyticsGroup]; drill: [group: AnalyticsGroup] }>()
const formatValue = (value: number | null | undefined) => formatAnalyticsMetricValue(value, props.metric?.unit, props.metric?.unit === "IDR")

const search = ref("")
const sort = ref<"value_desc" | "value_asc" | "label_asc">("value_desc")

/** Rank and cumulative share always follow the descending value order so the numbers stay comparable. */
const ranked = computed(() => {
  let cumulative = 0
  return [...props.groups]
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
    .map((group, index) => {
      cumulative += Number(group.share || 0)
      return { group, rank: index + 1, cumulative }
    })
})
const max = computed(() => Math.max(1, ...props.groups.map((group) => Number(group.value || 0))))
const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  const filtered = term ? ranked.value.filter((row) => row.group.label.toLowerCase().includes(term)) : ranked.value
  if (sort.value === "value_asc") return [...filtered].sort((a, b) => Number(a.group.value || 0) - Number(b.group.value || 0))
  if (sort.value === "label_asc") return [...filtered].sort((a, b) => a.group.label.localeCompare(b.group.label, "id-ID"))
  return filtered
})
// Render bertahap: pencarian/urut tetap di atas semua grup, hanya DOM yang dibatasi.
const RENDER_CHUNK = 100
const visibleCount = ref(RENDER_CHUNK)
watch([search, sort, () => props.groups], () => { visibleCount.value = RENDER_CHUNK })
</script>

<template>
  <section
    class="flex h-[280px] min-h-0 flex-col gap-1.5 rounded-lg border bg-card p-2.5 lg:h-full"
    aria-labelledby="group-list-title"
  >
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-1.5">
      <h2 id="group-list-title" class="truncate text-xs font-bold uppercase tracking-wide">
        Rincian {{ dimensionLabel || "kelompok" }}
        <span class="font-normal normal-case text-muted-foreground">({{ rows.length }} dari {{ groups.length }})</span>
      </h2>
      <div class="flex items-center gap-1.5">
        <input
          v-model="search"
          type="search"
          class="h-7 w-24 rounded-md border bg-background px-2 text-xs"
          placeholder="Cari…"
          aria-label="Cari kelompok"
        >
        <select v-model="sort" class="h-7 rounded-md border bg-background px-1 text-xs" aria-label="Urutkan kelompok">
          <option value="value_desc">Terbanyak</option>
          <option value="value_asc">Tersedikit</option>
          <option value="label_asc">A–Z</option>
        </select>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-auto" data-lenis-prevent-wheel>
      <div class="flex shrink-0 items-center gap-2 border-b pb-1 text-[10px] font-semibold uppercase text-muted-foreground">
        <span class="w-5 text-right">#</span>
        <span class="min-w-0 flex-1">Kelompok</span>
        <span class="w-14 text-right">Nilai</span>
        <span class="w-12 text-right">Share</span>
        <span class="w-12 text-right">Kum.</span>
        <span v-if="drillField" class="w-4" />
      </div>

      <div v-if="rows.length" role="list" aria-label="Kelompok hasil" class="divide-y">
        <div
          v-for="row in rows.slice(0, visibleCount)"
          :key="`${row.group.key}-${row.group.breakdown?.key || ''}`"
          role="listitem"
          class="rounded-sm py-1 transition-colors"
          :class="selectedKey === row.group.key ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-300' : ''"
          :aria-selected="selectedKey === row.group.key"
        >
          <div class="flex items-center gap-2 px-0.5 text-xs">
            <span class="w-5 shrink-0 text-right text-muted-foreground">{{ row.rank }}</span>
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline"
              :aria-pressed="selectedKey === row.group.key"
              @click="emit('select', row.group)"
            >
              <span class="min-w-0 flex-1 truncate" :title="row.group.label">
                {{ row.group.label }}
                <span v-if="selectedKey === row.group.key" class="ml-1 rounded-full bg-emerald-600 px-1.5 py-px text-[9px] font-bold uppercase text-white">terfilter</span>
              </span>
              <span class="w-14 shrink-0 text-right font-semibold" :title="formatAnalyticsMetricValue(row.group.value, metric?.unit)">{{ formatValue(row.group.value) }}</span>
              <span class="w-12 shrink-0 text-right">{{ formatAnalyticsPercent(row.group.share) }}</span>
              <span class="w-12 shrink-0 text-right text-muted-foreground">{{ formatAnalyticsPercent(row.cumulative) }}</span>
            </button>
            <button
              v-if="drillField"
              type="button"
              class="w-4 shrink-0 text-center font-bold text-muted-foreground hover:text-foreground"
              aria-label="Drill down"
              :title="`Drill down ${row.group.label}`"
              @click="emit('drill', row.group)"
            >
              ›
            </button>
          </div>
          <div class="mt-0.5 h-1 rounded-full bg-muted">
            <div class="h-full rounded-full bg-emerald-600" :style="{ width: `${Math.max(2, (Number(row.group.value || 0) / max) * 100)}%` }" />
          </div>
        </div>
      </div>
      <button
        v-if="rows.length > visibleCount"
        type="button"
        class="mt-1 w-full shrink-0 rounded-md border py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
        @click="visibleCount = rows.length"
      >
        Tampilkan semua ({{ rows.length - visibleCount }} kelompok lagi)
      </button>
      <p v-if="!rows.length" class="py-8 text-center text-xs text-muted-foreground">
        {{ groups.length ? "Tidak ada kelompok yang cocok dengan pencarian." : "Belum ada data untuk filter ini." }}
      </p>
    </div>
  </section>
</template>
