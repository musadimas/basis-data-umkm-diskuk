<script setup lang="ts">
import type { AnalyticsField, AnalysisConfig, AnalyticsFilter, AnalyticsVisual } from "~/types/analytics"

const props = defineProps<{ fields: AnalyticsField[]; modelValue: AnalysisConfig; dirty?: boolean }>()
const emit = defineEmits<{
  apply: []
  reset: []
  update: [patch: Partial<AnalysisConfig>]
}>()

const dimensions = computed(() => props.fields.filter((field) => field.status === "active" && field.role === "dimension"))
const filterFields = computed(() => props.fields.filter((field) => field.status === "active" && (field.role === "filter" || field.role === "dimension")))
const metrics = computed(() => props.fields.filter((field) => field.status === "active" && field.role === "metric"))
const visuals: Array<{ value: AnalyticsVisual; label: string }> = [
  { value: "bar", label: "Batang" },
  { value: "stacked", label: "Batang bertumpuk" },
  { value: "donut", label: "Donat" },
  { value: "histogram", label: "Histogram" },
  { value: "choropleth", label: "Peta (jika geometri siap)" },
  { value: "table", label: "Tabel" },
]
const filterField = ref("")
const filterValue = ref("")
const filterOperator = ref<AnalyticsFilter["operator"]>("eq")
const selectedField = computed(() => filterFields.value.find((field) => field.key === filterField.value))

function patch(event: Event, key: keyof AnalysisConfig) {
  emit("update", { [key]: (event.target as HTMLSelectElement).value } as Partial<AnalysisConfig>)
}
function addFilter() {
  const value = filterValue.value.trim()
  if (!filterField.value || !value) return
  const filter: AnalyticsFilter = { fieldId: filterField.value, operator: filterOperator.value, value }
  emit("update", { filters: [...props.modelValue.filters.filter((item) => item.fieldId !== filter.fieldId), filter] })
  filterValue.value = ""
}
</script>

<template>
  <section aria-labelledby="query-builder-title" class="flex min-h-0 flex-col rounded-lg border bg-card lg:h-full">
    <div class="flex shrink-0 items-center justify-between gap-2 border-b px-2.5 py-1.5">
      <h2 id="query-builder-title" class="text-xs font-bold uppercase tracking-wide">Atur analisis</h2>
      <span v-if="dirty" class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">Draf</span>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5" data-lenis-prevent-wheel>
      <label class="flex flex-col gap-0.5 text-[11px] font-semibold text-muted-foreground">
        Metrik
        <select
          aria-label="Metrik"
          class="h-8 w-full rounded-md border bg-background px-2 text-sm font-normal text-foreground"
          :value="modelValue.metric"
          @change="patch($event, 'metric')"
        >
          <option value="jumlah_umkm">Jumlah UMKM</option>
          <option v-for="field in metrics" :key="field.key" :value="field.key">{{ field.label }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-0.5 text-[11px] font-semibold text-muted-foreground">
        Kelompokkan menurut
        <select
          aria-label="Kelompokkan menurut"
          class="h-8 w-full rounded-md border bg-background px-2 text-sm font-normal text-foreground"
          :value="modelValue.groupBy"
          @change="patch($event, 'groupBy')"
        >
          <option v-for="field in dimensions" :key="field.key" :value="field.key">{{ field.label }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-0.5 text-[11px] font-semibold text-muted-foreground">
        Breakdown opsional
        <select
          aria-label="Breakdown opsional"
          class="h-8 w-full rounded-md border bg-background px-2 text-sm font-normal text-foreground"
          :value="modelValue.breakdown || ''"
          @change="patch($event, 'breakdown')"
        >
          <option value="">Tidak ada</option>
          <option v-for="field in dimensions" :key="field.key" :value="field.key" :disabled="field.key === modelValue.groupBy">{{ field.label }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-0.5 text-[11px] font-semibold text-muted-foreground">
        Tampilan
        <select
          aria-label="Tampilan"
          class="h-8 w-full rounded-md border bg-background px-2 text-sm font-normal text-foreground"
          :value="modelValue.visual"
          @change="patch($event, 'visual')"
        >
          <option v-for="visual in visuals" :key="visual.value" :value="visual.value">{{ visual.label }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-0.5 text-[11px] font-semibold text-muted-foreground">
        Urutan record
        <select
          aria-label="Urutan record"
          class="h-8 w-full rounded-md border bg-background px-2 text-sm font-normal text-foreground"
          :value="modelValue.sort || 'nama'"
          @change="patch($event, 'sort')"
        >
          <option value="nama">Nama usaha</option>
          <option value="id">Identitas record</option>
        </select>
      </label>

      <label class="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <input
          type="checkbox"
          class="size-3.5 rounded border"
          :checked="modelValue.includeOthers !== false"
          @change="emit('update', { includeOthers: ($event.target as HTMLInputElement).checked })"
        >
        Gabungkan sisanya sebagai “Lainnya”
      </label>

      <fieldset class="rounded-md border p-2">
        <legend class="px-1 text-[11px] font-semibold">Tambah filter</legend>
        <div class="flex flex-col gap-1.5">
          <select
            id="analytics-filter-field"
            v-model="filterField"
            class="h-8 min-w-0 rounded-md border bg-background px-2 text-sm"
            aria-label="Field filter"
          >
            <option value="">Pilih field</option>
            <option v-for="field in filterFields" :key="field.key" :value="field.key">{{ field.label }}</option>
          </select>
          <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-1.5">
            <select v-model="filterOperator" class="h-8 rounded-md border bg-background px-1 text-xs" aria-label="Operator filter">
              <option value="eq">sama dengan</option>
              <option value="neq">tidak sama</option>
              <option value="contains">mengandung</option>
              <option value="starts_with">diawali</option>
            </select>
            <input
              v-model="filterValue"
              class="h-8 min-w-0 rounded-md border bg-background px-2 text-sm"
              :placeholder="selectedField?.label || 'Nilai filter'"
              aria-label="Nilai filter"
              @keyup.enter="addFilter"
            >
          </div>
          <button
            type="button"
            class="h-8 rounded-md border px-3 text-xs font-semibold disabled:opacity-50"
            :disabled="!filterField || !filterValue.trim()"
            @click="addFilter"
          >
            Tambah
          </button>
        </div>
      </fieldset>
    </div>

    <div class="flex shrink-0 items-center gap-2 border-t px-2.5 py-2">
      <button type="button" class="h-8 flex-1 rounded-md border text-xs font-semibold" @click="emit('reset')">Reset</button>
      <UiButton type="button" size="sm" class="flex-1 text-xs" @click="emit('apply')">Terapkan</UiButton>
    </div>
  </section>
</template>
