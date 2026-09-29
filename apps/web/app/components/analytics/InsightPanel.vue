<script setup lang="ts">
import type { AnalyticsGroup, AnalyticsMetric } from "~/types/analytics";
import {
  formatAnalyticsMetricValue,
  formatAnalyticsPercent,
} from "~/lib/analytics-format";

const props = defineProps<{
  groups: AnalyticsGroup[];
  metric?: AnalyticsMetric;
  coverage?: number;
  unknownShare?: number;
}>();
const emit = defineEmits<{ evidence: [] }>();
const financial = computed(() => props.metric?.unit === "IDR");
const formatValue = (value: number | null | undefined) =>
  formatAnalyticsMetricValue(value, props.metric?.unit);

/**
 * Insight deterministik (product-spec §8): konsentrasi, penyimpangan terbesar
 * dari distribusi Jawa Barat, kualitas data, dan outlier IQR. Semua dihitung
 * dari grup agregat yang sudah ada di klien (≤21 angka) — tanpa request baru.
 * Wording nonkausal sesuai ux-spec §9.
 */
interface Insight {
  id: string;
  headline: string;
  detail: string;
}

const QUARTILE_N = 4;

const leader = computed(() => props.groups[0]);
const lowCoverage = computed(
  () => props.coverage != null && props.coverage < 95,
);
const highCoverageWarning = computed(
  () => props.coverage != null && props.coverage < 80,
);

/** Deviasi vs distribusi Jawa Barat: selisih share terbesar terhadap baseline seragam provinsi. */
const deviation = computed(() => {
  if (props.groups.length < 2) return null;
  const uniformShare = 100 / props.groups.length;
  let worst: { group: AnalyticsGroup; delta: number } | null = null;
  for (const group of props.groups) {
    const delta = Number(group.share || 0) - uniformShare;
    if (!worst || Math.abs(delta) > Math.abs(worst.delta))
      worst = { group, delta };
  }
  return worst ? { ...worst, uniformShare } : null;
});

/** Konsentrasi 3 teratas sebagai indikator kesenjangan antarwilayah/sektor. */
const concentration = computed(() => {
  if (props.groups.length < 3) return null;
  const topThree = props.groups
    .slice(0, 3)
    .reduce((sum, group) => sum + Number(group.share || 0), 0);
  return topThree >= 60 ? topThree : null;
});

