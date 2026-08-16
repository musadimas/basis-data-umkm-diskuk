<script setup lang="ts">
import { Table, ChevronDown, MoreHorizontal, Filter, RotateCcw, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "@lucide/vue";

import type { SkalaUsaha, TabularUmkmItem } from "~/types/dashboard";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Data Tabular UMKM – Dashboard Basis Data UMKM DisKUK Jawa Barat",
  description:
    "Tabel data UMKM Provinsi Jawa Barat dengan filter wilayah, skala usaha, kegiatan usaha, dan kode KBLI.",
});

// ── Sample dataset (mock; to be replaced with Directus API data) ──────────
const rows: TabularUmkmItem[] = [
  { id: "1", namaUsaha: "Wawan Leathercraft", skala: "menengah", kabupatenKota: "Kabupaten Subang", kecamatan: "Kasomalang", produkUtama: "Sepatu Kulit", kegiatanUsaha: "Industri Pengolahan", kodeKbli: "14132" },
  { id: "2", namaUsaha: "Kasih Salon", skala: "mikro", kabupatenKota: "Kota Bandung", kecamatan: "Antapani", produkUtama: "Salon Wanita", kegiatanUsaha: "Aktivitas Jasa Lainnya", kodeKbli: "96" },
  { id: "3", namaUsaha: "Kebab Turki Azizah", skala: "mikro", kabupatenKota: "Kota Bandung", kecamatan: "Cicendo", produkUtama: "Makanan Cepat Saji", kegiatanUsaha: "Penyediaan Akomodasi dan Penyediaan Makan dan Minum", kodeKbli: "10" },
  { id: "4", namaUsaha: "Bruce Lee Photo", skala: "kecil", kabupatenKota: "Kabupaten Bekasi", kecamatan: "Cibitung", produkUtama: "Percetakan dan Studio Foto", kegiatanUsaha: "Aktivitas Jasa Lainnya", kodeKbli: "7420" },
  { id: "5", namaUsaha: "Kaisar Boba", skala: "mikro", kabupatenKota: "Kabupaten Subang", kecamatan: "Cisalak", produkUtama: "Minuman Dingin", kegiatanUsaha: "Penyediaan Akomodasi dan Penyediaan Makan dan Minum", kodeKbli: "11" },
  { id: "6", namaUsaha: "Kancil Motorworks", skala: "menengah", kabupatenKota: "Kabupaten Bandung", kecamatan: "Soreang", produkUtama: "Suku Cadang Motor Balap", kegiatanUsaha: "Reparasi dan Perawatan Mobil dan Sepeda Motor", kodeKbli: "47833" },
  { id: "7", namaUsaha: "Kircon Fried Chicken", skala: "mikro", kabupatenKota: "Kota Bandung", kecamatan: "Kiaracondong", produkUtama: "Makanan Cepat Saji", kegiatanUsaha: "Penyediaan Akomodasi dan Penyediaan Makan dan Minum", kodeKbli: "10" },
  { id: "8", namaUsaha: "Susu Kambing H. Ojang", skala: "menengah", kabupatenKota: "Kabupaten Kuningan", kecamatan: "Kuningan", produkUtama: "Susu Kambing dan Olahannya", kegiatanUsaha: "Penyediaan Akomodasi dan Penyediaan Makan dan Minum", kodeKbli: "47214" },
  { id: "9", namaUsaha: "Sulis Boutique", skala: "kecil", kabupatenKota: "Kabupaten Subang", kecamatan: "Subang", produkUtama: "Pakaian Import", kegiatanUsaha: "Industri Pengolahan", kodeKbli: "47711" },
  { id: "10", namaUsaha: "Uye Vape", skala: "kecil", kabupatenKota: "Kabupaten Bandung", kecamatan: "Cimenyan", produkUtama: "Liquid Vape", kegiatanUsaha: "Penyediaan Akomodasi dan Penyediaan Makan dan Minum", kodeKbli: "20291" },
  { id: "11", namaUsaha: "Dapur Nusantara Bu Tuti", skala: "mikro", kabupatenKota: "Kota Cimahi", kecamatan: "Cimahi Tengah", produkUtama: "Kue Tradisional", kegiatanUsaha: "Industri Pengolahan", kodeKbli: "10710" },
  { id: "12", namaUsaha: "Bengkel Jaya Motor", skala: "kecil", kabupatenKota: "Kota Bekasi", kecamatan: "Bekasi Timur", produkUtama: "Perawatan Kendaraan", kegiatanUsaha: "Reparasi dan Perawatan Mobil dan Sepeda Motor", kodeKbli: "45205" },
];

