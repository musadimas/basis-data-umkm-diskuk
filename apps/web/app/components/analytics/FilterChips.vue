<script setup lang="ts">
import type { AnalyticsField, AnalyticsFilter } from "~/types/analytics"
const props=defineProps<{ filters: Array<AnalyticsFilter>; fields: Array<AnalyticsField> }>()
const emit=defineEmits<{ (event: "remove", fieldId: string): void }>()
const label=(id:string)=>props.fields.find((field)=>field.key===id||field.id===id)?.label||"Filter"
</script>
<template><div v-if="filters.length" class="flex flex-wrap gap-2" aria-label="Filter aktif"><span v-for="filter in filters" :key="filter.fieldId" class="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-3 py-1 text-xs"><span>{{ label(filter.fieldId) }}: {{ Array.isArray(filter.value) ? filter.value.join(', ') : filter.value }}</span><button type="button" class="rounded-full px-1 font-bold" :aria-label="`Hapus filter ${label(filter.fieldId)}`" @click="emit('remove',filter.fieldId)">×</button></span></div></template>
