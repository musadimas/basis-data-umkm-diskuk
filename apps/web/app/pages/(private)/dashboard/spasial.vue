/*
 * Halaman Peta Spasial UMKM.
 * Menampilkan sebaran titik lokasi usaha pada peta interaktif (MapLibre + OSM)
 * dengan filter wilayah, skala usaha, kegiatan usaha, dan kode KBLI.
 */
<script setup lang="ts">
import { Filter, MapPinned, RotateCcw } from "@lucide/vue";

import type { SpasialUmkmItem } from "~/types/dashboard";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Peta Spasial UMKM – Dashboard Basis Data UMKM DisKUK Jawa Barat",
  description:
    "Peta interaktif sebaran UMKM Provinsi Jawa Barat dengan filter wilayah, skala usaha, kegiatan usaha, dan kode KBLI.",
});

// ── Sample dataset (mock; to be replaced with Directus API data) ──────────
// Titik koordinat merupakan perkiraan lokasi kecamatan untuk keperluan tampilan.
const umkmPoints: SpasialUmkmItem[] = [
  { id: "1", namaUsaha: "Wawan Leathercraft", skala: "menengah", kabupatenKota: "Kabupaten Subang", kecamatan: "Kasomalang", produkUtama: "Sepatu Kulit", kegiatanUsaha: "Industri Pengolahan", kodeKbli: "14132", latitude: -6.658, longitude: 107.772 },
  { id: "2", namaUsaha: "Kasih Salon", skala: "mikro", kabupatenKota: "Kota Bandung", kecamatan: "Antapani", produkUtama: "Salon Wanita", kegiatanUsaha: "Aktivitas Jasa Lainnya", kodeKbli: "96", latitude: -6.913, longitude: 107.657 },
  { id: "3", namaUsaha: "Kebab Turki Azizah", skala: "mikro", kabupatenKota: "Kota Bandung", kecamatan: "Cicendo", produkUtama: "Makanan Cepat Saji", kegiatanUsaha: "Penyediaan Akomodasi dan Penyediaan Makan dan Minum", kodeKbli: "10", latitude: -6.911, longitude: 107.596 },
  { id: "4", namaUsaha: "Bruce Lee Photo", skala: "kecil", kabupatenKota: "Kabupaten Bekasi", kecamatan: "Cibitung", produkUtama: "Percetakan dan Studio Foto", kegiatanUsaha: "Aktivitas Jasa Lainnya", kodeKbli: "7420", latitude: -6.24, longitude: 107.103 },
  { id: "5", namaUsaha: "Kaisar Boba", skala: "mikro", kabupatenKota: "Kabupaten Subang", kecamatan: "Cisalak", produkUtama: "Minuman Dingin", kegiatanUsaha: "Penyediaan Akomodasi dan Penyediaan Makan dan Minum", kodeKbli: "11", latitude: -6.714, longitude: 107.755 },
  { id: "6", namaUsaha: "Kancil Motorworks", skala: "menengah", kabupatenKota: "Kabupaten Bandung", kecamatan: "Soreang", produkUtama: "Suku Cadang Motor Balap", kegiatanUsaha: "Reparasi dan Perawatan Mobil dan Sepeda Motor", kodeKbli: "47833", latitude: -7.032, longitude: 107.518 },
  { id: "7", namaUsaha: "Kircon Fried Chicken", skala: "mikro", kabupatenKota: "Kota Bandung", kecamatan: "Kiaracondong", produkUtama: "Makanan Cepat Saji", kegiatanUsaha: "Penyediaan Akomodasi dan Penyediaan Makan dan Minum", kodeKbli: "10", latitude: -6.93, longitude: 107.639 },
  { id: "8", namaUsaha: "Susu Kambing H. Ojang", skala: "menengah", kabupatenKota: "Kabupaten Kuningan", kecamatan: "Kuningan", produkUtama: "Susu Kambing dan Olahannya", kegiatanUsaha: "Penyediaan Akomodasi dan Penyediaan Makan dan Minum", kodeKbli: "47214", latitude: -6.976, longitude: 108.483 },
  { id: "9", namaUsaha: "Sulis Boutique", skala: "kecil", kabupatenKota: "Kabupaten Subang", kecamatan: "Subang", produkUtama: "Pakaian Import", kegiatanUsaha: "Industri Pengolahan", kodeKbli: "47711", latitude: -6.566, longitude: 107.756 },
  { id: "10", namaUsaha: "Uye Vape", skala: "kecil", kabupatenKota: "Kabupaten Bandung", kecamatan: "Cimenyan", produkUtama: "Liquid Vape", kegiatanUsaha: "Penyediaan Akomodasi dan Penyediaan Makan dan Minum", kodeKbli: "20291", latitude: -6.888, longitude: 107.656 },
  { id: "11", namaUsaha: "Dapur Nusantara Bu Tuti", skala: "mikro", kabupatenKota: "Kota Cimahi", kecamatan: "Cimahi Tengah", produkUtama: "Kue Tradisional", kegiatanUsaha: "Industri Pengolahan", kodeKbli: "10710", latitude: -6.879, longitude: 107.542 },
  { id: "12", namaUsaha: "Bengkel Jaya Motor", skala: "kecil", kabupatenKota: "Kota Bekasi", kecamatan: "Bekasi Timur", produkUtama: "Perawatan Kendaraan", kegiatanUsaha: "Reparasi dan Perawatan Mobil dan Sepeda Motor", kodeKbli: "45205", latitude: -6.247, longitude: 106.997 },
];

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

