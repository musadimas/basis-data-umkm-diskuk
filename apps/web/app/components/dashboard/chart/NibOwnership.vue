<script setup lang="ts">
import type { InfografisNibData } from "~/types/infografis";
import { formatAnalyticsPercent } from "~/lib/analytics-format";

interface Props {
  data?: InfografisNibData;
  buttonText?: string;
  buttonHref?: string;
}

const props = withDefaults(defineProps<Props>(), {
  buttonText: "Lihat Data",
});

const chartData = computed(() => {
  if (!props.data) return [];

  return [
    { label: "Memiliki NIB", value: props.data.withPercentage },
    { label: "Belum Memiliki NIB", value: props.data.withoutPercentage },
  ];
});

const hasData = computed(() => Boolean(props.data && props.data.total > 0));
</script>

<template>
  <div class="flex h-full flex-col justify-between space-y-4">
    <div
      v-if="hasData"
      class="flex flex-col items-center justify-center gap-5 py-2 sm:flex-row sm:gap-8"
    >
      <div class="relative h-44 w-44 shrink-0">
        <UiDonutChart
          class="h-full! w-full!"
          :data="chartData"
          category="value"
          index="label"
          :colors="['#4fa765', '#ffd447']"
          :show-legend="false"
          :value-formatter="() => ''"
        />
      </div>

      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
            aria-hidden="true"
          >
            <svg
              class="h-4 w-4 fill-none stroke-current stroke-2"
              viewBox="0 0 24 24"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m5 12 4 4L19 6" />
            </svg>
          </div>
          <div>
            <div class="text-2xl font-bold tracking-tight text-foreground">
              {{ formatAnalyticsPercent(data?.withPercentage) }}
            </div>
            <div class="text-xs font-medium text-muted-foreground">
              Memiliki NIB
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/50 dark:text-amber-400"
            aria-hidden="true"
          >
            <svg
              class="h-4 w-4 fill-none stroke-current stroke-2"
              viewBox="0 0 24 24"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m7 7 10 10M17 7 7 17" />
            </svg>
          </div>
          <div>
            <div class="text-2xl font-bold tracking-tight text-foreground">
              {{ formatAnalyticsPercent(data?.withoutPercentage) }}
            </div>
            <div class="text-xs font-medium text-muted-foreground">
              Belum Memiliki NIB
            </div>
          </div>
        </div>
      </div>
    </div>

    <p v-else class="py-6 text-sm text-muted-foreground">
      Data kepemilikan NIB belum tersedia.
    </p>

    <div v-if="hasData" class="flex justify-center pt-2">
      <NuxtLink
        v-if="buttonHref"
        :to="buttonHref"
        class="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        {{ buttonText }}
      </NuxtLink>
    </div>
  </div>
</template>
