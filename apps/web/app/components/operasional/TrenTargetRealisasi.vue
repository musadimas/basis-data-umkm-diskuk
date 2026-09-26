<script setup lang="ts">
import { LineChart } from "~/components/ui/chart-line";
import { formatAnalyticsMetricValue } from "~/lib/analytics-format";
import type { TrenMinggu } from "~/types/operasional";

const props = defineProps<{
  tren: TrenMinggu[];
  judul?: string;
  labelTarget?: string;
  labelRealisasi?: string;
}>();

const data = computed(() =>
  props.tren.map((t) => ({ x: t.mingguKe, target: t.target, realisasi: t.realisasi })),
);
</script>

<template>
  <section :aria-label="judul ?? 'Grafik Target KPI Mingguan vs Realisasi'">
    <h3 v-if="judul" class="text-sm font-bold">{{ judul }}</h3>
    <LineChart
      :data="data"
      :series="[
        { key: 'target', label: labelTarget ?? 'Target KPI Mingguan', color: '#64748b', dashed: true },
        { key: 'realisasi', label: labelRealisasi ?? 'Realisasi Terverifikasi', color: '#16a34a', width: 3 },
      ]"
      x-label="Minggu"
      :y-formatter="(v: number) => formatAnalyticsMetricValue(v, 'IDR', true)"
    />
  </section>
</template>
