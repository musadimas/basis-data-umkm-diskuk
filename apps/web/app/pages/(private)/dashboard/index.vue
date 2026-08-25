<script setup lang="ts">
import type {
  GenderDistributionData,
  KbliCategoryItem,
  KbliCodeItem,
  ScaleStatItem,
  SkalaUsaha,
  SpasialUmkmItem,
} from "~/types/dashboard";
import type { InfografisData } from "~/types/infografis";
import type {
  TabularKbliOption,
  TabularKelurahanItem,
  TabularOptions,
  TabularSpasialResponse,
} from "~/types/tabular";
import { DASHBOARD_SECTIONS } from "~/constants/DASHBOARD";
import { defaultAnalysis, serializeAnalysisUrl } from "~/lib/analytics-query";
import { sectorForKbli } from "~/lib/kbli-sectors";
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
function openAnalytics(fieldId: string, value: string) {
  const config = {
    ...defaultAnalysis,
    groupBy: fieldId,
    filters: [{ fieldId, operator: "eq" as const, value }],
  };
  router.push(`/dashboard/analitik?${serializeAnalysisUrl(config)}`);
}
const workforceEnabled = computed(
  () => runtimeConfig.public.enableWorkforce === true,
);

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

const { data: optionsData, error: optionsError } = useFetch<{
  data: TabularOptions;
}>("/panel/tabular/options");

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
  const scoped =
    Number.isInteger(kotaId) && kotaId > 0
      ? items.filter((item) => item.kotaId === kotaId)
      : items;
  return [
    { value: "semua", label: "Semua Kecamatan" },
    ...scoped.map((item) => ({ value: String(item.id), label: item.nama })),
  ];
});

const kegiatanOptions = computed(() => [
  { value: "semua", label: "Semua Kegiatan Usaha" },
  ...(optionsData.value?.data?.kategori ?? []).map((item) => ({
    value: item,
    label: item,
  })),
]);

const kbliOptions = computed(() => {
  const items: TabularKbliOption[] = optionsData.value?.data?.kbli ?? [];
  const scoped =
    filters.kegiatanUsaha === "semua"
      ? items
      : items.filter((item) => item.kategori === filters.kegiatanUsaha);
  return [
    { value: "semua", label: "Semua Kode KBLI" },
    ...scoped.map((item) => ({ value: item.kode, label: item.kode })),
  ];
});

const kelurahanCache = new Map<string, TabularKelurahanItem[]>();
const desaKelurahanOptions = ref([
  { value: "semua", label: "Semua Desa/Kelurahan" },
]);

const syncKelurahanOptions = (kecamatanId: string) => {
  const items =
    kecamatanId === "semua" ? [] : (kelurahanCache.get(kecamatanId) ?? []);
  desaKelurahanOptions.value = [
    { value: "semua", label: "Semua Desa/Kelurahan" },
    ...items.map((item) => ({ value: String(item.id), label: item.nama })),
  ];
};

const loadKelurahan = async (kecamatanId: string) => {
  try {
    const response = await $fetch<{ data: TabularKelurahanItem[] }>(
      "/panel/tabular/kelurahan",
      {
        query: { kecamatan: kecamatanId },
      },
    );
    kelurahanCache.set(kecamatanId, response.data ?? []);
  } catch {
    kelurahanCache.set(kecamatanId, []);
  } finally {
    if (filters.kecamatan === kecamatanId) syncKelurahanOptions(kecamatanId);
  }
};

watch(
  () => filters.kabupatenKota,
  () => {
    filters.kecamatan = "semua";
  },
);

watch(
  () => filters.kecamatan,
  (value) => {
    filters.desaKelurahan = "semua";
    if (value === "semua") return syncKelurahanOptions(value);
    if (kelurahanCache.has(value)) return syncKelurahanOptions(value);
    syncKelurahanOptions("semua");
    void loadKelurahan(value);
  },
);

watch(
  () => filters.kegiatanUsaha,
  (value) => {
    if (value === "semua" || filters.kodeKbli === "semua") return;
    const items = optionsData.value?.data?.kbli ?? [];
    if (
      !items.some(
        (item) => item.kategori === value && item.kode === filters.kodeKbli,
      )
    ) {
      filters.kodeKbli = "semua";
    }
  },
);

const skalaToApi = new Map<string, string>([
  ["mikro", "micro"],
  ["kecil", "small"],
  ["menengah", "medium"],
]);

