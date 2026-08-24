<script setup lang="ts">
import type { AnalyticsGroup, AnalyticsMetric } from "~/types/analytics"
import { formatAnalyticsMetricValue, formatAnalyticsNumber, formatAnalyticsPercent } from "~/lib/analytics-format"

const props = defineProps<{ groups: Array<AnalyticsGroup>; metric?: AnalyticsMetric }>()
const rows = computed(() => {
  let cumulative = 0
  return props.groups.map((group, index) => {
    cumulative += Number(group.share || 0)
    return { group, rank: index + 1, cumulative }
  })
})
// Render bertahap: kumulatif dihitung untuk semua baris, tetapi DOM awal dibatasi
// agar dimensi ber-kardinalitas tinggi (±2.000 kelurahan/kode KBLI) tetap ringan.
const RENDER_CHUNK = 100
const visibleCount = ref(RENDER_CHUNK)
watch(() => props.groups, () => { visibleCount.value = RENDER_CHUNK })
</script>
<template>
  <div id="analytics-data-table" class="overflow-x-auto">
    <table class="w-full text-left text-xs">
      <caption class="sr-only">Data analitik dalam bentuk tabel</caption>
      <thead>
        <tr class="border-b">
          <th class="p-1.5 text-right">#</th>
          <th class="p-1.5">Kelompok</th>
          <th class="p-1.5 text-right">{{ metric?.label || "Jumlah UMKM" }}</th>
          <th class="p-1.5 text-right">Bagian dari total terfilter</th>
          <th class="p-1.5 text-right">Kumulatif</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows.slice(0, visibleCount)" :key="`${row.group.key}-${row.group.breakdown?.key || ''}`" class="border-b">
          <td class="p-1.5 text-right text-muted-foreground">{{ row.rank }}</td>
          <th scope="row" class="p-1.5 font-medium">{{ row.group.label }}</th>
          <td class="p-1.5 text-right">{{ formatAnalyticsMetricValue(row.group.value, metric?.unit) }}</td>
          <td class="p-1.5 text-right">{{ formatAnalyticsPercent(row.group.share) }}</td>
          <td class="p-1.5 text-right text-muted-foreground">{{ formatAnalyticsPercent(row.cumulative) }}</td>
        </tr>
      </tbody>
    </table>
    <button
      v-if="rows.length > visibleCount"
      type="button"
      class="mt-1 w-full rounded-md border py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
      @click="visibleCount = rows.length"
    >
      Tampilkan semua ({{ formatAnalyticsNumber(rows.length - visibleCount) }} kelompok lagi)
    </button>
  </div>
</template>
