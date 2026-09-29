<script setup lang="ts">
import type { AnalyticsProfile } from "~/types/analytics"
import { formatAnalyticsWib } from "~/lib/analytics-format"
defineProps<{ profile: AnalyticsProfile }>()
</script>
<template><header class="rounded-lg border bg-card p-5"><div class="flex flex-col gap-4 sm:flex-row sm:items-center"><div class="flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-100 text-2xl font-bold text-emerald-800" aria-hidden="true">{{ profile.data.title.slice(0,1).toUpperCase() }}</div><div><h1 class="text-2xl font-bold">{{ profile.data.title }}</h1><p class="text-sm text-muted-foreground">{{ profile.data.hero.location }}</p><div class="mt-2 flex flex-wrap gap-2"><span v-for="badge in profile.data.badges" :key="badge" class="rounded-full border px-2 py-1 text-xs">{{ badge }}</span></div></div></div><p class="mt-4 text-xs text-muted-foreground">Data per {{ formatAnalyticsWib(profile.meta.dataAsOf) }} · penyamaran data v{{ profile.data.maskingVersion }}</p></header></template>

