<script setup lang="ts">
import type { AnalysisConfig, AnalyticsField, AnalyticsFilter, AnalyticsMeta, AnalyticsTemplate } from "~/types/analytics"
import { formatAnalyticsWib } from "~/lib/analytics-format"

const props = defineProps<{
  meta?: AnalyticsMeta | null
  config: AnalysisConfig
  fields: AnalyticsField[]
  templates: AnalyticsTemplate[]
  filters: AnalyticsFilter[]
  breadcrumbs: string[]
  savedCount: number
  railOpen: boolean
}>()
const emit = defineEmits<{
  template: [config: Partial<AnalysisConfig>]
  removeFilter: [fieldId: string]
  saved: []
  save: []
  export: []
  toggleRail: []
}>()

const statusLabel = computed(() =>
  props.meta?.status === "stale_last_good"
    ? "Data terakhir berhasil"
    : props.meta?.status === "processing"
      ? "Sedang diproses"
      : "Data saat ini",
)
</script>

<template>
  <header class="flex shrink-0 flex-col gap-1.5 border-b border-border pb-1.5">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div class="flex min-w-0 items-center gap-2">
        <button
          type="button"
          class="hidden size-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold lg:inline-flex"
          :aria-expanded="railOpen"
          :aria-label="railOpen ? 'Sembunyikan panel kontrol' : 'Tampilkan panel kontrol'"
          @click="emit('toggleRail')"
        >
          {{ railOpen ? "‹" : "›" }}
        </button>
        <h1 class="truncate text-base font-bold tracking-tight">Canvas analitik</h1>
        <span class="shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{{ statusLabel }}</span>
        <span class="truncate text-[11px] text-muted-foreground">Data per {{ formatAnalyticsWib(meta?.dataAsOf) }}</span>
      </div>

      <nav v-if="breadcrumbs.length" class="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground" aria-label="Jejak drill-down">
        <span class="shrink-0 font-semibold text-foreground">Jejak:</span>
        <span class="truncate">Jawa Barat › {{ breadcrumbs.join(" › ") }}</span>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <AnalyticsTemplatePicker :templates="templates" :model-value="config" @select="emit('template', $event)" />
        <button type="button" class="h-8 rounded-md border px-2.5 text-xs font-semibold" @click="emit('saved')">
          Analisis tersimpan<span v-if="savedCount" class="ml-1 rounded-full bg-muted px-1.5">{{ savedCount }}</span>
        </button>
        <button type="button" class="h-8 rounded-md border px-2.5 text-xs font-semibold" @click="emit('save')">Simpan analisis</button>
        <button type="button" class="h-8 rounded-md border px-2.5 text-xs font-semibold" @click="emit('export')">Ekspor</button>
      </div>
    </div>

    <AnalyticsFilterChips :filters="filters" :fields="fields" @remove="emit('removeFilter', $event)" />
  </header>
</template>
