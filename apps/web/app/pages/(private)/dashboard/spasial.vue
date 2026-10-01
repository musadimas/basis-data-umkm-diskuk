<!--
  Halaman Peta Spasial UMKM (`/dashboard/spasial`).
  Workspace eksplorasi lokasi usaha full screen: koropleth jumlah UMKM per
  wilayah dengan drill-down (kabupaten/kota → kecamatan → desa/kelurahan) dari
  `/v1/analytics/infographic/map`, layer titik usaha berkoordinat (clustered) dari
  `/v1/analytics/tabular/spasial`, dan filter tabular bersama.
-->
<script setup lang="ts">
import type {
  SkalaUsaha,
  SpasialUmkmItem,
} from "~/types/dashboard";
import type { InfografisData } from "~/types/infografis";
import type { TabularSpasialResponse, TabularSpatialTileset } from "~/types/tabular";
import { DASHBOARD_SECTIONS, REGION_ANALYTICS_FIELD } from "~/constants/DASHBOARD";
import { defaultAnalysis, serializeAnalysisUrl } from "~/lib/analytics-query";
import { formatAnalyticsNumber } from "~/lib/analytics-format";
import { endpoint } from "~/lib/directus";
import {
  TABULAR_SKALA_TO_API,
  tabularFilterQuery,
  useTabularFilters,
} from "~/composables/useTabularFilters";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Peta Spasial UMKM – Dashboard Basis Data UMKM DisKUK Jawa Barat",
  description:
    "Peta spasial sebaran titik UMKM Jawa Barat dengan koropleth wilayah, drill-down kabupaten/kota hingga desa/kelurahan, dan filter skala usaha, kegiatan usaha, serta kode KBLI.",
});

const router = useRouter();
function openAnalytics(fieldId: string, value: string) {
  const config = { ...defaultAnalysis, groupBy: fieldId, filters: [{ fieldId, operator: "eq" as const, value }] };
  router.push(`/dashboard/analitik?${serializeAnalysisUrl(config)}`);
}

const {
  filters,
  appliedFilters,
  filterOpen,
  lockedKota,
  optionsError,
  kabupatenOptions,
  kecamatanOptions,
  desaKelurahanOptions,
  kegiatanOptions,
  kbliOptions,
  activeFilterCount,
  applyFilters,
  resetFilters,
} = useTabularFilters();

// ── Drill-down wilayah untuk koropleth ─────────────────────────────────────
type InfografisMapData = Pick<InfografisData,
  "regions" | "regionLevel" | "geometryReady" | "geometryMissing" | "geometrySource">;
const mapKota = ref("semua");
const mapKecamatan = ref("semua");
const mapKelurahan = ref("semua");

// Drill-down mengikuti filter wilayah global saat filter baru diterapkan.
watch(
  () => [appliedFilters.kabupatenKota, appliedFilters.kecamatan, appliedFilters.desaKelurahan] as const,
  ([kota, kecamatan, kelurahan]) => {
    mapKota.value = kota;
    mapKecamatan.value = kecamatan;
    mapKelurahan.value = kelurahan;
  },
  { immediate: true },
);

const mapQuery = computed(() => ({
  ...tabularFilterQuery(appliedFilters),
  kota: mapKota.value !== "semua" ? mapKota.value : undefined,
  kecamatan: mapKecamatan.value !== "semua" ? mapKecamatan.value : undefined,
  kelurahan: mapKelurahan.value !== "semua" ? mapKelurahan.value : undefined,
}));
const directus = useDirectus();
const { data: mapData, error: mapError, status: mapStatus } = await useAsyncData(
  "spasial:map",
  () => directus.request(endpoint<InfografisMapData>("/v1/analytics/infographic/map", { query: { ...mapQuery.value } })),
  { watch: [mapQuery] },
);

// ── Titik UMKM (layer utama halaman spasial, aktif sejak awal) ─────────────
const showRegions = ref(true);
const showPoints = ref(true);
const pointLimit = ref("1000");