const infografisQuery = computed(() => ({
  kota:
    appliedFilters.kabupatenKota !== "semua"
      ? appliedFilters.kabupatenKota
      : undefined,
  kecamatan:
    appliedFilters.kecamatan !== "semua" ? appliedFilters.kecamatan : undefined,
  kelurahan:
    appliedFilters.desaKelurahan !== "semua"
      ? appliedFilters.desaKelurahan
      : undefined,
  skala:
    appliedFilters.skala !== "semua"
      ? skalaToApi.get(appliedFilters.skala)
      : undefined,
  kegiatan:
    appliedFilters.kegiatanUsaha !== "semua"
      ? appliedFilters.kegiatanUsaha
      : undefined,
  kbli:
    appliedFilters.kodeKbli !== "semua" ? appliedFilters.kodeKbli : undefined,
}));

const { data, error, pending } = await useFetch<{ data: InfografisData }>(
  "/panel/infografis/",
  { query: infografisQuery },
);

type InfografisMapData = Pick<
  InfografisData,
  | "regions"
  | "regionLevel"
  | "geometryReady"
  | "geometryMissing"
  | "geometrySource"
>;
const mapKota = ref("semua");
const mapKecamatan = ref("semua");
const mapKelurahan = ref("semua");
const mapKotaName = ref("");
const mapKecamatanName = ref("");

/** Cari nama kab/kota dari data dasar (daftar 27 kota Jabar). */
function kotaNameById(id: string): string {
  return (
    data.value?.data?.regions.find((region) => region.id === id)?.name ?? ""
  );
}

watch(
  () =>
    [
      appliedFilters.kabupatenKota,
      appliedFilters.kecamatan,
      appliedFilters.desaKelurahan,
    ] as const,
  ([kota, kecamatan, kelurahan]) => {
    mapKota.value = kota;
    mapKecamatan.value = kecamatan;
    mapKelurahan.value = kelurahan;
    mapKotaName.value = kota !== "semua" ? kotaNameById(kota) : "";
    mapKecamatanName.value = "";
  },
  { immediate: true },
);
const mapQuery = computed(() => ({
  kota: mapKota.value !== "semua" ? mapKota.value : undefined,
  kecamatan: mapKecamatan.value !== "semua" ? mapKecamatan.value : undefined,
  kelurahan: mapKelurahan.value !== "semua" ? mapKelurahan.value : undefined,
  skala:
    appliedFilters.skala !== "semua"
      ? skalaToApi.get(appliedFilters.skala)
      : undefined,
  kegiatan:
    appliedFilters.kegiatanUsaha !== "semua"
      ? appliedFilters.kegiatanUsaha
      : undefined,
  kbli:
    appliedFilters.kodeKbli !== "semua" ? appliedFilters.kodeKbli : undefined,
}));
const { data: mapData, error: mapError } = await useFetch<{
  data: InfografisMapData;
}>("/panel/infografis/map", { query: mapQuery });

// ── Titik UMKM (diambil lazily saat saklar titik diaktifkan) ────────────────
const showRegions = ref(true);
const showPoints = ref(false);
const POINT_LIMIT = 1000;

const apiToSkala = {
  micro: "mikro",
  small: "kecil",
  medium: "menengah",
} satisfies Record<string, SkalaUsaha>;

// Titik mengikuti level drill-down peta + filter global (skala, kegiatan, KBLI).
const pointsQuery = computed(() => ({
  kota: mapKota.value !== "semua" ? mapKota.value : undefined,
  kecamatan: mapKecamatan.value !== "semua" ? mapKecamatan.value : undefined,
  skala:
    appliedFilters.skala !== "semua"
      ? skalaToApi.get(appliedFilters.skala)
      : undefined,
  kegiatan:
    appliedFilters.kegiatanUsaha !== "semua"
      ? appliedFilters.kegiatanUsaha
      : undefined,
  kbli:
    appliedFilters.kodeKbli !== "semua" ? appliedFilters.kodeKbli : undefined,
  limit: POINT_LIMIT,
}));

const { data: pointsData, execute: fetchPoints } =
  await useFetch<TabularSpasialResponse>("/panel/tabular/spasial", {
    query: pointsQuery,
    immediate: false,
  });

