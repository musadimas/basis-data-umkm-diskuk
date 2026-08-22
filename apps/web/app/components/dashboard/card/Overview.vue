<script setup lang="ts">
import type { ScaleStatItem } from "~/types/dashboard";
import type {
  InfografisData,
  InfografisKbliItem,
  InfografisMarketingMethod,
  InfografisNibData,
  InfografisRegion,
  InfografisSectorItem,
} from "~/types/infografis";
import { ArrowUpRight, ChartColumnDecreasing, CircleHelp } from "@lucide/vue";
import { DASHBOARD_SECTIONS } from "~/constants/DASHBOARD";
import { formatAnalyticsNumber, formatAnalyticsPercent } from "~/lib/analytics-format";

interface Props {
  items: ScaleStatItem[];
  nib?: InfografisNibData;
  marketingMethods?: InfografisMarketingMethod[];
  /** Sektor KBLI terurut desc dari API, untuk panel top sektor. */
  sectors?: InfografisSectorItem[];
  /** Wilayah terurut desc dari API, untuk panel top kabupaten/kota. */
  regions?: InfografisRegion[];
  /** Kode KBLI terurut desc dari API, untuk panel top kode KBLI. */
  kbli?: InfografisKbliItem[];
  /** Cakupan klasifikasi KBLI, untuk donut kualitas data. */
  sectorCoverage?: InfografisData["sectorCoverage"];
  /** Fallback panel saat metode pemasaran kosong. */
  workforce?: InfografisData["workforce"];
  /** Judul pada header biru. */
  title?: string;
  /** Deskripsi pada header biru. */
  description?: string;
}

const props = withDefaults(defineProps<Props>(), {
  marketingMethods: () => [],
  sectors: () => [],
  regions: () => [],
  kbli: () => [],
  title: "Infografis UMKM",
  description:
    "Ringkasan data UMKM Jawa Barat berdasarkan skala usaha, kepemilikan Nomor Induk Berusaha (NIB), dan metode pemasaran.",
});

const emit = defineEmits<{
  (e: "drill:sektor" | "drill:kota" | "drill:kbli", value: string): void;
}>();

// ── KPI strip & komposisi skala ─────────────────────────────────────────────
const totalScales = computed(() => {
  const total = props.items.find((item) => item.category === "total");
  return Math.max(0, Number(total?.value ?? 0));
});

const scaleTiles = computed(() =>
  props.items
    .filter((item) => item.category !== "total")
    .map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      value: Math.max(0, Number(item.value ?? 0)),
      share: totalScales.value > 0 ? (Number(item.value ?? 0) / totalScales.value) * 100 : 0,
    })),
);

/**
 * Lebar segmen bar komposisi dinormalisasi ke 100% karena persentase server
 * dibulatkan sehingga bisa tidak persis berjumlah 100. Segmen bernilai >0
 * diberi lebar minimum agar tetap terlihat.
 */
const compositionSegments = computed(() => {
  const meta = [
    { key: "mikro", label: "Mikro", barClass: "bg-brand-green", dotClass: "bg-brand-green" },
    { key: "kecil", label: "Kecil", barClass: "bg-sky-500", dotClass: "bg-sky-500" },
    { key: "menengah", label: "Menengah", barClass: "bg-amber-400", dotClass: "bg-amber-400" },
  ] as const;

  const sum = scaleTiles.value.reduce((acc, tile) => acc + tile.share, 0);
  return meta.map((entry) => {
    const tile = scaleTiles.value.find((item) => item.category === entry.key);
    const share = sum > 0 ? ((tile?.share ?? 0) / sum) * 100 : 0;
    const width = tile && tile.value > 0 ? Math.max(share, 0.5) : 0;
    return { ...entry, value: tile?.value ?? 0, share, width };
  });
});

// ── NIB donut ───────────────────────────────────────────────────────────────
const hasNibData = computed(() => Boolean(props.nib && props.nib.total > 0));
const NIB_COLORS = ["#16A75C", "#ffd447"];

const nibChartData = computed(() => {
  if (!props.nib) return [];
  return [
    { label: "Memiliki NIB", value: props.nib.withPercentage },
    { label: "Belum Memiliki NIB", value: props.nib.withoutPercentage },
  ];
});

