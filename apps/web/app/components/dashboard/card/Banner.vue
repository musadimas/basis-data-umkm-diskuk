<script setup lang="ts">
import type { Component } from "vue";
import { ChartColumnDecreasing } from "@lucide/vue";

interface Props {
  title?: string;
  description?: string;
  /** "infografis" = blue banner #1E88E5, "data" = brand-blue banner (Data Tabular) */
  variant?: "infografis" | "data";
  icon?: Component;
}

const props = withDefaults(defineProps<Props>(), {
  title: "Infografis UMKM",
  description:
    "Ringkasan capaian program untuk dashboard Anda.",
  variant: "infografis",
  icon: () => ChartColumnDecreasing,
});

const bannerClass = computed(() =>
  props.variant === "data"
    ? "bg-brand-blue text-white"
    : "bg-[#1E88E5] text-white",
);
</script>

<template>
  <UiCard
    class="flex-col items-start gap-4 overflow-hidden rounded-lg border-0 p-4 shadow-sm sm:flex-row sm:items-center"
    :class="bannerClass"
    role="region"
    :aria-label="`Informasi ${title}`"
  >
    <!-- Icon Container -->
    <div
      class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-current"
      aria-hidden="true"
    >
      <component :is="icon" class="h-8 w-8 stroke-[2.2]" />
    </div>

    <!-- Text Content -->
    <UiCardContent class="flex-1 space-y-2 p-0">
      <h1 class="text-xl font-bold tracking-tight text-inherit sm:text-2xl">
        {{ title }}
      </h1>
      <UiCardDescription
        class="max-w-4xl text-xs font-normal leading-relaxed text-inherit"
      >
        {{ description }}
      </UiCardDescription>
    </UiCardContent>
  </UiCard>
</template>
