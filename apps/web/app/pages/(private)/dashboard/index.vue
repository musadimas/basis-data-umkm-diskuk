<script setup lang="ts">
import type {
  ClusterItem,
  GenderDistributionData,
  KbliCategoryItem,
  ScaleStatItem,
  TopCategoryItem,
} from "~/types/dashboard";
import type { InfografisData } from "~/types/infografis";
import type {
  TabularKbliOption,
  TabularKelurahanItem,
  TabularOptions,
} from "~/types/tabular";
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

interface InfografisFilters {
  kabupatenKota: string;
  kecamatan: string;
  desaKelurahan: string;
  skala: string;
  kegiatanUsaha: string;
  kodeKbli: string;
}

const defaultFilters = (): InfografisFilters => ({
  kabupatenKota: "semua",
  kecamatan: "semua",
  desaKelurahan: "semua",
  skala: "semua",
  kegiatanUsaha: "semua",
  kodeKbli: "semua",
});

const filters = reactive(defaultFilters());
const appliedFilters = reactive(defaultFilters());
const filterOpen = ref(false);

const { data: optionsData, error: optionsError } = useFetch<{ data: TabularOptions }>(
  "/panel/tabular/options",
);

const kabupatenOptions = computed(() => [
  { value: "semua", label: "Semua Kabupaten/Kota" },
  ...(optionsData.value?.data?.kota ?? []).map((item) => ({
    value: String(item.id),
    label: item.nama,
  })),
]);

const kecamatanOptions = computed(() => {
  const kotaId = Number(filters.kabupatenKota);
  const items = optionsData.value?.data?.kecamatan ?? [];
  const scoped = Number.isInteger(kotaId) && kotaId > 0
    ? items.filter((item) => item.kotaId === kotaId)
    : items;
  return [
    { value: "semua", label: "Semua Kecamatan" },
    ...scoped.map((item) => ({ value: String(item.id), label: item.nama })),
  ];
});

const kegiatanOptions = computed(() => [
  { value: "semua", label: "Semua Kegiatan Usaha" },
  ...(optionsData.value?.data?.kategori ?? []).map((item) => ({ value: item, label: item })),
]);

const kbliOptions = computed(() => {
  const items: TabularKbliOption[] = optionsData.value?.data?.kbli ?? [];
  const scoped = filters.kegiatanUsaha === "semua"
    ? items
    : items.filter((item) => item.kategori === filters.kegiatanUsaha);
  return [
    { value: "semua", label: "Semua Kode KBLI" },
    ...scoped.map((item) => ({ value: item.kode, label: item.kode })),
  ];
});

const kelurahanCache = new Map<string, TabularKelurahanItem[]>();
const desaKelurahanOptions = ref([{ value: "semua", label: "Semua Desa/Kelurahan" }]);

const syncKelurahanOptions = (kecamatanId: string) => {
  const items = kecamatanId === "semua" ? [] : (kelurahanCache.get(kecamatanId) ?? []);
  desaKelurahanOptions.value = [
    { value: "semua", label: "Semua Desa/Kelurahan" },
    ...items.map((item) => ({ value: String(item.id), label: item.nama })),
  ];
};

const loadKelurahan = async (kecamatanId: string) => {
  try {
    const response = await $fetch<{ data: TabularKelurahanItem[] }>("/panel/tabular/kelurahan", {
      query: { kecamatan: kecamatanId },
    });
    kelurahanCache.set(kecamatanId, response.data ?? []);
  } catch {
    kelurahanCache.set(kecamatanId, []);
  } finally {
    if (filters.kecamatan === kecamatanId) syncKelurahanOptions(kecamatanId);
  }
};

watch(() => filters.kabupatenKota, () => {
  filters.kecamatan = "semua";
});

watch(() => filters.kecamatan, (value) => {
  filters.desaKelurahan = "semua";
  if (value === "semua") return syncKelurahanOptions(value);
  if (kelurahanCache.has(value)) return syncKelurahanOptions(value);
  syncKelurahanOptions("semua");
  void loadKelurahan(value);
});

watch(() => filters.kegiatanUsaha, (value) => {
  if (value === "semua" || filters.kodeKbli === "semua") return;
  const items = optionsData.value?.data?.kbli ?? [];
  if (!items.some((item) => item.kategori === value && item.kode === filters.kodeKbli)) {
    filters.kodeKbli = "semua";
  }
});

