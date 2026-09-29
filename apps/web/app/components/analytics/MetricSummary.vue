<script setup lang="ts">
import type { AnalyticsMeta, AnalyticsQueryResponse } from "~/types/analytics";
import {
  formatAnalyticsMetricValue,
  formatAnalyticsNumber,
  formatAnalyticsPercent,
} from "~/lib/analytics-format";

const props = defineProps<{
  response?: AnalyticsQueryResponse | null;
  meta?: AnalyticsMeta | null;
}>();

const groups = computed(() => props.response?.data?.groups || []);
const metric = computed(() => props.response?.data?.metric);
const financial = computed(() => metric.value?.unit === "IDR");
const metricTotal = computed(() =>
  Number(
    props.response?.data?.total ??
      groups.value.reduce((sum, group) => sum + Number(group.value || 0), 0),
  ),
);
const total = computed(() =>
  Number(props.meta?.coverage?.total || props.meta?.matched || 0),
);
const coverage = computed(() =>
  total.value
    ? (Number(props.meta?.coverage?.matched ?? props.meta?.matched ?? 0) *
        100) /
      total.value
    : 0,
);
const unknown = computed(() => Number(props.meta?.coverage?.unknown || 0));
const unknownShare = computed(() =>
  total.value ? (unknown.value * 100) / total.value : 0,
);
const missing = computed(() => Number(props.meta?.coverage?.missing || 0));
const needsVerification = computed(() =>
  Number(props.meta?.coverage?.needsVerification || 0),
);
const topShare = computed(() =>
  groups.value
    .slice(0, 5)
    .reduce((sum, group) => sum + Number(group.share || 0), 0),
);
const leader = computed(() => groups.value[0]);
const populationShare = computed(() => {
  const population = Number(props.meta?.population || 0);
  return population ? (Number(props.meta?.matched || 0) * 100) / population : 0;
});
const formatMetric = (value: number | null | undefined, compact = false) =>
  formatAnalyticsMetricValue(value, metric.value?.unit, compact);
</script>

<template>
  <section
    class="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6"
    aria-label="Ringkasan metrik"
  >
    <article class="rounded-md border bg-card px-2.5 py-1.5">
      <p
        class="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {{ response?.data?.metric?.label || "Jumlah UMKM" }}
      </p>
      <p
        class="truncate text-lg font-bold leading-6"
        :title="formatMetric(metricTotal)"
      >
        {{ formatMetric(metricTotal, financial) }}
      </p>
      <p class="truncate text-[10px] text-muted-foreground">
        {{
          financial
            ? `${formatAnalyticsNumber(meta?.matched)} baris dilaporkan`
            : `${formatAnalyticsPercent(populationShare)} dari ${formatAnalyticsNumber(meta?.population)} populasi`
        }}
      </p>
    </article>
    <article class="rounded-md border bg-card px-2.5 py-1.5">
      <p
        class="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {{ financial ? "Cakupan nilai" : "Cakupan hasil" }}
      </p>
      <p class="text-lg font-bold leading-6">
        {{ formatAnalyticsPercent(coverage) }}
      </p>
      <p class="truncate text-[10px] text-muted-foreground">
        {{ formatAnalyticsNumber(meta?.matched) }} dari
        {{ formatAnalyticsNumber(total) }} record
      </p>
    </article>
    <article class="rounded-md border bg-card px-2.5 py-1.5">
      <p
        class="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {{ financial ? "Belum tersedia" : "Tidak diketahui" }}
      </p>
      <p class="text-lg font-bold leading-6">
        {{ formatAnalyticsNumber(financial ? missing : unknown) }}
      </p>
      <p class="truncate text-[10px] text-muted-foreground">
        {{
          financial
            ? "NULL, tidak dianggap nol"
            : `${formatAnalyticsPercent(unknownShare)} tetap dihitung`
        }}
      </p>
    </article>
    <article class="rounded-md border bg-card px-2.5 py-1.5">
      <p
        class="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {{ financial ? "Perlu verifikasi" : "Kelompok" }}
      </p>
      <p class="text-lg font-bold leading-6">
        {{
          formatAnalyticsNumber(financial ? needsVerification : groups.length)
        }}
      </p>
      <p class="truncate text-[10px] text-muted-foreground">
        {{ financial ? "dikeluarkan dari agregat" : "pada kelompok aktif" }}
      </p>
    </article>
    <article class="rounded-md border bg-card px-2.5 py-1.5">
      <p
        class="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {{ financial ? "Kelompok" : "Konsentrasi 5 teratas" }}
      </p>
      <p class="text-lg font-bold leading-6">
        {{
          financial
            ? formatAnalyticsNumber(groups.length)
            : formatAnalyticsPercent(topShare)
        }}
      </p>
      <p class="truncate text-[10px] text-muted-foreground">
        {{ financial ? "dengan nilai dilaporkan" : "porsi gabungan" }}
      </p>
    </article>
    <article class="rounded-md border bg-card px-2.5 py-1.5">
      <p
        class="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Kelompok teratas
      </p>
      <p class="truncate text-sm font-bold leading-6" :title="leader?.label">
        {{ leader?.label || "—" }}
      </p>
      <p class="truncate text-[10px] text-muted-foreground">
        {{
          leader
            ? `${formatMetric(leader.value, financial)} · ${formatAnalyticsPercent(leader.share)}`
            : "belum ada kelompok"
        }}
      </p>
    </article>
  </section>
</template>
