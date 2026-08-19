<script setup lang="ts">
import type { InfografisMarketingMethod } from "~/types/infografis";
import { formatAnalyticsNumber } from "~/lib/analytics-format";

interface Props {
  items?: InfografisMarketingMethod[];
  buttonText?: string;
  buttonHref?: string;
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  buttonText: "Lihat Data",
});

const maxValue = computed(() => Math.max(0, ...props.items.map((item) => item.value)));

const axisMax = computed(() => {
  if (!maxValue.value) return 0;

  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(maxValue.value)));
  return Math.ceil(maxValue.value / magnitude) * magnitude;
});

const axisTicks = computed(() => {
  if (!axisMax.value) return [];

  return [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    value: axisMax.value * ratio,
    position: ratio * 100,
  }));
});

function barHeight(value: number) {
  if (!axisMax.value || value <= 0) return 0;
  return Math.max(2, (value / axisMax.value) * 100);
}
</script>

<template>
  <div class="flex h-full flex-col justify-between space-y-4">
    <div v-if="items.length" class="space-y-3">
      <div
        class="relative h-52 pl-16"
        role="img"
        aria-label="Grafik jumlah UMKM berdasarkan metode pemasaran"
      >
        <div class="absolute inset-x-0 bottom-8 top-0">
          <div
            v-for="tick in axisTicks"
            :key="tick.position"
            class="absolute inset-x-0 border-t border-dashed border-border/70"
            :style="{ top: `${100 - tick.position}%` }"
          >
            <span
              class="absolute -left-14 -translate-y-1/2 text-[10px] text-muted-foreground"
            >
              {{ formatAnalyticsNumber(tick.value) }}
            </span>
          </div>
        </div>

        <div
          class="absolute inset-x-0 bottom-8 top-0 flex items-end justify-around gap-4 border-b border-border"
        >
          <div
            v-for="item in items"
            :key="item.key"
            class="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
          >
            <div class="flex h-full items-end">
              <div
                class="w-7 rounded-t-md bg-emerald-600 transition-[height] dark:bg-emerald-500"
                :style="{ height: `${barHeight(item.value)}%` }"
                :aria-label="`${item.label}: ${formatAnalyticsNumber(item.value)}`"
                role="img"
                :title="`${item.label}: ${formatAnalyticsNumber(item.value)}`"
              />
            </div>
            <span
              class="max-w-24 truncate text-center text-[10px] text-foreground"
              :title="item.label"
            >
              {{ item.label }}
            </span>
          </div>
        </div>
      </div>

      <table class="sr-only">
        <caption>
          Jumlah UMKM berdasarkan metode pemasaran
        </caption>
        <thead>
          <tr>
            <th>Metode pemasaran</th>
            <th>Jumlah UMKM</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="`table-${item.key}`">
            <th scope="row">{{ item.label }}</th>
            <td>{{ formatAnalyticsNumber(item.value) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="py-6 text-sm text-muted-foreground">
      Data metode pemasaran belum tersedia.
    </p>

    <div v-if="items.length" class="flex justify-center pt-2">
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