/** Outlier numerik berbasis IQR atas nilai kelompok. */
const outliers = computed(() => {
  if (props.groups.length < QUARTILE_N) return [];
  const values = props.groups
    .map((group) => Number(group.value || 0))
    .sort((a, b) => a - b);
  const quartile = (part: number) => {
    const position = part * (values.length - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    return (
      values[lower]! + (values[upper]! - values[lower]!) * (position - lower)
    );
  };
  const q1 = quartile(0.25);
  const q3 = quartile(0.75);
  const upperFence = q3 + 1.5 * (q3 - q1);
  if (upperFence <= q3) return [];
  return props.groups
    .filter((group) => Number(group.value || 0) > upperFence)
    .slice(0, 2);
});

const unknownGroups = computed(() =>
  props.groups.filter(
    (group) =>
      group.key === "unknown" ||
      /tidak diketahui|tidak ada kode|tidak terpetakan/i.test(group.label),
  ),
);
const unmappedValue = computed(() =>
  unknownGroups.value.reduce((sum, group) => sum + Number(group.value || 0), 0),
);

const insights = computed<Insight[]>(() => {
  const result: Insight[] = [];
  if (leader.value && props.groups.length > 1) {
    result.push({
      id: "leader",
      headline: `Porsi tertinggi pada filter ini: ${leader.value.label}`,
      detail: `${formatValue(leader.value.value)} (${formatAnalyticsPercent(leader.value.share)} dari total terfilter).`,
    });
  }
  if (concentration.value) {
    result.push({
      id: "concentration",
      headline: `Terkonsentrasi pada 3 kelompok teratas (${formatAnalyticsPercent(concentration.value)})`,
      detail: "Kelompok lain menyumbang porsi kecil dalam filter ini.",
    });
  }
  if (deviation.value && Math.abs(deviation.value.delta) >= 5) {
    const direction = deviation.value.delta > 0 ? "di atas" : "di bawah";
    result.push({
      id: "deviation",
      headline: `${deviation.value.group.label} ${direction} pola rata Jawa Barat`,
      detail: `Porsi ${formatAnalyticsPercent(deviation.value.group.share)} vs rata ${formatAnalyticsPercent(deviation.value.uniformShare)}.`,
    });
  }
  for (const group of outliers.value) {
    result.push({
      id: `outlier-${group.key}`,
      headline: `${group.label} adalah outlier nilai tertinggi`,
      detail: `${formatValue(group.value)}, jauh di atas rentang umum (IQR).`,
    });
  }
  if (unmappedValue.value > 0) {
    result.push({
      id: "unmapped",
      headline: `${formatValue(unmappedValue.value)} pada kelompok belum terpetakan`,
      detail:
        "Kelompok “tidak diketahui” tetap masuk agregat agar total konsisten.",
    });
  }
  return result.slice(0, 4);
});
</script>

<template>
  <aside
    class="shrink-0 rounded-md border border-emerald-200 bg-emerald-50/50 px-2.5 py-1.5 text-[11px]"
    aria-labelledby="insight-title"
  >
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <h2
        id="insight-title"
        class="text-[10px] font-bold uppercase tracking-wide text-emerald-900"
      >
        Insight terukur
      </h2>
      <p
        v-if="insights.length"
        class="min-w-0 flex-1 truncate"
        :title="`${insights[0]?.headline} — ${insights[0]?.detail}`"
      >
        {{ insights[0]?.headline }} —
        <span class="font-normal">{{ insights[0]?.detail }}</span>
      </p>
      <p v-else class="min-w-0 flex-1">Belum ada kelompok pada filter ini.</p>
      <button
        type="button"
        class="shrink-0 font-semibold underline"
        @click="emit('evidence')"
      >
        Lihat bukti
      </button>
    </div>

    <details v-if="insights.length > 1" class="mt-0.5">
      <summary class="cursor-pointer text-muted-foreground">
        Insight lainnya ({{ insights.length - 1 }})
      </summary>
      <ul class="mt-1 space-y-1">
        <li
          v-for="insight in insights.slice(1)"
          :key="insight.id"
          class="leading-snug"
        >
          <strong>{{ insight.headline }}</strong> — {{ insight.detail }}
        </li>
      </ul>
    </details>

    <p v-if="highCoverageWarning" class="mt-1 font-semibold text-amber-900">
      Peringatan kualitas tinggi: hanya
      {{ formatAnalyticsPercent(coverage) }} baris
      {{ financial ? "memiliki nilai yang dapat diagregasi" : "terpetakan"
      }}<span v-if="unknownShare"
        >, {{ formatAnalyticsPercent(unknownShare) }} masuk kelompok
        tidak diketahui</span
      >.
    </p>
    <p v-else-if="lowCoverage" class="mt-1 text-amber-900">
      Peringatan cakupan: {{ formatAnalyticsPercent(coverage) }} baris
      {{ financial ? "memiliki nilai yang dapat diagregasi" : "terpetakan"
      }}<span v-if="unknownShare"
        >, {{ formatAnalyticsPercent(unknownShare) }} masuk kelompok
        tidak diketahui</span
      >.
    </p>

    <details class="mt-0.5">
      <summary class="cursor-pointer text-muted-foreground">
        Formula dan batasan
      </summary>
      <p class="mt-0.5 text-muted-foreground">
        {{
          financial
            ? "SUM nilai dilaporkan; NULL dan nilai perlu verifikasi dikeluarkan serta dilaporkan pada coverage"
            : "COUNT DISTINCT usaha.id"
        }}; persentase memakai denominator total metric hasil filter; outlier
        memakai pagar IQR (Q3+1,5×IQR); pembanding “rata Jawa Barat” adalah
        distribusi seragam antarkelompok pada filter ini. Bukan kesimpulan
        sebab-akibat.
      </p>
    </details>
  </aside>
</template>
