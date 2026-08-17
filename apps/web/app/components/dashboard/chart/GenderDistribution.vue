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

const GENDER_COLORS = ["#0ea5e9", "#f43f5e"];

const chartData = computed(() => [
  { label: "Laki-laki", value: props.data.malePercentage },
  { label: "Perempuan", value: props.data.femalePercentage },
]);
</script>

<template>
  <div class="flex h-full flex-col justify-between space-y-4">
    <!-- Chart Content -->
    <div
      class="flex flex-col items-center justify-center gap-5 py-2 sm:flex-row sm:gap-8"
    >
      <!-- Donut Chart -->
      <div class="relative h-28 w-28 shrink-0">
        <UiDonutChart
          class="h-full! w-full!"
          :data="chartData"
          category="value"
          index="label"
          :colors="GENDER_COLORS"
          :show-legend="false"
          :value-formatter="() => ''"
        />
      </div>

      <!-- Legend & Stats -->
      <div class="flex flex-col gap-4">
        <!-- Male Stat -->
        <div class="flex items-center gap-3">
          <!-- Male Icon -->
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400"
          >
            <svg
              class="h-4 w-4 stroke-current stroke-2 fill-none"
              viewBox="0 0 24 24"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
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
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
          >
            <svg
              class="h-4 w-4 stroke-current stroke-2 fill-none"
              viewBox="0 0 24 24"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
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
