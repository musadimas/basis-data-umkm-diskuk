/*
 * Halaman Peta Spasial UMKM.
 * Menampilkan sebaran titik lokasi usaha pada peta interaktif (MapLibre + OSM)
 * dengan filter wilayah, skala usaha, kegiatan usaha, dan kode KBLI.
 * Data titik & rekap skala dibaca dari endpoint /panel/tabular/spasial
 * (snapshot publik usaha_tabular yang berisi koordinat sumber SIDT).
 */
<script setup lang="ts">
import { Filter, MapPinned, RotateCcw } from "@lucide/vue";

import type { ScaleStatItem, SkalaUsaha, SpasialUmkmItem } from "~/types/dashboard";
import type {
  TabularKbliOption,
  TabularOptions,
  TabularSpasialResponse,
} from "~/types/tabular";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Peta Spasial UMKM – Dashboard Basis Data UMKM DisKUK Jawa Barat",
  description:
    "Peta interaktif sebaran UMKM Provinsi Jawa Barat dengan filter wilayah, skala usaha, kegiatan usaha, dan kode KBLI.",
});

// ── Skala: nilai API (micro/small/medium) ⇄ nilai UI (mikro/kecil/menengah) ─
const skalaToApi: Record<SkalaUsaha, "micro" | "small" | "medium"> = {
  mikro: "micro",
  kecil: "small",
  menengah: "medium",
};
const apiToSkala: Record<string, SkalaUsaha> = {
  micro: "mikro",
  small: "kecil",
  medium: "menengah",
};

// ── Filter state (draft vs. applied on "Filter Data") ─────────────────────
interface SpasialFilters {
  kabupatenKota: string;
  kecamatan: string;
  skala: string;
  kegiatanUsaha: string;
  kodeKbli: string;
}

const defaultFilters = (): SpasialFilters => ({
  kabupatenKota: "semua",
  kecamatan: "semua",
  skala: "semua",
  kegiatanUsaha: "semua",
  kodeKbli: "semua",
});

const filters = reactive<SpasialFilters>(defaultFilters());
const appliedFilters = reactive<SpasialFilters>(defaultFilters());

// ── Data opsi filter (dari Directus, dimuat sekali) ───────────────────────
const { data: optionsData, error: optionsError } = useFetch<{ data: TabularOptions }>(
  "/panel/tabular/options",
);

const kabupatenOptions = computed(() => [
  { value: "semua", label: "Semua Kabupaten/Kota" },
  ...(optionsData.value?.data?.kota ?? []).map((k) => ({ value: String(k.id), label: k.nama })),
]);

const kecamatanOptions = computed(() => {
  const list = optionsData.value?.data?.kecamatan ?? [];
  const kotaId = Number(filters.kabupatenKota);
  const scoped = Number.isInteger(kotaId) && kotaId > 0 ? list.filter((k) => k.kotaId === kotaId) : list;
  return [
    { value: "semua", label: "Semua Kecamatan" },
    ...scoped.map((k) => ({ value: String(k.id), label: k.nama })),
  ];
});

const kegiatanOptions = computed(() => [
  { value: "semua", label: "Semua" },
  ...(optionsData.value?.data?.kategori ?? []).map((k) => ({ value: k, label: k })),
]);

const kbliOptions = computed(() => {
  const list: TabularKbliOption[] = optionsData.value?.data?.kbli ?? [];
  const scoped = filters.kegiatanUsaha === "semua" ? list : list.filter((k) => k.kategori === filters.kegiatanUsaha);
  return [
    { value: "semua", label: "Semua" },
    ...scoped.map((k) => ({ value: k.kode, label: k.kode })),
  ];
});

watch(
  () => filters.kabupatenKota,
  () => {
    filters.kecamatan = "semua";
  },
);

watch(
  () => filters.kegiatanUsaha,
  (v) => {
    if (v === "semua" || filters.kodeKbli === "semua") return;
    const list = optionsData.value?.data?.kbli ?? [];
    if (!list.some((k) => k.kategori === v && k.kode === filters.kodeKbli)) {
      filters.kodeKbli = "semua";
    }
  },
);

// ── Fetch titik + rekap skala (refetch saat filter diterapkan) ────────────
const POINT_LIMIT = 1000;