const apiToSkala = {
  micro: "mikro",
  small: "kecil",
  medium: "menengah",
} satisfies Record<string, SkalaUsaha>;

// Titik mengikuti level drill-down peta + filter global (skala, kegiatan, KBLI).
const pointsQuery = computed(() => ({
  kota: mapKota.value !== "semua" ? mapKota.value : undefined,
  kecamatan: mapKecamatan.value !== "semua" ? mapKecamatan.value : undefined,
  kelurahan: mapKelurahan.value !== "semua" ? mapKelurahan.value : undefined,
  skala: appliedFilters.skala !== "semua" ? TABULAR_SKALA_TO_API.get(appliedFilters.skala) : undefined,
  kegiatan: appliedFilters.kegiatanUsaha !== "semua" ? appliedFilters.kegiatanUsaha : undefined,
  kbli: appliedFilters.kodeKbli !== "semua" ? appliedFilters.kodeKbli : undefined,
  limit: Number(pointLimit.value),
}));

// ── Tileset PMTiles (mode titik tanpa batas saat tidak ada filter aktif) ────
const { data: tilesetResponse } = await useAsyncData(
  "spasial:tileset",
  () => directus.request(endpoint<TabularSpatialTileset | null>("/v1/analytics/tabular/spasial/tileset")),
  { default: () => null },
);
const tileset = computed<TabularSpatialTileset | null>(() => tilesetResponse.value ?? null);
const tileReady = ref(false);
const tileFailed = ref(false);

// Klaster build-time tidak dapat difilter ulang dengan benar di sisi klien.
// Setiap filter aktif memakai endpoint GeoJSON agar titik, klaster, dan total
// selalu memiliki semantik yang sama.
const hasTileIncompatibleFilters = computed(() =>
  appliedFilters.skala !== "semua"
  || appliedFilters.kegiatanUsaha !== "semua"
  || appliedFilters.kodeKbli !== "semua"
  || mapKota.value !== "semua"
  || mapKecamatan.value !== "semua"
  || mapKelurahan.value !== "semua");
const tileMode = computed(() =>
  Boolean(tileset.value?.url)
  && !tileFailed.value
  && !hasTileIncompatibleFilters.value);

watch(() => tileset.value?.url, () => {
  tileReady.value = false;
  tileFailed.value = false;
});
watch(tileMode, () => {
  tileReady.value = false;
});

// Fetch titik GeoJSON dilewati pada mode tileset (semua titik datang dari arsip
// PMTiles); kembali aktif saat filter apa pun diterapkan.
const {
  data: pointsData,
  error: pointsError,
  status: pointsStatus,
  refresh: fetchPoints,
} = await useAsyncData<TabularSpasialResponse | null>(
  "spasial-points",
  () => tileMode.value
    ? Promise.resolve(null)
    : directus.request(endpoint<TabularSpasialResponse>("/v1/analytics/tabular/spasial", { query: { ...pointsQuery.value } })),
);

watch([pointsQuery, tileMode], () => {
  if (tileMode.value) {
    pointsData.value = null;
    pointsError.value = undefined;
    return;
  }
  fetchPoints();
});

