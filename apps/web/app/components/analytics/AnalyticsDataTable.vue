<script setup lang="ts">
import type { AnalyticsGroup } from "~/types/analytics"
import { formatAnalyticsNumber, formatAnalyticsPercent } from "~/lib/analytics-format"

const props = defineProps<{ groups: Array<AnalyticsGroup> }>()
const rows = computed(() => {
  let cumulative = 0
  return props.groups.map((group, index) => {
    cumulative += Number(group.share || 0)
    return { group, rank: index + 1, cumulative }
  })
})
</script>
<template>
  <div id="analytics-data-table" class="overflow-x-auto">
    <table class="w-full text-left text-xs">
      <caption class="sr-only">Data analitik dalam bentuk tabel</caption>
      <thead>
        <tr class="border-b">
          <th class="p-1.5 text-right">#</th>
          <th class="p-1.5">Kelompok</th>
          <th class="p-1.5 text-right">Jumlah</th>
          <th class="p-1.5 text-right">Bagian dari total terfilter</th>
          <th class="p-1.5 text-right">Kumulatif</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="`${row.group.key}-${row.group.breakdown?.key || ''}`" class="border-b">
          <td class="p-1.5 text-right text-muted-foreground">{{ row.rank }}</td>
          <th scope="row" class="p-1.5 font-medium">{{ row.group.label }}</th>
          <td class="p-1.5 text-right">{{ formatAnalyticsNumber(row.group.value) }}</td>
          <td class="p-1.5 text-right">{{ formatAnalyticsPercent(row.group.share) }}</td>
          <td class="p-1.5 text-right text-muted-foreground">{{ formatAnalyticsPercent(row.cumulative) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