const pointsQuery = computed(() => ({
  kota: appliedFilters.kabupatenKota !== "semua" ? appliedFilters.kabupatenKota : undefined,
  kecamatan: appliedFilters.kecamatan !== "semua" ? appliedFilters.kecamatan : undefined,
  skala: appliedFilters.skala !== "semua" ? skalaToApi[appliedFilters.skala as SkalaUsaha] : undefined,
  kegiatan: appliedFilters.kegiatanUsaha !== "semua" ? appliedFilters.kegiatanUsaha : undefined,
  kbli: appliedFilters.kodeKbli !== "semua" ? appliedFilters.kodeKbli : undefined,
  limit: POINT_LIMIT,
}));

const { data: pointsData, pending: pointsPending, error: pointsError } = await useFetch<TabularSpasialResponse>(
  "/panel/tabular/spasial",
  { query: pointsQuery },
);

const mapItems = computed<SpasialUmkmItem[]>(() =>
  (pointsData.value?.data ?? []).map((p) => ({
    id: p.id,
    namaUsaha: p.nama,
    skala: apiToSkala[p.skala] ?? "mikro",
    kabupatenKota: p.kota,
    kecamatan: p.kecamatan,
    produkUtama: p.produkUtama ?? "–",
    kegiatanUsaha: p.kategoriKbli ?? "–",
    kodeKbli: p.kodeKbli ?? "–",
    latitude: p.latitude,
    longitude: p.longitude,
  })),
);

const scaleItems = computed<ScaleStatItem[]>(() => {
  const meta = pointsData.value?.meta;
  return [
    {
      id: "total",
      title: "Total UMKM",
      value: meta?.filterCount ?? 0,
      category: "total",
      buttonText: "Lihat Data",
      buttonHref: "/dashboard/tabular",
    },
    { id: "mikro", title: "Usaha Mikro", value: meta?.mikro ?? 0, category: "mikro" },
    { id: "kecil", title: "Usaha Kecil", value: meta?.kecil ?? 0, category: "kecil" },
    { id: "menengah", title: "Usaha Menengah", value: meta?.menengah ?? 0, category: "menengah" },
  ];
});

const formatNumber = (val: number) => new Intl.NumberFormat("id-ID").format(val);

const kabupatenCount = computed(
  () => new Set(mapItems.value.map((p) => p.kabupatenKota)).size,
);

const totalMatching = computed(() => pointsData.value?.meta?.filterCount ?? 0);

// ── Filter actions ────────────────────────────────────────────────────────
const applyFilters = () => {
  Object.assign(appliedFilters, filters);
};

const resetFilters = () => {
  Object.assign(filters, defaultFilters());
  applyFilters();
};
</script>