const mapPointItems = computed<SpasialUmkmItem[]>(() =>
  (pointsData.value?.points ?? []).map((point) => ({
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

const pointSummary = computed(() => {
  if (tileMode.value) {
    const total = tileset.value?.pointCount ?? 0;
    if (!tileReady.value) {
      return `Memuat ${formatAnalyticsNumber(total)} titik berkoordinat dari tileset…`;
    }
    return `Menampilkan semua ${formatAnalyticsNumber(total)} titik berkoordinat (tileset).`;
  }
  const meta = pointsData.value?.meta;
  if (!meta) return "";
  const plotted = pointsData.value?.points.length ?? 0;
  return `Menampilkan ${formatAnalyticsNumber(plotted)} titik dari ${formatAnalyticsNumber(meta.filterCount)} UMKM pada filter aktif.`;
});

function markTilesReady() {
  if (tileMode.value) tileReady.value = true;
}

function fallbackFromTiles() {
  if (!tileMode.value) return;
  tileReady.value = false;
  tileFailed.value = true;
}

// ── Interaksi peta ──────────────────────────────────────────────────────────
const mapInfografis = computed(() => mapData.value ?? undefined);
const canMapGoBack = computed(() =>
  mapKota.value !== appliedFilters.kabupatenKota
  || mapKecamatan.value !== appliedFilters.kecamatan
  || mapKelurahan.value !== appliedFilters.desaKelurahan);

const mapKotaName = computed(() =>
  mapKota.value === "semua"
    ? ""
    : kabupatenOptions.value.find((option) => option.value === mapKota.value)?.label ?? "");
const mapKecamatanName = computed(() =>
  mapKecamatan.value === "semua"
    ? ""
    : kecamatanOptions.value.find((option) => option.value === mapKecamatan.value)?.label ?? "");

function openRegion(region: { id: string; name?: string }) {
  const level = mapInfografis.value?.regionLevel ?? "kota";
  // Level terdalam tidak punya rincian; kartu wilayah hanya menawarkan Analitik.
  if (level === "kelurahan") return;
  if (level === "kota") {
    mapKota.value = region.id;
    mapKecamatan.value = "semua";
  } else {
    mapKecamatan.value = region.id;
  }
  mapKelurahan.value = "semua";
}

/** Tombol "Buka di Analitik" pada kartu wilayah (BUG-005). */
function analyzeRegion(region: { id: string }) {
  openAnalytics(REGION_ANALYTICS_FIELD[mapInfografis.value?.regionLevel ?? "kota"], region.id);
}

function mapBack() {
  if (mapKelurahan.value !== appliedFilters.desaKelurahan) {
    mapKelurahan.value = appliedFilters.desaKelurahan;
  } else if (mapKecamatan.value !== appliedFilters.kecamatan) {
    mapKecamatan.value = appliedFilters.kecamatan;
    mapKelurahan.value = appliedFilters.desaKelurahan;
  } else if (mapKota.value !== appliedFilters.kabupatenKota) {
    mapKota.value = appliedFilters.kabupatenKota;
    mapKecamatan.value = appliedFilters.kecamatan;
    mapKelurahan.value = appliedFilters.desaKelurahan;
  }
}

/** Teks crumb kedua pada breadcrumb peta: wilayah yang sedang dipilih. */
const mapSelectionLabel = computed(() => {
  const level = mapInfografis.value?.regionLevel ?? "kota";
  if (level === "kelurahan") return mapKecamatanName.value || "Kecamatan";
  if (level === "kecamatan") return mapKotaName.value || "Kabupaten/Kota";
  return "Jawa Barat";
});
</script>

<template>
  <!-- Viewport height minus the dashboard top bar (h-14). -->
  <div class="flex h-[calc(100dvh-3.5rem)] flex-col gap-3">
    <p
      v-if="mapError || pointsError"
      class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      Data spasial belum dapat dimuat. Silakan coba lagi.
    </p>
    <p
      v-if="optionsError"
      class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      Opsi filter belum dapat dimuat. Silakan coba lagi.
    </p>

    <!-- Peta utama full screen: koropleth + titik UMKM, kontrol melayang di atasnya -->
    <DashboardCardSection
      v-bind="DASHBOARD_SECTIONS.spatialMap"
      card-class="relative min-h-0 flex-1 gap-0! overflow-hidden rounded-none border-0 p-0! shadow-none"
      header-class="hidden"
      content-class="min-h-0 flex-1"
    >
      <!-- Toolbar melayang: ringkasan titik + kontrol batas titik -->
      <div class="absolute inset-x-0 top-0 z-[7] flex flex-col gap-2 border-b border-slate-200/70 bg-white/85 px-4 py-2 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs font-medium text-slate-700" aria-live="polite">
          {{ pointSummary }}
        </p>
        <div v-if="!tileMode" class="flex items-center gap-2">
          <label for="spasial-limit" class="text-xs font-semibold">Batas Titik</label>
          <UiSelect v-model="pointLimit">
            <UiSelectTrigger id="spasial-limit" size="sm" class="w-32">
              <UiSelectValue placeholder="Batas titik" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem value="1000">1.000 titik</UiSelectItem>
              <UiSelectItem value="2500">2.500 titik</UiSelectItem>
              <UiSelectItem value="5000">5.000 titik</UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>
      </div>

      <DashboardMapInfographic
        :key="tileMode ? `tile-points:${tileset?.url}` : 'geojson-points'"
        :title="DASHBOARD_SECTIONS.spatialMap.title"
        :tooltip="DASHBOARD_SECTIONS.spatialMap.tooltip"
        :selection="mapSelectionLabel"
        :regions="mapInfografis?.regions"
        :region-level="mapInfografis?.regionLevel"
        :geometry-ready="mapInfografis?.geometryReady"
        :geometry-missing="mapInfografis?.geometryMissing"
        :geometry-source="mapInfografis?.geometrySource"
        :can-go-back="canMapGoBack"
        :points="mapPointItems"
        :points-mode="tileMode ? 'tiles' : 'geojson'"
        :tileset-url="tileset?.url ?? ''"
        :tile-point-count="tileset?.pointCount ?? 0"
        :show-regions="showRegions"
        :show-points="showPoints"
        wrapper-class="h-full"
        height-class="h-full"
        breadcrumb-class="left-3 top-24 sm:top-16"
        controls-class="right-3 top-24 sm:top-16"
        zoom-class="bottom-20 right-4 sm:right-6"
        hide-geometry-notice
        @update:show-regions="showRegions = $event"
        @update:show-points="showPoints = $event"
        @tiles-ready="markTilesReady"
        @tiles-error="fallbackFromTiles"
        @select="openRegion"
        @analyze="analyzeRegion"
        @back="mapBack"
      />
    </DashboardCardSection>

    <!-- Filter global (wilayah, skala, kegiatan usaha, KBLI) -->
    <DashboardFilterFab
      v-model:open="filterOpen"
      title="Filter Peta Spasial UMKM"
      :active-count="activeFilterCount"
      :pending="mapStatus === 'pending' || pointsStatus === 'pending'"
      @apply="applyFilters"
      @reset="resetFilters"
    >
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div class="space-y-1.5">
          <label for="spasial-kabupaten" class="text-xs font-semibold">Kabupaten/Kota</label>
          <UiSelect v-model="filters.kabupatenKota" :disabled="Boolean(lockedKota)">
            <UiSelectTrigger id="spasial-kabupaten" size="sm" class="w-full">
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
          <label for="spasial-kecamatan" class="text-xs font-semibold">Kecamatan</label>
          <UiSelect v-model="filters.kecamatan">
            <UiSelectTrigger id="spasial-kecamatan" size="sm" class="w-full">
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
          <label for="spasial-kelurahan" class="text-xs font-semibold">Desa/Kelurahan</label>
          <UiSelect v-model="filters.desaKelurahan">
            <UiSelectTrigger id="spasial-kelurahan" size="sm" class="w-full">
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
          <label for="spasial-skala" class="text-xs font-semibold">Skala Usaha</label>
          <UiSelect v-model="filters.skala">
            <UiSelectTrigger id="spasial-skala" size="sm" class="w-full">
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
          <label for="spasial-kegiatan" class="text-xs font-semibold">Kegiatan Usaha</label>
          <UiSelect v-model="filters.kegiatanUsaha">
            <UiSelectTrigger id="spasial-kegiatan" size="sm" class="w-full">
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
          <label for="spasial-kbli" class="text-xs font-semibold">Kode KBLI</label>
          <UiSelect v-model="filters.kodeKbli">
            <UiSelectTrigger id="spasial-kbli" size="sm" class="w-full">
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
