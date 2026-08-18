<script setup lang="ts">
import type { ScaleStatItem } from "~/types/dashboard";

interface Props {
  items: ScaleStatItem[];
}

defineProps<Props>();
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <DashboardCardScaleStat
      v-for="item in items"
      :key="item.id"
      :title="item.title"
      :value="item.value"
      :category="item.category"
      :button-text="item.buttonText"
      :button-href="item.buttonHref"
    />
  </div>
</template>
