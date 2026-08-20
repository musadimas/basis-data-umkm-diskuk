<script setup lang="ts">
import type { AnalyticsField, AnalyticsFilter } from "~/types/analytics"
const props = defineProps<{ filters: Array<AnalyticsFilter>; fields: Array<AnalyticsField> }>()
const emit = defineEmits<{ (event: "remove", fieldId: string): void }>()
const label = (id: string) => props.fields.find((field) => field.key === id || field.id === id)?.label || "Filter"
const operator = (value: AnalyticsFilter["operator"]) =>
  value === "neq" ? "≠" : value === "contains" ? "berisi" : value === "starts_with" ? "diawali" : value === "in" ? "salah satu" : "="
</script>
<template>
  <div v-if="filters.length" class="flex min-w-0 flex-wrap items-center gap-1" aria-label="Filter aktif">
    <span
      v-for="filter in filters"
      :key="filter.fieldId"
      class="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px]"
    >
      <span class="truncate">{{ label(filter.fieldId) }} {{ operator(filter.operator) }} {{ Array.isArray(filter.value) ? filter.value.join(", ") : filter.value }}</span>
      <button
        type="button"
        class="rounded-full px-1 font-bold"
        :aria-label="`Hapus filter ${label(filter.fieldId)}`"
        @click="emit('remove', filter.fieldId)"
      >×</button>
    </span>
  </div>
</template>