let pointsLoaded = false;
watch(showPoints, async (enabled) => {
  if (!enabled || pointsLoaded) return;
  pointsLoaded = true;
  await fetchPoints();
});
watch(pointsQuery, () => {
  // Muat ulang titik saat filter/drill-down berubah setelah dimuat pertama kali.
  if (showPoints.value && pointsLoaded) void fetchPoints();
});

const mapPointItems = computed<SpasialUmkmItem[]>(() =>
  (pointsData.value?.data ?? []).map((point) => ({
    id: point.id,
    namaUsaha: point.nama,
    skala: apiToSkala[point.skala] ?? "mikro",
    kabupatenKota: point.kota,
    kecamatan: point.kecamatan,
    produkUtama: point.produkUtama ?? "–",
    kegiatanUsaha: point.kategoriKbli ?? "–",
    kodeKbli: point.kodeKbli ?? "–",
    latitude: point.latitude,
    longitude: point.longitude,
  })),
);

const activeFilterCount = computed(
  () =>
    Object.values(appliedFilters).filter((value) => value !== "semua").length,
);

const applyFilters = () => Object.assign(appliedFilters, filters);
const resetFilters = () => {
  Object.assign(filters, defaultFilters());
  Object.assign(appliedFilters, defaultFilters());
};

const infografis = computed(() => data.value?.data);
const mapInfografis = computed(() => mapData.value?.data ?? infografis.value);
const canMapGoBack = computed(() =>
  [mapKota.value, mapKecamatan.value, mapKelurahan.value].some(
    (value) => value !== "semua",
  ),
);

function openRegion(region: { id: string; name?: string }) {
  const level = mapInfografis.value?.regionLevel ?? "kota";
  if (level === "kelurahan") return openAnalytics("kelurahan_id", region.id);
  if (level === "kota") {
    mapKota.value = region.id;
    mapKotaName.value = region.name ?? kotaNameById(region.id);
    mapKecamatan.value = "semua";
  } else {
    mapKecamatan.value = region.id;
    mapKecamatanName.value = region.name ?? "";
  }
  mapKelurahan.value = "semua";
}

function mapBack() {
  if (mapKelurahan.value !== "semua") {
    mapKelurahan.value = "semua";
  } else if (mapKecamatan.value !== "semua") {
    mapKecamatan.value = "semua";
    mapKecamatanName.value = "";
  } else {
    mapKota.value = "semua";
    mapKotaName.value = "";
  }
}

/** Teks crumb kedua pada breadcrumb peta: wilayah yang sedang dipilih. */
const mapSelectionLabel = computed(() => {
  const level = mapInfografis.value?.regionLevel ?? "kota";
  if (level === "kelurahan") return mapKecamatanName.value || "Kecamatan";
  if (level === "kecamatan") return mapKotaName.value || "Kabupaten/Kota";
  return "Jawa Barat";
});

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
    totalUmkm: item.total,
    percentage: item.percentage,
    mikro: item.mikro,
    kecil: item.kecil,
    menengah: item.menengah,
  })),
);

function openKbliSector(item: KbliCategoryItem) {
  openAnalytics("sektor_kbli", item.code);
}

/** Drill-down dari kode KBLI spesifik ke halaman analitik. */
function openKbliCode(code: KbliCodeItem) {
  openAnalytics("kbli_kode", code.code);
}

/**
 * Kode KBLI dikelompokkan per huruf sektor untuk drill-down.
 * API sudah mengirim seluruh kode (bukan hanya lima teratas) pada field `kbli`.
 */
const kbliCodesBySector = computed<Record<string, KbliCodeItem[]>>(() => {
  const grouped: Record<string, KbliCodeItem[]> = {};
  for (const item of infografis.value?.kbli ?? []) {
    const sector = sectorForKbli(item.code);
    if (!sector) continue;
    (grouped[sector] ??= []).push({
      code: item.code,
      title: item.description ?? item.name,
      totalUmkm: item.total,
      mikro: item.mikro,
      kecil: item.kecil,
      menengah: item.menengah,
    });
  }
  // API sudah mengurutkan berdasarkan total desc; pertahankan urutan itu.
  return grouped;
});
</script>