const skalaToApi: Record<string, string> = {
  mikro: "micro",
  kecil: "small",
  menengah: "medium",
};

const infografisQuery = computed(() => ({
  kota: appliedFilters.kabupatenKota !== "semua" ? appliedFilters.kabupatenKota : undefined,
  kecamatan: appliedFilters.kecamatan !== "semua" ? appliedFilters.kecamatan : undefined,
  kelurahan: appliedFilters.desaKelurahan !== "semua" ? appliedFilters.desaKelurahan : undefined,
  skala: appliedFilters.skala !== "semua" ? skalaToApi[appliedFilters.skala] : undefined,
  kegiatan: appliedFilters.kegiatanUsaha !== "semua" ? appliedFilters.kegiatanUsaha : undefined,
  kbli: appliedFilters.kodeKbli !== "semua" ? appliedFilters.kodeKbli : undefined,
}));

const { data, error, pending } = await useFetch<{ data: InfografisData }>(
  "/panel/infografis/",
  { query: infografisQuery },
);

const activeFilterCount = computed(() =>
  Object.values(appliedFilters).filter((value) => value !== "semua").length,
);

const applyFilters = () => Object.assign(appliedFilters, filters);
const resetFilters = () => {
  Object.assign(filters, defaultFilters());
  Object.assign(appliedFilters, defaultFilters());
};

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
    <p
      v-if="optionsError"
      class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      Opsi filter belum dapat dimuat. Silakan coba lagi.
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

    <DashboardFilterFab
      v-model:open="filterOpen"
      title="Filter Infografis UMKM"
      :active-count="activeFilterCount"
      :pending="pending"
      @apply="applyFilters"
      @reset="resetFilters"
    >
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div class="space-y-1.5">
          <label for="infografis-kabupaten" class="text-xs font-semibold">Kabupaten/Kota</label>
          <UiSelect v-model="filters.kabupatenKota">
            <UiSelectTrigger id="infografis-kabupaten" size="sm" class="w-full">
              <UiSelectValue placeholder="Semua Kabupaten/Kota" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem v-for="option in kabupatenOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>

        <div class="space-y-1.5">
          <label for="infografis-kecamatan" class="text-xs font-semibold">Kecamatan</label>
          <UiSelect v-model="filters.kecamatan">
            <UiSelectTrigger id="infografis-kecamatan" size="sm" class="w-full">
              <UiSelectValue placeholder="Semua Kecamatan" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem v-for="option in kecamatanOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>

        <div class="space-y-1.5">
          <label for="infografis-kelurahan" class="text-xs font-semibold">Desa/Kelurahan</label>
          <UiSelect v-model="filters.desaKelurahan">
            <UiSelectTrigger id="infografis-kelurahan" size="sm" class="w-full">
              <UiSelectValue placeholder="Semua Desa/Kelurahan" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem v-for="option in desaKelurahanOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>

        <div class="space-y-1.5">
          <label for="infografis-skala" class="text-xs font-semibold">Skala Usaha</label>
          <UiSelect v-model="filters.skala">
            <UiSelectTrigger id="infografis-skala" size="sm" class="w-full">
              <UiSelectValue placeholder="Semua Skala Usaha" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem value="semua">Semua Skala Usaha</UiSelectItem>
              <UiSelectItem value="mikro">Mikro</UiSelectItem>
              <UiSelectItem value="kecil">Kecil</UiSelectItem>
              <UiSelectItem value="menengah">Menengah</UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>

        <div class="space-y-1.5">
          <label for="infografis-kegiatan" class="text-xs font-semibold">Kegiatan Usaha</label>
          <UiSelect v-model="filters.kegiatanUsaha">
            <UiSelectTrigger id="infografis-kegiatan" size="sm" class="w-full">
              <UiSelectValue placeholder="Semua Kegiatan Usaha" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem v-for="option in kegiatanOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>

        <div class="space-y-1.5">
          <label for="infografis-kbli" class="text-xs font-semibold">Kode KBLI</label>
          <UiSelect v-model="filters.kodeKbli">
            <UiSelectTrigger id="infografis-kbli" size="sm" class="w-full">
              <UiSelectValue placeholder="Semua Kode KBLI" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem v-for="option in kbliOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>
      </div>
    </DashboardFilterFab>
  </div>
</template>
