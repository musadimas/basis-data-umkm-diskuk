<script setup lang="ts">
import type { AnalyticsField, AnalysisConfig, AnalyticsFilter, AnalyticsVisual } from "~/types/analytics"
const props = defineProps<{ fields: AnalyticsField[]; modelValue: AnalysisConfig }>()
const emit = defineEmits<{ apply: []; reset: []; update: [patch: Partial<AnalysisConfig>]; visual: [visual: AnalyticsVisual] }>()
const dimensions = computed(() => props.fields.filter((field) => field.status === "active" && field.role === "dimension"))
const filterFields = computed(() => props.fields.filter((field) => field.status === "active" && (field.role === "filter" || field.role === "dimension")))
const metrics = computed(() => props.fields.filter((field) => field.status === "active" && field.role === "metric"))
const visuals: AnalyticsVisual[] = ["bar", "stacked", "donut", "histogram", "choropleth", "table"]
const filterField = ref("")
const filterValue = ref("")
const filterOperator = ref<AnalyticsFilter["operator"]>("eq")
const selectedField = computed(() => filterFields.value.find((field) => field.key === filterField.value))
function patch(event: Event, key: keyof AnalysisConfig) { emit("update", { [key]: (event.target as HTMLSelectElement).value } as Partial<AnalysisConfig>) }
function addFilter() {
  const value = filterValue.value.trim()
  if (!filterField.value || !value) return
  const filter: AnalyticsFilter = { fieldId: filterField.value, operator: filterOperator.value, value }
  emit("update", { filters: [...props.modelValue.filters.filter((item) => item.fieldId !== filter.fieldId), filter] })
  filterValue.value = ""
}
function removeFilter(fieldId: string) { emit("update", { filters: props.modelValue.filters.filter((item) => item.fieldId !== fieldId) }) }
function fieldLabel(fieldId: string) { return props.fields.find((field) => field.key === fieldId || field.id === fieldId)?.label || fieldId }
</script>
<template>
  <section aria-labelledby="query-builder-title" class="rounded-lg border bg-card p-4 shadow-xs">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="query-builder-title" class="font-bold">Atur analisis</h2><span class="text-xs text-muted-foreground">Perubahan diterapkan setelah tombol ditekan</span></div>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label class="flex flex-col gap-1 text-sm font-medium">Metrik<select aria-label="Metrik" class="h-10 rounded-md border bg-background px-3" :value="modelValue.metric" @change="patch($event,'metric')"><option value="jumlah_umkm">Jumlah UMKM</option><option v-for="field in metrics" :key="field.key" :value="field.key">{{ field.label }}</option></select></label>
      <label class="flex flex-col gap-1 text-sm font-medium">Kelompokkan menurut<select aria-label="Kelompokkan menurut" class="h-10 rounded-md border bg-background px-3" :value="modelValue.groupBy" @change="patch($event,'groupBy')"><option v-for="field in dimensions" :key="field.key" :value="field.key">{{ field.label }}</option></select></label>
      <label class="flex flex-col gap-1 text-sm font-medium">Breakdown opsional<select aria-label="Breakdown opsional" class="h-10 rounded-md border bg-background px-3" :value="modelValue.breakdown || ''" @change="patch($event,'breakdown')"><option value="">Tidak ada</option><option v-for="field in dimensions" :key="field.key" :value="field.key" :disabled="field.key === modelValue.groupBy">{{ field.label }}</option></select></label>
      <label class="flex flex-col gap-1 text-sm font-medium">Tampilan<select aria-label="Tampilan" class="h-10 rounded-md border bg-background px-3" :value="modelValue.visual" @change="patch($event,'visual')"><option v-for="visual in visuals" :key="visual" :value="visual">{{ visual === 'bar' ? 'Batang' : visual === 'stacked' ? 'Batang bertumpuk' : visual === 'donut' ? 'Donat' : visual === 'histogram' ? 'Histogram' : visual === 'choropleth' ? 'Peta (jika geometri siap)' : 'Tabel' }}</option></select></label>
      <div class="flex items-end gap-2 sm:col-span-2"><button type="button" class="h-10 rounded-md border px-3 text-sm font-semibold" @click="emit('reset')">Reset</button><UiButton type="button" class="h-10 sm:w-auto" @click="emit('apply')">Terapkan</UiButton></div>
    </div>
    <fieldset class="mt-4 rounded-md border p-3"><legend class="px-1 text-sm font-semibold">Tambah filter</legend><div class="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]"><label class="sr-only" for="analytics-filter-field">Field filter</label><select id="analytics-filter-field" v-model="filterField" class="h-10 rounded-md border bg-background px-3" aria-label="Field filter"><option value="">Pilih field</option><option v-for="field in filterFields" :key="field.key" :value="field.key">{{ field.label }}</option></select><select v-model="filterOperator" class="h-10 rounded-md border bg-background px-3" aria-label="Operator filter"><option value="eq">sama dengan</option><option value="neq">tidak sama</option><option value="contains">mengandung</option><option value="starts_with">diawali</option></select><input v-model="filterValue" class="h-10 rounded-md border bg-background px-3" :placeholder="selectedField?.label || 'Nilai filter'" aria-label="Nilai filter" @keyup.enter="addFilter"><button type="button" class="h-10 rounded-md border px-3 text-sm font-semibold" :disabled="!filterField || !filterValue.trim()" @click="addFilter">Tambah</button></div><div v-if="modelValue.filters.length" class="mt-2 flex flex-wrap gap-2"><span v-for="filter in modelValue.filters" :key="filter.fieldId" class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">{{ fieldLabel(filter.fieldId) }}: {{ Array.isArray(filter.value) ? filter.value.join(', ') : filter.value }}<button type="button" :aria-label="`Hapus filter ${filter.fieldId}`" @click="removeFilter(filter.fieldId)">×</button></span></div></fieldset>
  </section>
</template>
