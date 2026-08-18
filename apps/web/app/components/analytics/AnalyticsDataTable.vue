<script setup lang="ts">
import type { AnalyticsGroup } from "~/types/analytics"
import { formatAnalyticsNumber, formatAnalyticsPercent } from "~/lib/analytics-format"
defineProps<{ groups: Array<AnalyticsGroup> }>()
</script>
<template><div id="analytics-data-table" class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm"><caption class="sr-only">Data analitik dalam bentuk tabel</caption><thead><tr class="border-b"><th class="p-2">Kelompok</th><th class="p-2 text-right">Jumlah</th><th class="p-2 text-right">Bagian dari total terfilter</th></tr></thead><tbody><tr v-for="group in groups" :key="group.key" class="border-b"><th scope="row" class="p-2 font-medium">{{ group.label }}</th><td class="p-2 text-right">{{ formatAnalyticsNumber(group.value) }}</td><td class="p-2 text-right">{{ formatAnalyticsPercent(group.share) }}</td></tr></tbody></table></div></template>