// ── Skala badge styling (per design tokens) ───────────────────────────────
const skalaBadgeClasses: Record<SkalaUsaha, string> = {
  mikro: "bg-[#c3e9d0] text-[#006430]",
  kecil: "bg-[#bbdefb] text-[#0d47a1]",
  menengah: "bg-[#ffeeb4] text-[#ff7500]",
};

const skalaLabels: Record<SkalaUsaha, string> = {
  mikro: "Mikro",
  kecil: "Kecil",
  menengah: "Menengah",
};

// ── Filter state (draft vs. applied on "Filter Data") ─────────────────────
interface TabularFilters {
  kabupatenKota: string;
  kecamatan: string;
  desaKelurahan?: string;
  skala: string;
  kegiatanUsaha: string;
  kodeKbli: string;
}

const defaultFilters = (): TabularFilters => ({
  kabupatenKota: "semua",
  kecamatan: "semua",
  desaKelurahan: undefined,
  skala: "semua",
  kegiatanUsaha: "semua",
  kodeKbli: "semua",
});

const filters = reactive<TabularFilters>(defaultFilters());
const appliedFilters = reactive<TabularFilters>(defaultFilters());

const skalaOptions = [
  { value: "semua", label: "Semua" },
  { value: "mikro", label: "Mikro" },
  { value: "kecil", label: "Kecil" },
  { value: "menengah", label: "Menengah" },
];

const uniqueValues = (key: "kabupatenKota" | "kecamatan" | "kegiatanUsaha" | "kodeKbli" | "desaKelurahan") =>
  [...new Set(rows.map((r) => r[key]).filter((v): v is string => Boolean(v)))].sort();

const kabupatenOptions = ["semua", ...uniqueValues("kabupatenKota")].map((v) => ({
  value: v,
  label: v === "semua" ? "Semua Kabupaten/Kota" : v,
}));
const kecamatanOptions = ["semua", ...uniqueValues("kecamatan")].map((v) => ({
  value: v,
  label: v === "semua" ? "Semua Kecamatan" : v,
}));
const desaKelurahanOptions = uniqueValues("desaKelurahan").map((v) => ({ value: v, label: v }));
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
  page.value = 1;
};

const resetFilters = () => {
  Object.assign(filters, defaultFilters());
  applyFilters();
};

// ── Filtered rows + pagination ────────────────────────────────────────────
const filteredRows = computed(() =>
  rows.filter(
    (r) =>
      (appliedFilters.kabupatenKota === "semua" || r.kabupatenKota === appliedFilters.kabupatenKota) &&
      (appliedFilters.kecamatan === "semua" || r.kecamatan === appliedFilters.kecamatan) &&
      (!appliedFilters.desaKelurahan || r.desaKelurahan === appliedFilters.desaKelurahan) &&
      (appliedFilters.skala === "semua" || r.skala === appliedFilters.skala) &&
      (appliedFilters.kegiatanUsaha === "semua" || r.kegiatanUsaha === appliedFilters.kegiatanUsaha) &&
      (appliedFilters.kodeKbli === "semua" || r.kodeKbli === appliedFilters.kodeKbli)
  )
);

const pageSize = 10;
const page = ref(1);
const totalData = computed(() => filteredRows.value.length);
const pageCount = computed(() => Math.max(1, Math.ceil(totalData.value / pageSize)));
const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize;
  return filteredRows.value.slice(start, start + pageSize);
});

