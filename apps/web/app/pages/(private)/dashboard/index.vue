<script setup lang="ts">
import type {
  ClusterItem,
  GenderDistributionData,
  KbliCategoryItem,
  ScaleStatItem,
  TopCategoryItem,
} from "~/types/dashboard";
import type { InfografisData } from "~/types/infografis";
import { DASHBOARD_SECTIONS } from "~/constants/DASHBOARD";
import { defaultAnalysis, serializeAnalysisUrl } from "~/lib/analytics-query"
import DashboardChartMarketingMethods from "~/components/dashboard/chart/MarketingMethods.vue";
import DashboardChartNibOwnership from "~/components/dashboard/chart/NibOwnership.vue";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Infografis UMKM – Dashboard Basis Data UMKM DisKUK Jawa Barat",
  description:
    "Dashboard infografis statistik sebaran UMKM, skala usaha, kluster holding UMKM, dan klasifikasi KBLI Provinsi Jawa Barat.",
});

const router = useRouter();
const runtimeConfig = useRuntimeConfig();
function openAnalytics(fieldId: string, value: string) { const config = { ...defaultAnalysis, groupBy: fieldId, filters: [{ fieldId, operator: "eq" as const, value }] }; router.push(`/dashboard/analitik?${serializeAnalysisUrl(config)}`) }
function openRegion(region: { id: string }) { openAnalytics("kota_id", region.id) }
function openKbli(item?: TopCategoryItem) { if (item?.code) openAnalytics("kbli_kode", item.code) }
const workforceEnabled = computed(() => runtimeConfig.public.enableWorkforce === true);
const { data, error } = await useFetch<{ data: InfografisData }>(
  "/panel/infografis/",
);

const infografis = computed(() => data.value?.data);

const scaleItems = computed<ScaleStatItem[]>(() => {
  const scales = infografis.value?.scales;
  if (!scales) return [];

  return [
    {
      id: "total",
      title: "Total UMKM",
      value: scales.total,
      category: "total",
      buttonText: "Lihat Data",
      buttonHref: "/dashboard/tabular",
    },
    {
      id: "mikro",
      title: "Usaha Mikro",
      value: scales.mikro,
      category: "mikro",
    },
    {
      id: "kecil",
      title: "Usaha Kecil",
      value: scales.kecil,
      category: "kecil",
    },
    {
      id: "menengah",
      title: "Usaha Menengah",
      value: scales.menengah,
      category: "menengah",
    },
  ];
});

const topCategoryItems = computed<TopCategoryItem[]>(() =>
  (infografis.value?.topKbli ?? []).map(({ code, name, total }) => ({
    code,
    name,
    value: total,
  })),
);

const sectorItems = computed<ClusterItem[]>(() =>
  (infografis.value?.sectors ?? []).map(
    ({ code, name, total, percentage }) => ({
      id: code,
      name,
      value: total,
      percentage,
    }),
  ),
);

const genderData = computed<GenderDistributionData | undefined>(() => {
  const workforce = infografis.value?.workforce;
  return (
    workforce && {
      malePercentage: workforce.malePercentage,
      femalePercentage: workforce.femalePercentage,
      maleCount: workforce.male,
      femaleCount: workforce.female,
      totalWorkers: workforce.total,
    }
  );
});

const nibData = computed(() => infografis.value?.nib);
const marketingMethods = computed(() => infografis.value?.marketingMethods);

const kbliItems = computed<KbliCategoryItem[]>(() =>
  (infografis.value?.sectors ?? []).map((item) => ({
    code: item.code,
    title: item.name,
    description: "Sektor lapangan usaha berdasarkan KBLI.",
    totalUmkm: item.total,
    subItems: [
      { title: "Usaha Mikro", value: item.mikro, category: "mikro" },
      { title: "Usaha Kecil", value: item.kecil, category: "kecil" },
      { title: "Usaha Menengah", value: item.menengah, category: "menengah" },
    ],
  })),
);
</script>

<template>
  <div class="space-y-5 pb-8">
    <!-- Top Hero Banner -->
    <DashboardCardBanner
      title="Infografis UMKM"
      description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent dictum tortor eu dictum pulvinar. Fusce pulvinar enim ac dui luctus, ac tempus nisl vestibulum. Sed sit amet ante sit amet sapien dictum ultrices quis at augue. Nulla pharetra ex dictum, venenatis nunc a, tempor lectus."
    />

    <p
      v-if="error"
      class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      Data infografis belum dapat dimuat. Silakan coba lagi.
    </p>

    <!-- Section 1: Jumlah Usaha Berdasarkan Skala Usaha -->
    <DashboardCardSection
      v-bind="DASHBOARD_SECTIONS.scale"
      title="Skala yang dilaporkan"
      card-class="p-3!"
      header-class="mb-3!"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCardScaleStat
          v-for="item in scaleItems"
          :key="item.id"
          :title="item.title"
          :value="item.value"
          :category="item.category"
          :button-text="item.buttonText"
          :button-href="item.buttonHref"
        />
      </div>
    </DashboardCardSection>

    <!-- Section 2: Peta Sebaran Usaha Berdasarkan Wilayah -->
    <DashboardCardSection v-bind="DASHBOARD_SECTIONS.regionalMap">
      <DashboardMapInfographic
        :regions="infografis?.regions"
        :geometry-ready="infografis?.geometryReady"
        :geometry-source="infografis?.geometrySource"
        @select="openRegion"
      />
    </DashboardCardSection>

    <!-- Section 3: Jumlah UMKM Berdasarkan Kategori Lapangan Usaha -->
    <DashboardCardSection v-bind="DASHBOARD_SECTIONS.category">
      <DashboardChartClusterBar :items="sectorItems" />
    </DashboardCardSection>

    <!-- Section 4: NIB & Marketing Methods -->
    <div
      v-if="nibData || marketingMethods"
      class="grid grid-cols-1 gap-5 lg:grid-cols-2"
    >
      <DashboardCardSection
        v-if="nibData"
        v-bind="DASHBOARD_SECTIONS.nib"
        card-class="flex flex-col justify-between h-full"
      >
        <DashboardChartNibOwnership
          :data="nibData"
          button-href="/dashboard/tabular"
        />
      </DashboardCardSection>

      <DashboardCardSection
        v-if="marketingMethods"
        v-bind="DASHBOARD_SECTIONS.marketing"
        card-class="flex flex-col justify-between h-full"
      >
        <DashboardChartMarketingMethods
          :items="marketingMethods"
          button-href="/dashboard/tabular"
        />
      </DashboardCardSection>
    </div>

    <!-- Section 5: Top Categories & Gender Distribution -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <DashboardCardSection
        v-bind="DASHBOARD_SECTIONS.topCategories"
        card-class="flex flex-col justify-between h-full"
      >
        <DashboardChartTopCategories :items="topCategoryItems" @click:action="openKbli" />
      </DashboardCardSection>

      <!-- Gender Distribution -->
      <DashboardCardSection
        v-if="workforceEnabled"
        v-bind="DASHBOARD_SECTIONS.gender"
        card-class="flex flex-col justify-between h-full"
      >
        <DashboardChartGenderDistribution :data="genderData" />
      </DashboardCardSection>
    </div>

    <!-- Section 6: Category Accordion List -->
    <DashboardCardSection v-bind="DASHBOARD_SECTIONS.kbliAccordion">
      <DashboardAccordionListKBLI :items="kbliItems" />
    </DashboardCardSection>
  </div>
</template>