<template>
  <div class="space-y-5 pb-8">
    <!-- Section 1: Ringkasan Infografis (skala, NIB, metode pemasaran) -->
    <DashboardCardOverview
      :items="scaleItems"
      :nib="nibData"
      :marketing-methods="marketingMethods ?? []"
      :sectors="infografis?.sectors ?? []"
      :regions="infografis?.regions ?? []"
      :kbli="infografis?.topKbli ?? []"
      :sector-coverage="infografis?.sectorCoverage"
      :workforce="infografis?.workforce"
      @drill:sektor="openAnalytics('sektor_kbli', $event)"
      @drill:kota="openAnalytics('kota_id', $event)"
      @drill:kbli="openAnalytics('kbli_kode', $event)"
    />

    <p
      v-if="error || mapError"
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

    <!-- Section 2: Peta Sebaran Usaha Berdasarkan Wilayah -->
    <DashboardCardSection
      v-bind="DASHBOARD_SECTIONS.regionalMap"
      card-class="relative gap-0! overflow-hidden p-0!"
      header-class="hidden"
    >
      <DashboardMapInfographic
        :title="DASHBOARD_SECTIONS.regionalMap.title"
        :tooltip="DASHBOARD_SECTIONS.regionalMap.tooltip"
        :selection="mapSelectionLabel"
        :regions="mapInfografis?.regions"
        :region-level="mapInfografis?.regionLevel"
        :geometry-ready="mapInfografis?.geometryReady"
        :geometry-missing="mapInfografis?.geometryMissing"
        :geometry-source="mapInfografis?.geometrySource"
        :can-go-back="canMapGoBack"
        :points="mapPointItems"
        :show-regions="showRegions"
        :show-points="showPoints"
        @update:show-regions="showRegions = $event"
        @update:show-points="showPoints = $event"
        @select="openRegion"
        @back="mapBack"
      />
    </DashboardCardSection>

    <!-- Section 3: Rincian UMKM Berdasarkan Kategori KBLI -->
    <DashboardCardSection v-bind="DASHBOARD_SECTIONS.kbliAccordion">
      <DashboardAccordionListKBLI
        :items="kbliItems"
        :codes-by-sector="kbliCodesBySector"
        @view:data="openKbliSector"
        @drill:kode="openKbliCode"
      />
    </DashboardCardSection>

    <!-- Section 4: Gender Distribution -->
    <DashboardCardSection
      v-if="workforceEnabled"
      v-bind="DASHBOARD_SECTIONS.gender"
      card-class="flex flex-col justify-between h-full"
    >
      <DashboardChartGenderDistribution :data="genderData" />
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
          <label for="infografis-kabupaten" class="text-xs font-semibold"
            >Kabupaten/Kota</label
          >
          <UiSelect v-model="filters.kabupatenKota">
            <UiSelectTrigger id="infografis-kabupaten" size="sm" class="w-full">
              <UiSelectValue placeholder="Semua Kabupaten/Kota" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem
                v-for="option in kabupatenOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>

        <div class="space-y-1.5">
          <label for="infografis-kecamatan" class="text-xs font-semibold"
            >Kecamatan</label
          >
          <UiSelect v-model="filters.kecamatan">
            <UiSelectTrigger id="infografis-kecamatan" size="sm" class="w-full">
              <UiSelectValue placeholder="Semua Kecamatan" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem
                v-for="option in kecamatanOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>

        <div class="space-y-1.5">
          <label for="infografis-kelurahan" class="text-xs font-semibold"
            >Desa/Kelurahan</label
          >
          <UiSelect v-model="filters.desaKelurahan">
            <UiSelectTrigger id="infografis-kelurahan" size="sm" class="w-full">
              <UiSelectValue placeholder="Semua Desa/Kelurahan" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem
                v-for="option in desaKelurahanOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>

        <div class="space-y-1.5">
          <label for="infografis-skala" class="text-xs font-semibold"
            >Skala Usaha</label
          >
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
          <label for="infografis-kegiatan" class="text-xs font-semibold"
            >Kegiatan Usaha</label
          >
          <UiSelect v-model="filters.kegiatanUsaha">
            <UiSelectTrigger id="infografis-kegiatan" size="sm" class="w-full">
              <UiSelectValue placeholder="Semua Kegiatan Usaha" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem
                v-for="option in kegiatanOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>

        <div class="space-y-1.5">
          <label for="infografis-kbli" class="text-xs font-semibold"
            >Kode KBLI</label
          >
          <UiSelect v-model="filters.kodeKbli">
            <UiSelectTrigger id="infografis-kbli" size="sm" class="w-full">
              <UiSelectValue placeholder="Semua Kode KBLI" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem
                v-for="option in kbliOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>
      </div>
    </DashboardFilterFab>
  </div>
</template>