<template>
  <div class="space-y-5 pb-8">
    <!-- Top Hero Banner -->
    <DashboardCardBanner
      :icon="MapPinned"
      title="Peta Spasial UMKM"
      description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent dictum tortor eu dictum pulvinar. Fusce pulvinar enim ac dui luctus, ac tempus nisl vestibulum. Sed sit amet ante sit amet sapien dictum ultrices quis at augue. Nulla pharetra ex dictum, venenatis nunc a, tempor lectus."
    />

    <p
      v-if="optionsError"
      class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      Opsi filter (wilayah &amp; KBLI) belum dapat dimuat. Silakan muat ulang halaman.
    </p>
    <p
      v-if="pointsError"
      class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      Data spasial belum dapat dimuat. Silakan coba lagi.
    </p>

    <!-- Section 1: Jumlah Usaha Berdasarkan Skala Usaha -->
    <DashboardCardSection
      title="Jumlah Usaha Berdasarkan Skala Usaha"
      description="Berdasarkan kriteria penjualan tahunan sebagaimana dimaksud dalam Pasal 35 ayat (5) Peraturan Pemerintah Nomor 7 Tahun 2021 tentang Kemudahan, Pelindungan, dan Pemberdayaan Koperasi serta UMKM."
      tooltip="Klasifikasi skala usaha berdasarkan kriteria omzet & aset sesuai PP No. 7 Tahun 2021"
    >
      <DashboardCardScaleStatsGrid :items="scaleItems" />
    </DashboardCardSection>

    <!-- Section 2: Filter + Peta Interaktif -->
    <section
      class="rounded-lg border border-border/80 bg-white p-4 shadow-xs dark:bg-card"
      aria-label="Peta Sebaran UMKM"
    >
      <!-- Filter Panel -->
      <div class="space-y-3 rounded-lg border border-border/80 p-4">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <!-- Kabupaten/Kota -->
          <div class="space-y-1.5">
            <label for="spasial-kabupaten" class="block text-sm leading-4 text-[#323232]">
              Pilih Kabupaten/Kota
            </label>
            <UiSelect v-model="filters.kabupatenKota">
              <UiSelectTrigger
                id="spasial-kabupaten"
                class="h-[54px] w-full rounded-lg border-[#9e9e9e] bg-[#fdfdfd] text-sm text-[#757575]"
              >
                <UiSelectValue placeholder="Semua Kabupaten/Kota" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="opt in kabupatenOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <!-- Kecamatan -->
          <div class="space-y-1.5">
            <label for="spasial-kecamatan" class="block text-sm leading-4 text-[#323232]">
              Pilih Kecamatan
            </label>
            <UiSelect v-model="filters.kecamatan">
              <UiSelectTrigger
                id="spasial-kecamatan"
                class="h-[54px] w-full rounded-lg border-[#9e9e9e] bg-[#fdfdfd] text-sm text-[#757575]"
              >
                <UiSelectValue placeholder="Semua Kecamatan" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="opt in kecamatanOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <!-- Skala Usaha -->
          <div class="space-y-1.5">
            <label for="spasial-skala" class="block text-sm leading-4 text-[#323232]">
              Skala Usaha
            </label>
            <UiSelect v-model="filters.skala">
              <UiSelectTrigger
                id="spasial-skala"
                class="h-[54px] w-full rounded-lg border-[#9e9e9e] bg-[#fdfdfd] text-sm text-[#757575]"
              >
                <UiSelectValue placeholder="Semua" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem
                  v-for="opt in [
                    { value: 'semua', label: 'Semua' },
                    { value: 'mikro', label: 'Mikro' },
                    { value: 'kecil', label: 'Kecil' },
                    { value: 'menengah', label: 'Menengah' },
                  ]"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <!-- Kegiatan Usaha -->
          <div class="space-y-1.5">
            <label for="spasial-kegiatan" class="block text-sm leading-4 text-[#323232]">
              Kegiatan Usaha
            </label>
            <UiSelect v-model="filters.kegiatanUsaha">
              <UiSelectTrigger
                id="spasial-kegiatan"
                class="h-[54px] w-full rounded-lg border-[#9e9e9e] bg-[#fdfdfd] text-sm text-[#757575]"
              >
                <UiSelectValue placeholder="Semua" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="opt in kegiatanOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <!-- Kode KBLI -->
          <div class="space-y-1.5">
            <label for="spasial-kbli" class="block text-sm leading-4 text-[#323232]">
              Kode KBLI
            </label>
            <UiSelect v-model="filters.kodeKbli">
              <UiSelectTrigger
                id="spasial-kbli"
                class="h-[54px] w-full rounded-lg border-[#9e9e9e] bg-[#fdfdfd] text-sm text-[#757575]"
              >
                <UiSelectValue placeholder="Semua" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="opt in kbliOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>
        </div>

        <!-- Filter Actions -->
        <div class="flex flex-wrap items-center justify-end gap-2">
          <UiButton
            variant="outline"
            class="gap-1.5 rounded-lg border-brand-green text-sm font-bold text-brand-green-foreground hover:bg-brand-green/10"
            @click="resetFilters"
          >
            <RotateCcw class="h-4 w-4" />
            <span>Reset Filter</span>
          </UiButton>
          <UiButton
            class="gap-1.5 rounded-lg bg-brand-green text-sm font-bold text-brand-green-foreground hover:bg-brand-green/90"
            @click="applyFilters"
          >
            <Filter class="h-4 w-4" />
            <span>Filter Data</span>
          </UiButton>
        </div>
      </div>

      <!-- Map -->
      <div class="mt-4 space-y-2">
        <p class="text-xs leading-4 text-[#777574]">
          <template v-if="pointsPending && mapItems.length === 0">Memuat titik…</template>
          <template v-else>
            Menampilkan {{ formatNumber(mapItems.length) }} titik dari
            {{ formatNumber(totalMatching) }} usaha
            <template v-if="kabupatenCount"> &middot; tersebar di {{ kabupatenCount }} kabupaten/kota</template>
            <template v-if="mapItems.length >= POINT_LIMIT">
              &middot; maks. {{ formatNumber(POINT_LIMIT) }} titik ditampilkan
            </template>
          </template>
        </p>
        <DashboardSpasialUmkmMap :items="mapItems" />
      </div>
    </section>
  </div>
</template>
