<script setup lang="ts">
import type { AnalyticsTemplate, AnalysisConfig } from "~/types/analytics";
import type { AcceptableValue } from "reka-ui";
const props = defineProps<{
  templates: AnalyticsTemplate[];
  modelValue: AnalysisConfig;
}>();
const emit = defineEmits<{ select: [config: Partial<AnalysisConfig>] }>();
function pilih(value: AcceptableValue) {
  const template = props.templates.find((item) => item.id === String(value));
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
  <UiSelect
    :model-value="current"
    aria-label="Templat analisis"
    @update:model-value="pilih"
  >
    <UiSelectTrigger class="h-8 max-w-[11rem] text-xs"><UiSelectValue placeholder="Templat analisis" /></UiSelectTrigger>
    <UiSelectContent>
      <UiSelectItem
        v-for="template in templates"
        :key="template.id"
        :value="template.id"
      >
        {{ template.label }}
      </UiSelectItem>
    </UiSelectContent>
  </UiSelect>
</template>