const nibLegends = computed(() => {
  const nib = props.nib;
  if (!nib) return [];
  return [
    {
      label: "Memiliki NIB",
      value: nib.withNib,
      percentage: nib.withPercentage,
      dotClass: "bg-brand-green",
    },
    {
      label: "Belum Memiliki NIB",
      value: nib.withoutNib,
      percentage: nib.withoutPercentage,
      dotClass: "bg-amber-400",
    },
  ];
});

// ── Metode pemasaran / fallback tenaga kerja ────────────────────────────────
const hasMarketingData = computed(() => props.marketingMethods.length > 0);
const hasWorkforceData = computed(() => Boolean(props.workforce && props.workforce.total > 0));
const GENDER_COLORS = ["#0ea5e9", "#f43f5e"];

const maxMarketingValue = computed(() =>
  Math.max(0, ...props.marketingMethods.map((item) => item.value)),
);

function marketingBarWidth(value: number) {
  if (!maxMarketingValue.value || value <= 0) return 0;
  return Math.max(2, (value / maxMarketingValue.value) * 100);
}

const genderChartData = computed(() => {
  const workforce = props.workforce;
  if (!workforce || workforce.total <= 0) return [];
  return [
    { label: "Laki-laki", value: workforce.malePercentage },
    { label: "Perempuan", value: workforce.femalePercentage },
  ];
});

const genderLegends = computed(() => {
  const workforce = props.workforce;
  if (!workforce || workforce.total <= 0) return [];
  return [
    {
      label: "Laki-laki",
      value: workforce.male,
      percentage: workforce.malePercentage,
      dotClass: "bg-sky-500",
    },
    {
      label: "Perempuan",
      value: workforce.female,
      percentage: workforce.femalePercentage,
      dotClass: "bg-rose-500",
    },
  ];
});

// ── Top sektor & top wilayah ────────────────────────────────────────────────
/** API sudah mengurutkan berdasarkan total desc; ambil lima teratas. */
const topSectors = computed(() =>
  props.sectors.filter((item) => item.total > 0).slice(0, 5),
);
const maxSectorValue = computed(() =>
  Math.max(0, ...topSectors.value.map((item) => item.total)),
);

const topRegions = computed(() =>
  props.regions.filter((item) => item.value > 0).slice(0, 5),
);
const maxRegionValue = computed(() =>
  Math.max(0, ...topRegions.value.map((item) => item.value)),
);

function rankedBarWidth(value: number, max: number) {
  if (!max || value <= 0) return 0;
  return Math.max(2, (value / max) * 100);
}

function regionShare(value: number) {
  return totalScales.value > 0 ? (value / totalScales.value) * 100 : 0;
}

// ── Top kode KBLI ───────────────────────────────────────────────────────────
const topKbli = computed(() =>
  props.kbli.filter((item) => item.total > 0).slice(0, 5),
);
const maxKbliValue = computed(() =>
  Math.max(0, ...topKbli.value.map((item) => item.total)),
);

// ── Kualitas klasifikasi KBLI ───────────────────────────────────────────────
const hasCoverageData = computed(() => {
  const coverage = props.sectorCoverage;
  return Boolean(coverage && coverage.mapped + coverage.unclassified > 0);
});

const COVERAGE_COLORS = ["#16A75C", "#e2e8f0"];

const coverageChartData = computed(() => {
  const coverage = props.sectorCoverage;
  if (!coverage) return [];
  const total = coverage.mapped + coverage.unclassified;
  if (total <= 0) return [];
  return [
    { label: "Terpetakan", value: (coverage.mapped / total) * 100 },
    { label: "Tidak terpetakan", value: (coverage.unclassified / total) * 100 },
  ];
});

const coveragePercentage = computed(() => {
  const coverage = props.sectorCoverage;
  if (!coverage) return 0;
  const total = coverage.mapped + coverage.unclassified;
  return total > 0 ? Math.round((coverage.mapped / total) * 1000) / 10 : 0;
});
</script>

