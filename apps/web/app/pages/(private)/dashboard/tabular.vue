/*
 * Halaman Data Tabular UMKM.
 * Menampilkan data usaha dari Directus (endpoint `/panel/tabular/`) dengan
 * paginasi & filter server-side, karena jumlah baris mencapai jutaan
 * (snapshot publik `usaha_tabular` yang diterbitkan pasca-ingest SIDT).
 */
<script setup lang="ts">
import { Table, ChevronDown, MoreHorizontal, Filter, RotateCcw, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "@lucide/vue";

import type { SkalaUsaha, TabularUmkmItem } from "~/types/dashboard";
import type {
  TabularKelurahanItem,
  TabularKbliOption,
  TabularOptions,
  TabularRowItem,
  TabularRowsResponse,
} from "~/types/tabular";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Data Tabular UMKM – Dashboard Basis Data UMKM DisKUK Jawa Barat",
  description:
    "Tabel data UMKM Provinsi Jawa Barat dengan filter wilayah, skala usaha, kegiatan usaha, dan kode KBLI.",
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

const skalaOptions = [
  { value: "semua", label: "Semua" },
  { value: "mikro", label: "Mikro" },
  { value: "kecil", label: "Kecil" },
  { value: "menengah", label: "Menengah" },
];

// ── Filter state (draft vs. applied on "Filter Data") ─────────────────────
interface TabularFilters {
  kabupatenKota: string; // id kota dari Directus, "semua" = semua
  kecamatan: string;
  desaKelurahan: string;
  skala: string;
  kegiatanUsaha: string; // kategori KBLI
  kodeKbli: string;
}

const defaultFilters = (): TabularFilters => ({
  kabupatenKota: "semua",
  kecamatan: "semua",
  desaKelurahan: "semua",
  skala: "semua",
  kegiatanUsaha: "semua",
  kodeKbli: "semua",
});

const filters = reactive<TabularFilters>(defaultFilters());
const appliedFilters = reactive<TabularFilters>(defaultFilters());

// ── Data opsi filter (dari Directus, dimuat sekali) ───────────────────────
const { data: optionsData, error: optionsError } = await useFetch<{ data: TabularOptions }>(
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

// ── Kelurahan: dimuat per kecamatan & di-cache di klien ───────────────────
const kelurahanCache = new Map<string, TabularKelurahanItem[]>();
const desaKelurahanOptions = ref<{ value: string; label: string }[]>([
  { value: "semua", label: "Semua Desa/Kelurahan" },
]);

const syncKelurahanOptions = (kecamatanId: string) => {
  const items = kecamatanId === "semua" ? [] : (kelurahanCache.get(kecamatanId) ?? []);
  desaKelurahanOptions.value = [
    { value: "semua", label: "Semua Desa/Kelurahan" },
    ...items.map((k) => ({ value: String(k.id), label: k.nama })),
  ];
};

const loadKelurahan = async (kecamatanId: string) => {
  try {
    const res = await $fetch<{ data: TabularKelurahanItem[] }>("/panel/tabular/kelurahan", {
      query: { kecamatan: kecamatanId },
    });
    kelurahanCache.set(kecamatanId, res.data ?? []);
  } catch {
    kelurahanCache.set(kecamatanId, []);
  } finally {
    if (filters.kecamatan === kecamatanId) syncKelurahanOptions(kecamatanId);
  }
};

watch(
  () => filters.kecamatan,
  (v) => {
    filters.desaKelurahan = "semua";
    if (v === "semua") {
      syncKelurahanOptions("semua");
      return;
    }
    if (!kelurahanCache.has(v)) {
      syncKelurahanOptions("semua");
      loadKelurahan(v);
    } else {
      syncKelurahanOptions(v);
    }
  },
);

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

// ── Fetch baris (otomatis refetch saat filter diterapkan / ganti halaman) ──
const pageSize = 10;
const page = ref(1);

const rowsQuery = computed(() => ({
  kota: appliedFilters.kabupatenKota !== "semua" ? appliedFilters.kabupatenKota : undefined,
  kecamatan: appliedFilters.kecamatan !== "semua" ? appliedFilters.kecamatan : undefined,
  kelurahan: appliedFilters.desaKelurahan !== "semua" ? appliedFilters.desaKelurahan : undefined,
  skala: appliedFilters.skala !== "semua" ? skalaToApi[appliedFilters.skala as SkalaUsaha] : undefined,
  kegiatan: appliedFilters.kegiatanUsaha !== "semua" ? appliedFilters.kegiatanUsaha : undefined,
  kbli: appliedFilters.kodeKbli !== "semua" ? appliedFilters.kodeKbli : undefined,
  page: page.value,
  page_size: pageSize,
}));

const { data: rowsData, pending: rowsPending, error: rowsError } = await useFetch<TabularRowsResponse>(
  "/panel/tabular/",
  { query: rowsQuery },
);

const pagedRows = computed<TabularUmkmItem[]>(() =>
  (rowsData.value?.data ?? []).map((r) => ({
    id: r.id,
    namaUsaha: r.nama,
    skala: apiToSkala[r.skala] ?? "mikro",
    kabupatenKota: r.kota,
    kecamatan: r.kecamatan,
    desaKelurahan: r.kelurahan,
    produkUtama: r.produkUtama ?? "–",
    kegiatanUsaha: r.kategoriKbli ?? "–",
    kodeKbli: r.kodeKbli ?? "–",
  })),
);

const totalData = computed(() => rowsData.value?.meta?.filterCount ?? 0);
const pageCount = computed(() => Math.max(1, Math.ceil(totalData.value / pageSize)));

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

// ── Filter actions ────────────────────────────────────────────────────────
const applyFilters = () => {
  page.value = 1;
  Object.assign(appliedFilters, filters);
};

const resetFilters = () => {
  Object.assign(filters, defaultFilters());
  applyFilters();
};

// ── CSV export: unduh seluruh hasil filter via paginasi server ⁻───────────
const EXPORT_PAGE_SIZE = 1000;
const EXPORT_MAX_ROWS = 50_000;

const exportCsv = async () => {
  const total = totalData.value;
  if (total === 0 || rowsPending.value) return;
  const limit = Math.min(total, EXPORT_MAX_ROWS);
  const collected: TabularRowItem[] = [];
  const pageCountToFetch = Math.ceil(limit / EXPORT_PAGE_SIZE);

  for (let p = 1; p <= pageCountToFetch; p++) {
    const res = await $fetch<TabularRowsResponse>("/panel/tabular/", {
      query: { ...rowsQuery.value, page: p, page_size: EXPORT_PAGE_SIZE },
    });
    collected.push(...(res?.data ?? []));
    if (collected.length >= limit) break;
  }
  if (collected.length === 0) return;

  const header = ["No", "Nama Usaha", "Skala Usaha", "Kabupaten/Kota", "Kecamatan", "Desa/Kelurahan", "Produk Utama", "Kegiatan Usaha", "Kode KBLI"];
  const lines = collected.map((r, i) =>
    [
      i + 1,
      r.nama,
      skalaLabels[apiToSkala[r.skala] ?? "mikro"],
      r.kota,
      r.kecamatan,
      r.kelurahan,
      r.produkUtama ?? "-",
      r.kategoriKbli ?? "-",
      r.kodeKbli ?? "-",
    ]
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
    <DashboardCardBanner
      variant="data"
      :icon="Table"
      title="Data Tabular UMKM"
      description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent dictum tortor eu dictum pulvinar. Fusce pulvinar enim ac dui luctus, ac tempus nisl vestibulum. Sed sit amet ante sit amet sapien dictum ultrices quis at augue. Nulla pharetra ex dictum, venenatis nunc a, tempor lectus."
    />

    <p
      v-if="optionsError"
      class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      Opsi filter (wilayah &amp; KBLI) belum dapat dimuat. Silakan muat ulang halaman.
    </p>
    <p
      v-if="rowsError"
      class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      Data tabular belum dapat dimuat. Silakan coba lagi.
    </p>

    <!-- Section 1: Jumlah Usaha Berdasarkan Skala Usaha -->
    <DashboardCardSection
      title="Jumlah Usaha Berdasarkan Skala Usaha"
      description="Berdasarkan kriteria penjualan tahunan sebagaimana dimaksud dalam Pasal 35 ayat (5) Peraturan Pemerintah Nomor 7 Tahun 2021 tentang Kemudahan, Pelindungan, dan Pemberdayaan Koperasi serta UMKM."
      tooltip="Klasifikasi skala usaha berdasarkan kriteria omzet & aset sesuai PP No. 7 Tahun 2021"
    >
      <DashboardCardScaleStatsGrid />
    </DashboardCardSection>

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
                <UiSelectValue placeholder="Semua Desa/Kelurahan" />
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
          <UiButton
            variant="outline"
            class="gap-1.5 rounded-lg border-[#069550] text-sm font-bold text-[#069550] hover:bg-emerald-50"
            :disabled="rowsPending"
            @click="resetFilters"
          >
            <RotateCcw class="h-4 w-4" />
            <span>Reset Filter</span>
          </UiButton>
          <UiButton
            class="gap-1.5 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700"
            :disabled="rowsPending"
            @click="applyFilters"
          >
            <Filter class="h-4 w-4" />
            <span>Filter Data</span>
          </UiButton>
          <UiButton
            variant="ghost"
            size="icon"
            class="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
            :disabled="rowsPending || totalData === 0"
            aria-label="Unduh data UMKM (CSV)"
            title="Unduh seluruh hasil filter (CSV, maks. 50.000 baris)"
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
              <th scope="col" class="w-12 px-3 py-[7px] text-center font-bold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="rowsPending && pagedRows.length === 0"
              class="bg-white dark:bg-card"
            >
              <td colspan="9" class="px-3 py-10 text-center text-sm text-muted-foreground">
                Memuat data…
              </td>
            </tr>
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
            <tr v-if="!rowsPending && pagedRows.length === 0" class="bg-white dark:bg-card">
              <td colspan="9" class="px-3 py-10 text-center text-sm text-muted-foreground">
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
        <span class="min-w-0 flex-1">
          dari {{ rowsPending ? "…" : totalData }} Data Ditemukan
        </span>

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