const pages = computed<(number | "…")[]>(() => {
  const total = pageCount.value;
  const current = page.value;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const visible = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...visible].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
});

const goToPage = (p: number) => {
  page.value = Math.min(Math.max(1, p), pageCount.value);
};

// ── CSV export for the download button ────────────────────────────────────
const exportCsv = () => {
  const header = ["No", "Nama Usaha", "Skala Usaha", "Kabupaten/Kota", "Kecamatan", "Desa/Kelurahan", "Produk Utama", "Kegiatan Usaha", "Kode KBLI", "Desil"];
  const lines = filteredRows.value.map((r, i) =>
    [i + 1, r.namaUsaha, skalaLabels[r.skala], r.kabupatenKota, r.kecamatan, r.desaKelurahan ?? "-", r.produkUtama, r.kegiatanUsaha, r.kodeKbli, r.desil ?? "-"]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(",")
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data-umkm-jawa-barat.csv";
  a.click();
  URL.revokeObjectURL(url);
};
</script>

<template>
  <div class="space-y-5 pb-8">
    <!-- Top Hero Banner (Data variant) -->
    <DashboardBanner
      variant="data"
      :icon="Table"
      title="Data Tabular UMKM"
      description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent dictum tortor eu dictum pulvinar. Fusce pulvinar enim ac dui luctus, ac tempus nisl vestibulum. Sed sit amet ante sit amet sapien dictum ultrices quis at augue. Nulla pharetra ex dictum, venenatis nunc a, tempor lectus."
    />

    <!-- Section 1: Jumlah Usaha Berdasarkan Skala Usaha -->
    <DashboardSectionCard
      title="Jumlah Usaha Berdasarkan Skala Usaha"
      description="Berdasarkan kriteria penjualan tahunan sebagaimana dimaksud dalam Pasal 35 ayat (5) Peraturan Pemerintah Nomor 7 Tahun 2021 tentang Kemudahan, Pelindungan, dan Pemberdayaan Koperasi serta UMKM."
      tooltip-text="Klasifikasi skala usaha berdasarkan kriteria omzet & aset sesuai PP No. 7 Tahun 2021"
    >
      <DashboardScaleStatsGrid />
    </DashboardSectionCard>

    <!-- Section 2: Filter + Data Table -->
    <section
      class="rounded-lg border border-border/80 bg-white p-4 shadow-xs dark:bg-card"
      aria-label="Tabel Data UMKM"
    >
      <!-- Filter Panel -->
      <div class="space-y-3 rounded-lg border border-border/80 p-4">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <!-- Kabupaten/Kota -->
          <div class="space-y-1.5">
            <label for="filter-kabupaten" class="block text-sm leading-4 text-[#323232]">
              Pilih Kabupaten/Kota
            </label>
            <UiSelect v-model="filters.kabupatenKota">
              <UiSelectTrigger
                id="filter-kabupaten"
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
            <label for="filter-kecamatan" class="block text-sm leading-4 text-[#323232]">
              Pilih Kecamatan
            </label>
            <UiSelect v-model="filters.kecamatan">
              <UiSelectTrigger
                id="filter-kecamatan"
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

          <!-- Desa/Kelurahan -->
          <div class="space-y-1.5">
            <label for="filter-desa" class="block text-sm leading-4 text-[#323232]">
              Desa/Kelurahan
            </label>
            <UiSelect v-model="filters.desaKelurahan">
              <UiSelectTrigger
                id="filter-desa"
                class="h-[54px] w-full rounded-lg border-[#9e9e9e] bg-[#fdfdfd] text-sm text-[#757575]"
              >
                <UiSelectValue placeholder="Desa/Kelurahan" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="opt in desaKelurahanOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <!-- Skala Usaha -->
          <div class="space-y-1.5">
            <label for="filter-skala" class="block text-sm leading-4 text-[#323232]">
              Skala Usaha
            </label>
            <UiSelect v-model="filters.skala">
              <UiSelectTrigger
                id="filter-skala"
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

          <!-- Kegiatan Usaha -->
          <div class="space-y-1.5">
            <label for="filter-kegiatan" class="block text-sm leading-4 text-[#323232]">
              Kegiatan Usaha
            </label>
            <UiSelect v-model="filters.kegiatanUsaha">
              <UiSelectTrigger
                id="filter-kegiatan"
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
            <label for="filter-kbli" class="block text-sm leading-4 text-[#323232]">
              Kode KBLI
            </label>
            <UiSelect v-model="filters.kodeKbli">
              <UiSelectTrigger
                id="filter-kbli"
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
          <UiButton variant="outline" class="gap-1.5 rounded-lg border-[#069550] text-sm font-bold text-[#069550] hover:bg-emerald-50" @click="resetFilters">
            <RotateCcw class="h-4 w-4" />
            <span>Reset Filter</span>
          </UiButton>
          <UiButton class="gap-1.5 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700" @click="applyFilters">
            <Filter class="h-4 w-4" />
            <span>Filter Data</span>
          </UiButton>
          <UiButton
            variant="ghost"
            size="icon"
            class="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
            aria-label="Unduh data UMKM (CSV)"
            title="Unduh data (CSV)"
            @click="exportCsv"
          >
            <Download class="h-4 w-4" />
          </UiButton>
        </div>
      </div>

      <!-- Table -->
      <div class="mt-4 overflow-x-auto rounded-lg border border-border/80">
        <table class="w-full min-w-[1100px] border-collapse text-xs">
          <thead>
            <tr class="bg-[#eee] text-[#212121]">
              <th scope="col" class="w-10 px-3 py-[7px] text-center font-bold">No.</th>
              <th scope="col" class="w-44 px-3 py-[7px] text-left font-bold">Nama Usaha</th>
              <th scope="col" class="w-32 px-3 py-[7px] text-left font-bold">Skala Usaha</th>
              <th scope="col" class="w-44 px-3 py-[7px] text-left font-bold">Kabupaten/Kota</th>
              <th scope="col" class="w-40 px-3 py-[7px] text-left font-bold">Kecamatan</th>
              <th scope="col" class="w-44 px-3 py-[7px] text-left font-bold">Produk Utama</th>
              <th scope="col" class="min-w-52 px-3 py-[7px] text-left font-bold">Kegiatan Usaha</th>
              <th scope="col" class="w-24 px-3 py-[7px] text-left font-bold">Kode KBLI</th>
              <th scope="col" class="w-16 px-3 py-[7px] text-center font-bold">Desil</th>
              <th scope="col" class="w-12 px-3 py-[7px] text-center font-bold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in pagedRows"
              :key="r.id"
              class="border-t border-[#9e9e9e]/40"
              :class="i % 2 === 1 ? 'bg-[#fafafa] dark:bg-muted/40' : 'bg-white dark:bg-card'"
            >
              <td class="px-3 py-[7px] text-center leading-8 text-[#212121]">{{ (page - 1) * pageSize + i + 1 }}</td>
              <td class="px-3 py-[7px] leading-8 text-[#212121]">{{ r.namaUsaha }}</td>
              <td class="px-3 py-[7px] leading-8">
                <span
                  class="inline-flex h-8 w-28 items-center justify-center overflow-hidden rounded-lg px-2 text-center font-bold whitespace-nowrap"
                  :class="skalaBadgeClasses[r.skala]"
                >
                  {{ skalaLabels[r.skala] }}
                </span>
              </td>
              <td class="px-3 py-[7px] leading-8 text-[#212121]">{{ r.kabupatenKota }}</td>
              <td class="px-3 py-[7px] leading-8 text-[#212121]">{{ r.kecamatan }}</td>
              <td class="px-3 py-[7px] leading-8 text-[#212121]">{{ r.produkUtama }}</td>
              <td class="px-3 py-[7px] leading-8 text-[#212121]">{{ r.kegiatanUsaha }}</td>
              <td class="px-3 py-[7px] leading-8 text-[#212121]">{{ r.kodeKbli }}</td>
              <td class="px-3 py-[7px] text-center leading-8 text-muted-foreground">{{ r.desil ?? "–" }}</td>
              <td class="px-3 py-[7px] text-center">
                <UiDropdownMenu>
                  <UiDropdownMenuTrigger as-child>
                    <button
                      type="button"
                      class="inline-flex h-8 w-6 items-center justify-center rounded-md text-[#212121] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      :aria-label="`Aksi untuk ${r.namaUsaha}`"
                    >
                      <MoreHorizontal class="h-4 w-4" />
                    </button>
                  </UiDropdownMenuTrigger>
                  <UiDropdownMenuContent align="end" class="w-44">
                    <UiDropdownMenuItem as-child>
                      <NuxtLink to="/dashboard/spasial" class="cursor-pointer">
                        Lihat di Peta Spasial
                      </NuxtLink>
                    </UiDropdownMenuItem>
                  </UiDropdownMenuContent>
                </UiDropdownMenu>
              </td>
            </tr>
            <!-- Empty state -->
            <tr v-if="pagedRows.length === 0" class="bg-white dark:bg-card">
              <td colspan="10" class="px-3 py-10 text-center text-sm text-muted-foreground">
                Tidak ada data UMKM yang cocok dengan filter yang dipilih.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Bar -->
      <div class="mt-4 flex flex-wrap items-center gap-2 text-[10px] leading-4 text-[#777574]">
        <span class="shrink-0">Menampilkan</span>
        <div class="flex h-8 shrink-0 items-center gap-1 rounded-md border border-[#c3c3bf] bg-white pr-1 pl-3 text-[10px] font-medium text-[#353432]">
          <span>{{ pageSize }}</span>
          <ChevronDown class="h-4 w-4" />
        </div>
        <span class="min-w-0 flex-1">dari {{ totalData }} Data Ditemukan</span>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class="flex h-6 w-6 items-center justify-center rounded bg-[#f4f3f1] text-[#353432] transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-[#f4f3f1]"
            :disabled="page === 1"
            aria-label="Ke halaman pertama"
            @click="goToPage(1)"
          >
            <ChevronsLeft class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="flex h-6 w-6 items-center justify-center rounded bg-[#f4f3f1] text-[#353432] transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-[#f4f3f1]"
            :disabled="page === 1"
            aria-label="Halaman sebelumnya"
            @click="goToPage(page - 1)"
          >
            <ChevronLeft class="h-3.5 w-3.5" />
          </button>

          <button
            v-for="(p, i) in pages"
            :key="`${p}-${i}`"
            type="button"
            class="flex h-6 min-w-6 items-center justify-center rounded px-1 text-[10px] leading-4 transition-colors"
            :class="
              p === page
                ? 'bg-[#008444] font-medium text-white'
                : p === '…'
                  ? 'cursor-default text-[#353432]'
                  : 'bg-[#f4f3f1] text-[#353432] hover:bg-slate-200'
            "
            :disabled="p === '…'"
            :aria-label="p === '…' ? 'Halaman lainnya' : `Halaman ${p}`"
            :aria-current="p === page ? 'page' : undefined"
            @click="p !== '…' && goToPage(p)"
          >
            {{ p }}
          </button>

          <button
            type="button"
            class="flex h-6 w-6 items-center justify-center rounded bg-[#f4f3f1] text-[#353432] transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-[#f4f3f1]"
            :disabled="page === pageCount"
            aria-label="Halaman berikutnya"
            @click="goToPage(page + 1)"
          >
            <ChevronRight class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="flex h-6 w-6 items-center justify-center rounded bg-[#f4f3f1] text-[#353432] transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-[#f4f3f1]"
            :disabled="page === pageCount"
            aria-label="Ke halaman terakhir"
            @click="goToPage(pageCount)"
          >
            <ChevronsRight class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
