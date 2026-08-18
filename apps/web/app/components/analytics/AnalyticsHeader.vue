<script setup lang="ts">
import type { AnalyticsMeta } from "~/types/analytics"
import { formatAnalyticsWib } from "~/lib/analytics-format"
defineProps<{ meta?: AnalyticsMeta | null }>()
</script>
<template><header class="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between"><div><p class="text-sm font-semibold text-emerald-700">Analitik UMKM</p><h1 class="text-2xl font-bold tracking-tight">Canvas analitik</h1><p class="text-sm text-muted-foreground">Jelajahi sebaran dan kualitas data current-state tanpa mengekspor data mentah.</p></div><div class="text-left text-xs text-muted-foreground sm:text-right"><span class="rounded-full border px-2 py-1">{{ meta?.status === 'stale_last_good' ? 'Data terakhir berhasil' : meta?.status === 'processing' ? 'Sedang diproses' : 'Data saat ini' }}</span><p class="mt-2">Data per {{ formatAnalyticsWib(meta?.dataAsOf) }}</p></div></header></template>