<template>
  <UiCard
    class="flex-col gap-0 overflow-hidden rounded-lg py-0! shadow-xs"
    role="region"
    aria-label="Infografis UMKM"
  >
    <!-- Header ramping: identitas infografis -->
    <header class="flex items-center gap-3 bg-[#1E88E5] px-4 py-2.5 text-white">
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/50"
        aria-hidden="true"
      >
        <ChartColumnDecreasing class="h-5 w-5 stroke-[2.2]" />
      </div>
      <div class="min-w-0">
        <h1 class="text-base font-bold leading-tight tracking-tight sm:text-lg">
          {{ title }}
        </h1>
        <p class="truncate text-[11px] leading-snug text-white/85">
          {{ description }}
        </p>
      </div>
    </header>

    <!-- Badan ringkasan: skala, komposisi, NIB, pemasaran, top sektor/wilayah -->
    <div
      class="space-y-4 p-3!"
      aria-label="Rincian skala usaha, kepemilikan NIB, dan metode pemasaran"
    >
      <!-- Skala yang dilaporkan: KPI strip + bar komposisi -->
      <section aria-labelledby="dashboard-scale-title" class="space-y-2">
        <div class="flex items-center gap-1.5">
          <h2 id="dashboard-scale-title" class="text-sm font-bold">
            Skala yang dilaporkan
          </h2>
          <UiTooltipProvider v-if="DASHBOARD_SECTIONS.scale.tooltip">
            <UiTooltip>
              <UiTooltipTrigger as-child>
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                  :aria-label="`Informasi tentang ${DASHBOARD_SECTIONS.scale.title}`"
                >
                  <CircleHelp class="h-4 w-4" />
                </button>
              </UiTooltipTrigger>
              <UiTooltipContent class="text-justify max-w-2xs text-xs font-normal">
                <p>{{ DASHBOARD_SECTIONS.scale.tooltip }}</p>
              </UiTooltipContent>
            </UiTooltip>
          </UiTooltipProvider>
          <span class="ml-auto hidden text-[11px] leading-snug text-muted-foreground sm:block">
            {{ DASHBOARD_SECTIONS.scale.description }}
          </span>
        </div>

        <!-- KPI strip kompak -->
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div
            class="flex flex-col justify-between rounded-lg border border-border bg-background px-3 py-2"
          >
            <div class="flex items-baseline justify-between gap-2">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Total UMKM
              </p>
              <NuxtLink
                to="/dashboard/tabular"
                class="shrink-0 text-[11px] font-semibold text-brand-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              >
                Lihat Data
              </NuxtLink>
            </div>
            <p class="mt-1 text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground">
              {{ formatAnalyticsNumber(totalScales) }}
            </p>
          </div>

          <div
            v-for="tile in scaleTiles"
            :key="tile.id"
            class="rounded-lg border px-3 py-2"
            :class="{
              'bg-brand-green border-brand-green': tile.category === 'mikro',
              'bg-brand-blue border-brand-blue': tile.category === 'kecil',
              'bg-brand-amber border-brand-amber': tile.category === 'menengah',
            }"
          >
            <p class="text-[11px] font-semibold uppercase tracking-wide text-brand-green-foreground">
              {{ tile.title }}
            </p>
            <p class="mt-1 text-xl font-bold leading-none tabular-nums tracking-tight text-brand-green-foreground">
              {{ formatAnalyticsNumber(tile.value) }}
            </p>
            <p class="mt-1 text-[10px] font-medium tabular-nums text-brand-green-foreground/80">
              {{ formatAnalyticsPercent(tile.share) }} dari total
            </p>
          </div>
        </div>

        <!-- Bar komposisi skala -->
        <div v-if="totalScales > 0">
          <div
            class="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            :aria-label="`Komposisi skala usaha: ${compositionSegments.map((seg) => `${seg.label} ${formatAnalyticsPercent(seg.share)}`).join(', ')}`"
          >
            <div
              v-for="segment in compositionSegments"
              :key="segment.key"
              class="h-full transition-all duration-500"
              :class="segment.barClass"
              :style="{ width: `${segment.width}%` }"
              :title="`${segment.label}: ${formatAnalyticsPercent(segment.share)} (${formatAnalyticsNumber(segment.value)} usaha)`"
            />
          </div>
          <div class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            <span
              v-for="segment in compositionSegments"
              :key="segment.key"
              class="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span
                class="inline-block h-2 w-2 rounded-full"
                :class="segment.dotClass"
                aria-hidden="true"
              />
              {{ segment.label }}
              <strong class="font-semibold tabular-nums text-foreground">
                {{ formatAnalyticsPercent(segment.share) }}
              </strong>
            </span>
          </div>
        </div>
      </section>

      <!-- Grid panel grafik: NIB, pemasaran/gender, top sektor, top wilayah -->
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <!-- Panel NIB: donut + legenda -->
        <section
          v-if="hasNibData"
          aria-labelledby="dashboard-nib-title"
          class="rounded-lg border border-border/70 bg-muted/20 p-3"
        >
          <div class="mb-2 flex items-start justify-between gap-3">
            <h2
              id="dashboard-nib-title"
              class="flex items-center gap-1.5 text-sm font-bold text-foreground"
            >
              {{ DASHBOARD_SECTIONS.nib.title }}
              <UiTooltipProvider v-if="DASHBOARD_SECTIONS.nib.tooltip">
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                      :aria-label="`Informasi tentang ${DASHBOARD_SECTIONS.nib.title}`"
                    >
                      <CircleHelp class="h-3.5 w-3.5" />
                    </button>
                  </UiTooltipTrigger>
                  <UiTooltipContent class="text-justify max-w-2xs text-xs font-normal">
                    <p>{{ DASHBOARD_SECTIONS.nib.tooltip }}</p>
                  </UiTooltipContent>
                </UiTooltip>
              </UiTooltipProvider>
            </h2>
            <NuxtLink
              to="/dashboard/tabular"
              class="shrink-0 rounded-md text-xs font-semibold text-brand-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            >
              Lihat Data
            </NuxtLink>
          </div>

          <div class="flex items-center gap-4">
            <div class="relative h-32 w-32 shrink-0">
              <UiDonutChart
                class="h-full! w-full!"
                :data="nibChartData"
                category="value"
                index="label"
                :colors="NIB_COLORS"
                :show-legend="false"
                central-label=""
                :value-formatter="(v: number) => formatAnalyticsPercent(v)"
              />
            </div>
            <dl class="min-w-0 flex-1 space-y-2">
              <div
                v-for="legend in nibLegends"
                :key="legend.label"
                class="flex items-center gap-2"
              >
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-sm"
                  :class="legend.dotClass"
                  aria-hidden="true"
                />
                <dt class="truncate text-xs font-medium text-muted-foreground">
                  {{ legend.label }}
                </dt>
                <dd class="ml-auto shrink-0 text-xs font-bold tabular-nums text-foreground">
                  {{ formatAnalyticsPercent(legend.percentage) }}
                </dd>
                <dd class="shrink-0 text-xs tabular-nums text-muted-foreground">
                  ({{ formatAnalyticsNumber(legend.value) }})
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <!-- Panel metode pemasaran; kosong → fallback tenaga kerja -->
        <section
          v-if="hasMarketingData"
          aria-labelledby="dashboard-marketing-title"
          class="rounded-lg border border-border/70 bg-muted/20 p-3"
        >
          <div class="mb-2 flex items-start justify-between gap-3">
            <h2
              id="dashboard-marketing-title"
              class="flex items-center gap-1.5 text-sm font-bold text-foreground"
            >
              {{ DASHBOARD_SECTIONS.marketing.title }}
              <UiTooltipProvider v-if="DASHBOARD_SECTIONS.marketing.tooltip">
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                      :aria-label="`Informasi tentang ${DASHBOARD_SECTIONS.marketing.title}`"
                    >
                      <CircleHelp class="h-3.5 w-3.5" />
                    </button>
                  </UiTooltipTrigger>
                  <UiTooltipContent class="text-justify max-w-2xs text-xs font-normal">
                    <p>{{ DASHBOARD_SECTIONS.marketing.tooltip }}</p>
                  </UiTooltipContent>
                </UiTooltip>
              </UiTooltipProvider>
            </h2>
            <NuxtLink
              to="/dashboard/tabular"
              class="shrink-0 rounded-md text-xs font-semibold text-brand-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            >
              Lihat Data
            </NuxtLink>
          </div>

          <ul class="space-y-2">
            <li v-for="item in marketingMethods" :key="item.key">
              <div class="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
                <span
                  class="truncate font-medium text-foreground"
                  :title="item.label"
                >
                  {{ item.label }}
                </span>
                <span class="shrink-0 tabular-nums">
                  <span class="font-bold text-foreground">{{
                    formatAnalyticsNumber(item.value)
                  }}</span>
                  <span class="text-muted-foreground">
                    · {{ formatAnalyticsPercent(item.percentage) }}</span>
                </span>
              </div>
              <div
                class="h-1.5 w-full overflow-hidden rounded-full bg-border/60"
                role="img"
                :aria-label="`${item.label}: ${formatAnalyticsNumber(item.value)} UMKM (${formatAnalyticsPercent(item.percentage)})`"
              >
                <div
                  class="h-full rounded-full bg-brand-green transition-all duration-500"
                  :style="{ width: `${marketingBarWidth(item.value)}%` }"
                />
              </div>
            </li>
          </ul>
        </section>
        <section
          v-else-if="hasWorkforceData"
          aria-labelledby="dashboard-gender-title"
          class="rounded-lg border border-border/70 bg-muted/20 p-3"
        >
          <div class="mb-2 flex items-start justify-between gap-3">
            <h2
              id="dashboard-gender-title"
              class="flex items-center gap-1.5 text-sm font-bold text-foreground"
            >
              {{ DASHBOARD_SECTIONS.gender.title }}
              <UiTooltipProvider v-if="DASHBOARD_SECTIONS.gender.tooltip">
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                      :aria-label="`Informasi tentang ${DASHBOARD_SECTIONS.gender.title}`"
                    >
                      <CircleHelp class="h-3.5 w-3.5" />
                    </button>
                  </UiTooltipTrigger>
                  <UiTooltipContent class="text-justify max-w-2xs text-xs font-normal">
                    <p>{{ DASHBOARD_SECTIONS.gender.tooltip }}</p>
                  </UiTooltipContent>
                </UiTooltip>
              </UiTooltipProvider>
            </h2>
          </div>

          <div class="flex items-center gap-4">
            <div class="relative h-32 w-32 shrink-0">
              <UiDonutChart
                class="h-full! w-full!"
                :data="genderChartData"
                category="value"
                index="label"
                :colors="GENDER_COLORS"
                :show-legend="false"
                central-label=""
                :value-formatter="(v: number) => formatAnalyticsPercent(v)"
              />
            </div>
            <dl class="min-w-0 flex-1 space-y-2">
              <div
                v-for="legend in genderLegends"
                :key="legend.label"
                class="flex items-center gap-2"
              >
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-sm"
                  :class="legend.dotClass"
                  aria-hidden="true"
                />
                <dt class="truncate text-xs font-medium text-muted-foreground">
                  {{ legend.label }}
                </dt>
                <dd class="ml-auto shrink-0 text-xs font-bold tabular-nums text-foreground">
                  {{ formatAnalyticsPercent(legend.percentage) }}
                </dd>
                <dd class="shrink-0 text-xs tabular-nums text-muted-foreground">
                  ({{ formatAnalyticsNumber(legend.value) }})
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <!-- Panel top sektor KBLI -->
        <section
          v-if="topSectors.length"
          aria-labelledby="dashboard-top-sector-title"
          class="rounded-lg border border-border/70 bg-muted/20 p-3"
        >
          <div class="mb-2 flex items-start justify-between gap-3">
            <h2
              id="dashboard-top-sector-title"
              class="flex items-center gap-1.5 text-sm font-bold text-foreground"
            >
              {{ DASHBOARD_SECTIONS.topSector.title }}
              <UiTooltipProvider v-if="DASHBOARD_SECTIONS.topSector.tooltip">
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                      :aria-label="`Informasi tentang ${DASHBOARD_SECTIONS.topSector.title}`"
                    >
                      <CircleHelp class="h-3.5 w-3.5" />
                    </button>
                  </UiTooltipTrigger>
                  <UiTooltipContent class="text-justify max-w-2xs text-xs font-normal">
                    <p>{{ DASHBOARD_SECTIONS.topSector.tooltip }}</p>
                  </UiTooltipContent>
                </UiTooltip>
              </UiTooltipProvider>
            </h2>
          </div>

          <ul class="space-y-1.5">
            <li v-for="(sector, index) in topSectors" :key="sector.code">
              <button
                type="button"
                class="group flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                :title="`Buka analitik untuk sektor ${sector.code} – ${sector.name}`"
                @click="emit('drill:sektor', sector.code)"
              >
                <span
                  class="w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-muted-foreground"
                  aria-hidden="true"
                >
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-baseline justify-between gap-2 text-xs">
                    <span class="truncate font-medium text-foreground">
                      <span class="font-bold text-brand-green">{{ sector.code }}</span>
                      · {{ sector.name }}
                    </span>
                    <span class="shrink-0 tabular-nums">
                      <span class="font-bold text-foreground">{{ formatAnalyticsNumber(sector.total) }}</span>
                      <span class="text-muted-foreground">· {{ formatAnalyticsPercent(sector.percentage) }}</span>
                    </span>
                  </span>
                  <span
                    class="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-border/60"
                    role="img"
                    :aria-label="`Sektor ${sector.code}: ${formatAnalyticsNumber(sector.total)} UMKM (${formatAnalyticsPercent(sector.percentage)})`"
                  >
                    <span
                      class="block h-full rounded-full bg-brand-green transition-all duration-500 group-hover:bg-brand-green/80"
                      :style="{ width: `${rankedBarWidth(sector.total, maxSectorValue)}%` }"
                    />
                  </span>
                </span>
                <ArrowUpRight
                  class="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-brand-green"
                  aria-hidden="true"
                />
              </button>
            </li>
          </ul>
        </section>

        <!-- Panel top kabupaten/kota -->
        <section
          v-if="topRegions.length"
          aria-labelledby="dashboard-top-region-title"
          class="rounded-lg border border-border/70 bg-muted/20 p-3"
        >
          <div class="mb-2 flex items-start justify-between gap-3">
            <h2
              id="dashboard-top-region-title"
              class="flex items-center gap-1.5 text-sm font-bold text-foreground"
            >
              {{ DASHBOARD_SECTIONS.topRegion.title }}
              <UiTooltipProvider v-if="DASHBOARD_SECTIONS.topRegion.tooltip">
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                      :aria-label="`Informasi tentang ${DASHBOARD_SECTIONS.topRegion.title}`"
                    >
                      <CircleHelp class="h-3.5 w-3.5" />
                    </button>
                  </UiTooltipTrigger>
                  <UiTooltipContent class="text-justify max-w-2xs text-xs font-normal">
                    <p>{{ DASHBOARD_SECTIONS.topRegion.tooltip }}</p>
                  </UiTooltipContent>
                </UiTooltip>
              </UiTooltipProvider>
            </h2>
          </div>

          <ul class="space-y-1.5">
            <li v-for="(region, index) in topRegions" :key="region.id">
              <button
                type="button"
                class="group flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                :title="`Buka analitik untuk ${region.name}`"
                @click="emit('drill:kota', region.id)"
              >
                <span
                  class="w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-muted-foreground"
                  aria-hidden="true"
                >
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-baseline justify-between gap-2 text-xs">
                    <span class="truncate font-medium text-foreground">
                      {{ region.name }}
                    </span>
                    <span class="shrink-0 tabular-nums">
                      <span class="font-bold text-foreground">{{ formatAnalyticsNumber(region.value) }}</span>
                      <span class="text-muted-foreground">· {{ formatAnalyticsPercent(regionShare(region.value)) }}</span>
                    </span>
                  </span>
                  <span
                    class="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-border/60"
                    role="img"
                    :aria-label="`${region.name}: ${formatAnalyticsNumber(region.value)} UMKM (${formatAnalyticsPercent(regionShare(region.value))})`"
                  >
                    <span
                      class="block h-full rounded-full bg-brand-blue transition-all duration-500 group-hover:bg-brand-blue/80"
                      :style="{ width: `${rankedBarWidth(region.value, maxRegionValue)}%` }"
                    />
                  </span>
                </span>
                <ArrowUpRight
                  class="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-brand-blue"
                  aria-hidden="true"
                />
              </button>
            </li>
          </ul>
        </section>
        <!-- Panel top kode KBLI -->
        <section
          v-if="topKbli.length"
          aria-labelledby="dashboard-top-kbli-title"
          class="rounded-lg border border-border/70 bg-muted/20 p-3"
        >
          <div class="mb-2 flex items-start justify-between gap-3">
            <h2
              id="dashboard-top-kbli-title"
              class="flex items-center gap-1.5 text-sm font-bold text-foreground"
            >
              {{ DASHBOARD_SECTIONS.topKbli.title }}
              <UiTooltipProvider v-if="DASHBOARD_SECTIONS.topKbli.tooltip">
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                      :aria-label="`Informasi tentang ${DASHBOARD_SECTIONS.topKbli.title}`"
                    >
                      <CircleHelp class="h-3.5 w-3.5" />
                    </button>
                  </UiTooltipTrigger>
                  <UiTooltipContent class="text-justify max-w-2xs text-xs font-normal">
                    <p>{{ DASHBOARD_SECTIONS.topKbli.tooltip }}</p>
                  </UiTooltipContent>
                </UiTooltip>
              </UiTooltipProvider>
            </h2>
          </div>

          <ul class="space-y-1.5">
            <li v-for="(item, index) in topKbli" :key="item.code">
              <button
                type="button"
                class="group flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                :title="`Buka analitik untuk KBLI ${item.code}`"
                @click="emit('drill:kbli', item.code)"
              >
                <span
                  class="w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-muted-foreground"
                  aria-hidden="true"
                >
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-baseline justify-between gap-2 text-xs">
                    <span
                      class="truncate font-medium text-foreground"
                      :title="`${item.code} – ${item.name}`"
                    >
                      <span class="font-bold tabular-nums text-brand-blue">{{ item.code }}</span>
                      · {{ item.name }}
                    </span>
                    <span class="shrink-0 tabular-nums">
                      <span class="font-bold text-foreground">{{ formatAnalyticsNumber(item.total) }}</span>
                    </span>
                  </span>
                  <span
                    class="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-border/60"
                    role="img"
                    :aria-label="`KBLI ${item.code}: ${formatAnalyticsNumber(item.total)} UMKM`"
                  >
                    <span
                      class="block h-full rounded-full bg-brand-blue transition-all duration-500 group-hover:bg-brand-blue/80"
                      :style="{ width: `${rankedBarWidth(item.total, maxKbliValue)}%` }"
                    />
                  </span>
                </span>
                <ArrowUpRight
                  class="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-brand-blue"
                  aria-hidden="true"
                />
              </button>
            </li>
          </ul>
        </section>

        <!-- Panel kualitas klasifikasi KBLI -->
        <section
          v-if="hasCoverageData"
          aria-labelledby="dashboard-coverage-title"
          class="rounded-lg border border-border/70 bg-muted/20 p-3"
        >
          <div class="mb-2 flex items-start justify-between gap-3">
            <h2
              id="dashboard-coverage-title"
              class="flex items-center gap-1.5 text-sm font-bold text-foreground"
            >
              {{ DASHBOARD_SECTIONS.coverage.title }}
              <UiTooltipProvider v-if="DASHBOARD_SECTIONS.coverage.tooltip">
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                      :aria-label="`Informasi tentang ${DASHBOARD_SECTIONS.coverage.title}`"
                    >
                      <CircleHelp class="h-3.5 w-3.5" />
                    </button>
                  </UiTooltipTrigger>
                  <UiTooltipContent class="text-justify max-w-2xs text-xs font-normal">
                    <p>{{ DASHBOARD_SECTIONS.coverage.tooltip }}</p>
                  </UiTooltipContent>
                </UiTooltip>
              </UiTooltipProvider>
            </h2>
          </div>

          <div class="flex items-center gap-4">
            <div class="relative h-32 w-32 shrink-0">
              <UiDonutChart
                class="h-full! w-full!"
                :data="coverageChartData"
                category="value"
                index="label"
                :colors="COVERAGE_COLORS"
                :show-legend="false"
                central-label=""
                :value-formatter="(v: number) => formatAnalyticsPercent(v)"
              />
              <div
                class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                aria-hidden="true"
              >
                <span class="text-base font-bold leading-none tabular-nums text-foreground">
                  {{ formatAnalyticsPercent(coveragePercentage) }}
                </span>
                <span class="text-[9px] font-medium text-muted-foreground">terpetakan</span>
              </div>
            </div>
            <dl class="min-w-0 flex-1 space-y-2">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 shrink-0 rounded-sm bg-brand-green" aria-hidden="true" />
                <dt class="text-xs font-medium text-muted-foreground">Terpetakan</dt>
                <dd class="ml-auto shrink-0 text-xs font-bold tabular-nums text-foreground">
                  {{ formatAnalyticsNumber(sectorCoverage?.mapped) }}
                </dd>
              </div>
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 shrink-0 rounded-sm bg-slate-200" aria-hidden="true" />
                <dt class="text-xs font-medium text-muted-foreground">Tidak terpetakan</dt>
                <dd class="ml-auto shrink-0 text-xs font-bold tabular-nums text-foreground">
                  {{ formatAnalyticsNumber(sectorCoverage?.unclassified) }}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </div>
  </UiCard>
</template>
