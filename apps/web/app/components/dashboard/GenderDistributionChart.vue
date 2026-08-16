<script setup lang="ts">
import type { GenderDistributionData } from "~/types/dashboard";

interface Props {
  data?: GenderDistributionData;
  buttonText?: string;
  buttonHref?: string;
}

const props = withDefaults(defineProps<Props>(), {
  buttonText: "Lihat Data",
  data: () => ({
    malePercentage: 50,
    femalePercentage: 50,
    maleCount: 4999999,
    femaleCount: 4999999,
    totalWorkers: 9999998,
  }),
});

const emit = defineEmits<{
  (e: "click:action"): void;
}>();

const circumference = 2 * Math.PI * 38;
const maleArc = computed(() => `${(circumference * props.data.malePercentage) / 100} ${circumference}`);
const femaleArc = computed(() => `${(circumference * props.data.femalePercentage) / 100} ${circumference}`);
const femaleOffset = computed(() => `-${(circumference * props.data.malePercentage) / 100}`);
</script>

<template>
  <div class="flex h-full flex-col justify-between space-y-4">
    <!-- Chart Content -->
    <div class="flex flex-col items-center justify-center gap-5 py-2 sm:flex-row sm:gap-8">
      <!-- Donut SVG -->
      <div class="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 100 100" class="h-full w-full -rotate-90">
          <!-- Background track -->
          <circle
            cx="50"
            cy="50"
            r="38"
            class="stroke-slate-100 dark:stroke-slate-800"
            stroke-width="14"
            fill="none"
          />
          <!-- Male Arc (Blue) - 50% = 119.38 stroke-dasharray (circumference ~ 238.76) -->
          <circle
            cx="50"
            cy="50"
            r="38"
            class="stroke-sky-500 transition-all duration-700 hover:stroke-sky-400 cursor-pointer"
            stroke-width="14"
            :stroke-dasharray="maleArc"
            stroke-dashoffset="0"
            fill="none"
          />
          <!-- Female Arc (Pink) - 50% offset -->
          <circle
            cx="50"
            cy="50"
            r="38"
            class="stroke-rose-500 transition-all duration-700 hover:stroke-rose-400 cursor-pointer"
            stroke-width="14"
            :stroke-dasharray="femaleArc"
            :stroke-dashoffset="femaleOffset"
            fill="none"
          />
        </svg>

        <!-- Center subtle circle -->
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div class="h-12 w-12 rounded-full bg-white shadow-2xs dark:bg-card" />
        </div>
      </div>

      <!-- Legend & Stats -->
      <div class="flex flex-col gap-4">
        <!-- Male Stat -->
        <div class="flex items-center gap-3">
          <!-- Male Icon -->
          <div class="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
            <svg class="h-4 w-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="10" cy="14" r="5" />
              <path d="M19 5l-5.4 5.4" />
              <path d="M15 5h4v4" />
            </svg>
          </div>
          <div>
            <div class="text-xl font-bold tracking-tight text-foreground">
              {{ data.malePercentage }}%
            </div>
            <div class="text-xs text-muted-foreground font-medium">
              Laki-laki
            </div>
          </div>
        </div>

        <!-- Female Stat -->
        <div class="flex items-center gap-3">
          <!-- Female Icon -->
          <div class="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
            <svg class="h-4 w-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="9" r="5" />
              <path d="M12 14v7" />
              <path d="M9 18h6" />
            </svg>
          </div>
          <div>
            <div class="text-xl font-bold tracking-tight text-foreground">
              {{ data.femalePercentage }}%
            </div>
            <div class="text-xs text-muted-foreground font-medium">
              Perempuan
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Centered Action Button -->
    <div class="flex justify-center pt-2">
      <NuxtLink
        v-if="buttonHref"
        :to="buttonHref"
        class="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <span>{{ buttonText }}</span>
      </NuxtLink>
      <button
        v-else
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        @click="emit('click:action')"
      >
        <span>{{ buttonText }}</span>
      </button>
    </div>
  </div>
</template>
