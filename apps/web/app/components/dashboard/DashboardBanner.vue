<script setup lang="ts">
import type { Component } from "vue";
import { ChartColumnDecreasing } from "@lucide/vue";

interface Props {
  title?: string;
  description?: string;
  /** "infografis" = green banner, "data" = blue banner (Data Tabular) */
  variant?: "infografis" | "data";
  icon?: Component;
}

const props = withDefaults(defineProps<Props>(), {
  title: "Infografis UMKM",
  description:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent dictum tortor eu dictum pulvinar. Fusce pulvinar enim ac dui luctus, ac tempus nisl vestibulum. Sed sit amet ante sit amet sapien dictum ultrices quis at augue. Nulla pharetra ex dictum, venenatis nunc a, tempor lectus.",
  variant: "infografis",
  icon: () => ChartColumnDecreasing,
});

const bannerClass = computed(() =>
  props.variant === "data" ? "bg-[#1e88e5]" : "bg-emerald-500"
);
</script>

<template>
  <div
    class="relative overflow-hidden rounded-lg p-4 text-white shadow-sm"
    :class="bannerClass"
    role="region"
    :aria-label="`Informasi ${title}`"
  >
    <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <!-- Icon Container -->
      <div
        class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-white/90 text-white"
        aria-hidden="true"
      >
        <component :is="icon" class="h-8 w-8 stroke-[2.2]" />
      </div>

      <!-- Text Content -->
      <div class="flex-1 space-y-2">
        <h1 class="text-xl font-bold tracking-tight text-white sm:text-2xl">
          {{ title }}
        </h1>
        <p class="max-w-4xl text-xs font-normal leading-relaxed text-white/95">
          {{ description }}
        </p>
      </div>
    </div>
  </div>
</template>