const skalaOptions = [
  { value: "semua", label: "Semua" },
  { value: "mikro", label: "Mikro" },
  { value: "kecil", label: "Kecil" },
  { value: "menengah", label: "Menengah" },
];

type FilterableKey = "kabupatenKota" | "kecamatan" | "kegiatanUsaha" | "kodeKbli";
const uniqueValues = (key: FilterableKey) =>
  [...new Set(umkmPoints.map((r) => r[key]))].sort();

const kabupatenOptions = ["semua", ...uniqueValues("kabupatenKota")].map((v) => ({
  value: v,
  label: v === "semua" ? "Semua Kabupaten/Kota" : v,
}));
const kecamatanOptions = ["semua", ...uniqueValues("kecamatan")].map((v) => ({
  value: v,
  label: v === "semua" ? "Semua Kecamatan" : v,
}));
const kegiatanOptions = ["semua", ...uniqueValues("kegiatanUsaha")].map((v) => ({
  value: v,
  label: v === "semua" ? "Semua" : v,
}));
const kbliOptions = ["semua", ...uniqueValues("kodeKbli")].map((v) => ({
  value: v,
  label: v === "semua" ? "Semua" : v,
}));

const applyFilters = () => {
  Object.assign(appliedFilters, filters);
};

const resetFilters = () => {
  Object.assign(filters, defaultFilters());
  applyFilters();
};

// ── Filtered map points ───────────────────────────────────────────────────
const filteredPoints = computed(() =>
  umkmPoints.filter(
    (p) =>
      (appliedFilters.kabupatenKota === "semua" || p.kabupatenKota === appliedFilters.kabupatenKota) &&
      (appliedFilters.kecamatan === "semua" || p.kecamatan === appliedFilters.kecamatan) &&
      (appliedFilters.skala === "semua" || p.skala === appliedFilters.skala) &&
      (appliedFilters.kegiatanUsaha === "semua" || p.kegiatanUsaha === appliedFilters.kegiatanUsaha) &&
      (appliedFilters.kodeKbli === "semua" || p.kodeKbli === appliedFilters.kodeKbli)
  )
);

const kabupatenCount = computed(
  () => new Set(filteredPoints.value.map((p) => p.kabupatenKota)).size
);
</script>

<template>
  <div class="space-y-5 pb-8">
    <!-- Top Hero Banner -->
    <DashboardCardBanner
      :icon="MapPinned"
      title="Peta Spasial UMKM"
      description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent dictum tortor eu dictum pulvinar. Fusce pulvinar enim ac dui luctus, ac tempus nisl vestibulum. Sed sit amet ante sit amet sapien dictum ultrices quis at augue. Nulla pharetra ex dictum, venenatis nunc a, tempor lectus."
    />

    <!-- Section 1: Jumlah Usaha Berdasarkan Skala Usaha -->
    <DashboardCardSection
      title="Jumlah Usaha Berdasarkan Skala Usaha"
      description="Berdasarkan kriteria penjualan tahunan sebagaimana dimaksud dalam Pasal 35 ayat (5) Peraturan Pemerintah Nomor 7 Tahun 2021 tentang Kemudahan, Pelindungan, dan Pemberdayaan Koperasi serta UMKM."
      tooltip="Klasifikasi skala usaha berdasarkan kriteria omzet & aset sesuai PP No. 7 Tahun 2021"
    >
      <DashboardCardScaleStatsGrid />
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
                <UiSelectItem v-for="opt in skalaOptions" :key="opt.value" :value="opt.value">
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
            class="gap-1.5 rounded-lg border-[#069550] text-sm font-bold text-[#069550] hover:bg-emerald-50"
            @click="resetFilters"
          >
            <RotateCcw class="h-4 w-4" />
            <span>Reset Filter</span>
          </UiButton>
          <UiButton
            class="gap-1.5 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700"
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
          Menampilkan {{ filteredPoints.length }} dari {{ umkmPoints.length }} data UMKM
          <template v-if="filteredPoints.length">
            &middot; tersebar di {{ kabupatenCount }} kabupaten/kota
          </template>
        </p>
        <DashboardSpasialUmkmMap :items="filteredPoints" />
      </div>
    </section>
  </div>
</template>
