<script setup lang="ts">
import { talentaStatusClass, talentaStatusLabel } from "~/constants/OPERASIONAL";

defineProps<{ status: string }>();
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
    :class="talentaStatusClass(status)"
  >
    {{ talentaStatusLabel(status) }}
  </span>
</template>
