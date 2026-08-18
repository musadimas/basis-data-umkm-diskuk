<script setup lang="ts">
import type { ClusterItem } from "~/types/dashboard"
import { formatAnalyticsNumber, formatAnalyticsPercent } from "~/lib/analytics-format"
defineProps<{ items: Array<ClusterItem> }>()
</script>
<template><div class="w-full overflow-x-auto"><table class="w-full text-left text-sm"><caption class="caption-top pb-2 text-left text-xs text-muted-foreground">Persentase adalah bagian dari total UMKM yang sedang difilter.</caption><thead><tr class="border-b text-xs font-bold"><th class="p-2">Kategori</th><th class="p-2">Bagian dari total terfilter</th></tr></thead><tbody><tr v-for="item in items" :key="item.id" class="border-b"><th scope="row" class="p-2">{{ item.name }}</th><td class="p-2"><div class="flex items-center gap-3"><div class="h-3 flex-1 rounded-full bg-muted"><div class="h-full rounded-full bg-emerald-600" :style="{width:`${Math.max(1,Math.min(100,item.percentage||0))}%`}" /></div><span class="w-28 text-right text-xs font-semibold">{{ formatAnalyticsPercent(item.percentage) }} · {{ formatAnalyticsNumber(item.value) }}</span></div></td></tr></tbody></table></div></template>
