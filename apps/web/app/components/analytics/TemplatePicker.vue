<script setup lang="ts">
import type { AnalyticsTemplate, AnalysisConfig } from "~/types/analytics";
const props = defineProps<{
  templates: AnalyticsTemplate[];
  modelValue: AnalysisConfig;
}>();
const emit = defineEmits<{ select: [config: Partial<AnalysisConfig>] }>();
function select(event: Event) {
  // SAFETY: handler ini terpasang pada elemen <select>, sehingga event.target pasti HTMLSelectElement.
  const value = (event.target as HTMLSelectElement).value;
  const template = props.templates.find((item) => item.id === value);
  if (template) emit("select", template.config);
}
const current = computed(
  () =>
    props.templates.find(
      (item) => item.config.groupBy === props.modelValue.groupBy,
    )?.id || "",
);
</script>
<template>
  <select
    class="h-8 max-w-[11rem] rounded-md border bg-background px-2 text-xs"
    aria-label="Templat analisis"
    :value="current"
    @change="select"
  >
    <option value="">Templat analisis</option>
    <option
      v-for="template in templates"
      :key="template.id"
      :value="template.id"
    >
      {{ template.label }}
    </option>
  </select>
</template>
