/*
 * Fungsi data tabular UMKM yang dipakai ulang: panel filter wilayah/skala/KBLI,
 * paginasi server-side (cursor untuk hasil besar), dan ekspor CSV async.
 * Dipakai halaman Data Tabular UMKM serta seksi "Data UMKM" dashboard infografis.
 * Kartu skala usaha opsional dirender internal via prop `showScaleCards`
 * (memakai meta baris, sehingga konsisten saat SSR).
 */
<script setup lang="ts">
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  Filter,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  Sparkles,
} from "@lucide/vue";

import type { ScaleStatItem, SkalaUsaha, TabularUmkmItem } from "~/types/dashboard";
import type {
  TabularFilters,
  TabularKelurahanItem,
  TabularKbliOption,
  TabularOptions,
  TabularRowsResponse,
  TabularSkalaApi,
} from "~/types/tabular";
import { DASHBOARD_SECTIONS } from "~/constants/DASHBOARD";
import { endpoint, endpointFromPanelUrl } from "~/lib/directus";
import { requestStatus } from "~/lib/request-error";

const props = withDefaults(defineProps<{
  /** Filter eksternal yang diikuti (mis. filter aktif infografis); disinkronkan saat berubah. */
  syncFilters?: TabularFilters;
  /** Tampilkan kartu skala usaha di atas tabel (dipakai halaman Data Tabular). */
  showScaleCards?: boolean;
}>(), {
  showScaleCards: false,
});

// ── Skala: nilai API (micro/small/medium) ⇄ nilai UI (mikro/kecil/menengah) ─
const skalaToApi = {
  mikro: "micro",
  kecil: "small",
  menengah: "medium",
} as const satisfies Record<SkalaUsaha, "micro" | "small" | "medium">;
const apiToSkala = {
  micro: "mikro",
  small: "kecil",
  medium: "menengah",
} as const satisfies Record<TabularSkalaApi, SkalaUsaha>;

// ── Skala badge styling (per design tokens) ───────────────────────────────
const skalaBadgeClasses = {
  mikro: "bg-[#c3e9d0] text-[#006430]",
  kecil: "bg-[#bbdefb] text-[#0d47a1]",
  menengah: "bg-[#ffeeb4] text-[#ff7500]",
} satisfies Record<SkalaUsaha, string>;

const skalaLabels = {
  mikro: "Mikro",
  kecil: "Kecil",
  menengah: "Menengah",
} satisfies Record<SkalaUsaha, string>;

const skalaOptions = [
  { value: "semua", label: "Semua" },
  { value: "mikro", label: "Mikro" },
  { value: "kecil", label: "Kecil" },
  { value: "menengah", label: "Menengah" },
];

// ── Filter state (draft vs. applied on "Filter Data") ─────────────────────
const defaultFilters = (): TabularFilters => ({
  kabupatenKota: "semua",
  kecamatan: "semua",
  desaKelurahan: "semua",
  skala: "semua",
  kegiatanUsaha: "semua",
  kodeKbli: "semua",
});

const filters = reactive<TabularFilters>({ ...defaultFilters(), ...props.syncFilters });
const appliedFilters = reactive<TabularFilters>({ ...defaultFilters(), ...props.syncFilters });

// ── Data opsi filter (dari Directus, dimuat sekali) ───────────────────────
const directus = useDirectus();
// Shared key with useTabularFilters: one request for every dashboard component.
const {
  data: optionsData,
  error: optionsError,
  pending: optionsPending,
  refresh: refreshOptions,
} = useAsyncData("tabular:options", () =>
  directus.request(endpoint<TabularOptions>("/v1/analytics/tabular/options")),
);

const kabupatenOptions = computed(() => [
  { value: "semua", label: "Kabupaten/Kota" },
  ...(optionsData.value?.kota ?? []).map((k) => ({ value: String(k.id), label: k.nama })),
]);

const kecamatanOptions = computed(() => {
  const list = optionsData.value?.kecamatan ?? [];
  const kotaId = Number(filters.kabupatenKota);
  const scoped = Number.isInteger(kotaId) && kotaId > 0 ? list.filter((k) => k.kotaId === kotaId) : list;
  return [
    { value: "semua", label: "Kecamatan" },
    ...scoped.map((k) => ({ value: String(k.id), label: k.nama })),
  ];
});

const kegiatanOptions = computed(() => [
  { value: "semua", label: "Kegiatan Usaha" },
  ...(optionsData.value?.kategori ?? []).map((k) => ({ value: k, label: k })),
]);

const kbliOptions = computed(() => {
  const list: TabularKbliOption[] = optionsData.value?.kbli ?? [];
  const scoped = filters.kegiatanUsaha === "semua" ? list : list.filter((k) => k.kategori === filters.kegiatanUsaha);
  return [
    { value: "semua", label: "Kode KBLI" },
    ...scoped.map((k) => ({ value: k.kode, label: k.kode })),
  ];
});

// ── Kelurahan: dimuat per kecamatan & di-cache di klien ───────────────────
const kelurahanCache = new Map<string, TabularKelurahanItem[]>();
const kelurahanPending = ref(false);
const kelurahanError = ref(false);
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
  kelurahanPending.value = true;
  kelurahanError.value = false;
  try {
    const items = await directus.request(
      endpoint<TabularKelurahanItem[]>("/v1/analytics/tabular/kelurahan", { query: { kecamatan: kecamatanId } }),
    );
    kelurahanCache.set(kecamatanId, items ?? []);
  } catch {
    kelurahanCache.set(kecamatanId, []);
    kelurahanError.value = true;
  } finally {
    kelurahanPending.value = false;
    if (filters.kecamatan === kecamatanId) syncKelurahanOptions(kecamatanId);
  }
};

watch(
  () => filters.kecamatan,
  (v) => {
    filters.desaKelurahan = "semua";
    kelurahanError.value = false;
    if (v === "semua") {
      syncKelurahanOptions("semua");
      return;
    }
    if (!kelurahanCache.has(v)) {
      syncKelurahanOptions("semua");
      void loadKelurahan(v);
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
    const list = optionsData.value?.kbli ?? [];
    if (!list.some((k) => k.kategori === v && k.kode === filters.kodeKbli)) {
      filters.kodeKbli = "semua";
    }
  },
);

// ── Fetch baris: cursor-based pagination (keyset) ────────────────────────
// Default 20 baris agar tinggi tabel sepadan dengan tab "Berdasarkan Kategori"
// (21 sektor), sehingga perpindahan tab tidak menciutkan panel.
const pageSize = ref("20");
const page = ref(1);
const currentCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const nextCursor = computed(() => rowsData.value?.meta?.nextCursor ?? null);
const hasNext = computed(() => Boolean(rowsData.value?.meta?.hasNext));

const filterQuery = computed(() => ({
  kota: appliedFilters.kabupatenKota !== "semua" ? appliedFilters.kabupatenKota : undefined,
  kecamatan: appliedFilters.kecamatan !== "semua" ? appliedFilters.kecamatan : undefined,
  kelurahan: appliedFilters.desaKelurahan !== "semua" ? appliedFilters.desaKelurahan : undefined,
  // SAFETY: opsi filter skala hanya "mikro"/"kecil"/"menengah" (lihat skalaOptions); nilai "semua" sudah disaring ternary ini.
  skala: appliedFilters.skala !== "semua" ? skalaToApi[appliedFilters.skala as SkalaUsaha] : undefined,
  kegiatan: appliedFilters.kegiatanUsaha !== "semua" ? appliedFilters.kegiatanUsaha : undefined,
  kbli: appliedFilters.kodeKbli !== "semua" ? appliedFilters.kodeKbli : undefined,
}));

interface TabularRowsQuery {
  kota?: string | undefined;
  kecamatan?: string | undefined;
  kelurahan?: string | undefined;
  skala?: string | undefined;
  kegiatan?: string | undefined;
  kbli?: string | undefined;
  page_size: number;
  page?: number;
  cursor?: string;
}

const rowsQuery = computed(() => {
  const base: TabularRowsQuery = {
    ...filterQuery.value,
    page_size: Number(pageSize.value),
  };
  if (currentCursor.value) {
    base.cursor = currentCursor.value;
  } else {
    base.page = page.value;
  }
  return base;
});

const {
  data: rowsData,
  pending: rowsPending,
  error: rowsError,
  refresh: refreshRows,
} = useAsyncData(
  "tabular:rows",
  () => directus.request(endpoint<TabularRowsResponse>("/v1/analytics/tabular/", { query: { ...rowsQuery.value } })),
  { watch: [rowsQuery], lazy: true },
);

const pagedRows = computed<TabularUmkmItem[]>(() =>
  (rowsData.value?.rows ?? []).map((r) => ({
    id: r.id,
    namaUsaha: r.nama,
    skala: apiToSkala[r.skala] ?? "mikro",
    kabupatenKota: r.kota,
    kecamatan: r.kecamatan,
    desaKelurahan: r.kelurahan,
    produkUtama: r.produkUtama ?? "–",
    kegiatanUsaha: r.kegiatanUtama ?? r.kategoriKbli ?? "–",
    kodeKbli: r.kodeKbli ?? "–",
  })),
);

const totalData = computed(() => rowsData.value?.meta?.filterCount ?? 0);

// ── Kartu skala: ikut filter aktif (scale breakdown dari meta, single grouped COUNT) ─
const scaleItems = computed<ScaleStatItem[]>(() => [
  {
    id: "total",
    title: "Total UMKM",
    value: totalData.value,
    category: "total",
    buttonText: "Lihat Data",
    buttonHref: "#data-tabular",
  },
  {
    id: "mikro",
    title: "Usaha Mikro",
    value: rowsData.value?.meta?.mikro ?? 0,
    category: "mikro",
  },
  {
    id: "kecil",
    title: "Usaha Kecil",
    value: rowsData.value?.meta?.kecil ?? 0,
    category: "kecil",
  },
  {
    id: "menengah",
    title: "Usaha Menengah",
    value: rowsData.value?.meta?.menengah ?? 0,
    category: "menengah",
  },
]);

const numericPageSize = computed(() => Number(pageSize.value));
const pageCount = computed(() => Math.max(1, Math.ceil(totalData.value / numericPageSize.value)));
const isLargeResult = computed(() => pageCount.value > 100);
const firstVisibleRow = computed(() => totalData.value === 0 ? 0 : (page.value - 1) * numericPageSize.value + 1);
const lastVisibleRow = computed(() => Math.min(
  pagedRows.value.length === 0
    ? 0
    : firstVisibleRow.value + pagedRows.value.length - 1,
  totalData.value,
));
const activeFilterCount = computed(() =>
  Object.values(appliedFilters).filter((value) => value !== "semua").length,
);
const filtersAreDirty = computed(() => {
  // SAFETY: filters adalah reactive<TabularFilters>, jadi Object.keys menghasilkan
  // tepat keyof TabularFilters; assertion hanya memulihkan narrowing yang hilang
  // oleh signature Object.keys(string[]).
  const keys = Object.keys(filters) as (keyof TabularFilters)[];
  return keys.some((key) => filters[key] !== appliedFilters[key]);
});

const resetPagination = () => {
  page.value = 1;
  currentCursor.value = null;
  cursorStack.value = [];
};

watch(pageSize, resetPagination);

// Sinkronkan filter internal saat filter eksternal (mis. filter infografis) berubah.
watch(
  () => props.syncFilters,
  (next) => {
    if (!next) return;
    Object.assign(filters, next);
    Object.assign(appliedFilters, next);
    resetPagination();
  },
  { deep: true },
);

// For large results, cursor is primary; numeric pages hidden
const pages = computed<(number | "…")[]>(() => {
  if (isLargeResult.value) return [];
  const total = pageCount.value;
  const current = page.value;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const base = [1, total, current - 1, current, current + 1];
  const visible = new Set<number>(base);
  const sorted = [...visible].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    const previous = sorted[i - 1];
    if (previous !== undefined && n - previous > 1) out.push("…");
    out.push(n);
  });
  return out;
});

const goToPage = (p: number) => {
  // Compatibility path only for small results; for large results use cursor navigation
  if (isLargeResult.value) return;
  page.value = Math.min(Math.max(1, p), pageCount.value);
  currentCursor.value = null;
  cursorStack.value = [];
};

const goNext = () => {
  if (rowsPending.value || !hasNext.value) return;
  if (!isLargeResult.value) {
    goToPage(page.value + 1);
    return;
  }
  if (!nextCursor.value) return;
  cursorStack.value.push(currentCursor.value ?? "");
  currentCursor.value = nextCursor.value;
  page.value += 1;
};

const goPrevious = () => {
  if (rowsPending.value || page.value === 1) return;
  if (!isLargeResult.value) {
    goToPage(page.value - 1);
    return;
  }
  if (cursorStack.value.length === 0) return;
  const prev = cursorStack.value.pop() ?? null;
  currentCursor.value = prev || null;
  page.value = Math.max(1, page.value - 1);
};

const goFirst = () => {
  resetPagination();
};

// ── Filter actions ────────────────────────────────────────────────────────
const applyFilters = () => {
  resetPagination();
  Object.assign(appliedFilters, filters);
};

const resetFilters = () => {
  Object.assign(filters, defaultFilters());
  applyFilters();
};

// ── CSV export: async job (bounded 50k) ───────────────────────────────
const exportError = ref<string | null>(null);
const isExporting = ref(false);
const exportCsv = async () => {
  const total = totalData.value;
  if (total === 0 || rowsPending.value || isExporting.value) return;
  exportError.value = null;
  isExporting.value = true;
  try {
    const payload = { ...filterQuery.value, max_rows: 50000 };
    const submit = await directus.request(
      endpoint<{ jobId: string; status: string; downloadUrl?: string }, typeof payload>("/v1/analytics/tabular/export", {
        method: "POST",
        body: payload,
      }),
    );
    const jobId = submit?.jobId;
    let downloadUrl = submit?.downloadUrl;
    // Poll if not yet completed
    let status = submit?.status;
    let attempts = 0;
    while (jobId && status !== "completed" && status !== "failed" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 800));
      const st = await directus.request(
        endpoint<{ status: string; downloadUrl?: string }>(`/v1/analytics/tabular/export/${jobId}`),
      );
      status = st?.status;
      downloadUrl = st?.downloadUrl || downloadUrl;
      if (status === "failed") throw new Error("Export failed");
      if (status === "completed" && downloadUrl) break;
      attempts += 1;
    }
    if (!downloadUrl) throw new Error("Export not ready");
    // Signed download link issued by the server; the SDK hands back the raw CSV Response.
    const download = await directus.request(endpointFromPanelUrl<Response>(downloadUrl));
    const blob = await download.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data-umkm-jawa-barat.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  } catch (err: unknown) {
    const status = requestStatus(err);
    if (status === 504) {
      exportError.value = "Ekspor melebihi batas waktu. Coba filter yang lebih spesifik.";
    } else if (status === 404 || status === 501 || status === 500) {
      exportError.value = "Ekspor belum tersedia. Hubungi administrator atau coba lagi nanti.";
    } else {
      exportError.value = "Gagal mengunduh CSV. Silakan coba lagi.";
    }
  } finally {
    isExporting.value = false;
  }
};
</script>

<template>
  <!-- Kartu skala usaha: hanya halaman Data Tabular; ikut filter aktif via meta baris -->
  <DashboardCardSection
    v-if="showScaleCards"
    v-bind="DASHBOARD_SECTIONS.scale"
  >
    <DashboardCardScaleStatsGrid :items="scaleItems" />
  </DashboardCardSection>

  <section
    :id="showScaleCards ? 'data-tabular' : undefined"
    aria-label="Tabel Data UMKM"
    :class="showScaleCards ? 'space-y-4 scroll-mt-20 rounded-lg border border-border/80 bg-white p-4 shadow-xs dark:bg-card' : 'space-y-4'"
  >
    <div
      v-if="optionsError"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
      role="alert"
    >
      <span>Opsi filter wilayah dan KBLI belum dapat dimuat.</span>
      <UiButton variant="outline" size="sm" @click="refreshOptions()">Coba lagi</UiButton>
    </div>
    <div
      v-if="rowsError"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
      role="alert"
    >
      <span>Data tabular belum dapat dimuat. Silakan coba lagi.</span>
      <UiButton variant="outline" size="sm" @click="refreshRows()">Coba lagi</UiButton>
    </div>

    <!-- Filter strip: langsung di atas tabel, tanpa panel/card -->
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <div class="min-w-36 flex-1 basis-36">
        <UiSelect v-model="filters.kabupatenKota" :disabled="optionsPending || Boolean(optionsError)">
          <UiSelectTrigger aria-label="Kabupaten/Kota" size="sm" class="w-full">
            <UiSelectValue placeholder="Semua Kabupaten/Kota" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem v-for="opt in kabupatenOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>

      <div class="min-w-36 flex-1 basis-36">
        <UiSelect v-model="filters.kecamatan" :disabled="optionsPending || Boolean(optionsError)">
          <UiSelectTrigger aria-label="Kecamatan" size="sm" class="w-full">
            <UiSelectValue placeholder="Semua Kecamatan" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem v-for="opt in kecamatanOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>

      <div class="min-w-36 flex-1 basis-36">
        <UiSelect
          v-model="filters.desaKelurahan"
          :disabled="filters.kecamatan === 'semua' || kelurahanPending || kelurahanError"
        >
          <UiSelectTrigger aria-label="Desa/Kelurahan" size="sm" class="w-full">
            <UiSelectValue :placeholder="kelurahanPending ? 'Memuat…' : 'Semua Desa/Kelurahan'" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem v-for="opt in desaKelurahanOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>

      <div class="min-w-32 flex-1 basis-32">
        <UiSelect v-model="filters.skala">
          <UiSelectTrigger aria-label="Skala Usaha" size="sm" class="w-full">
            <UiSelectValue placeholder="Semua" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem v-for="opt in skalaOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>

      <div class="min-w-36 flex-1 basis-36">
        <UiSelect v-model="filters.kegiatanUsaha" :disabled="optionsPending || Boolean(optionsError)">
          <UiSelectTrigger aria-label="Kegiatan Usaha" size="sm" class="w-full">
            <UiSelectValue placeholder="Semua" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem v-for="opt in kegiatanOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>

      <div class="min-w-28 flex-1 basis-28">
        <UiSelect v-model="filters.kodeKbli" :disabled="optionsPending || Boolean(optionsError)">
          <UiSelectTrigger aria-label="Kode KBLI" size="sm" class="w-full">
            <UiSelectValue placeholder="Semua" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem v-for="opt in kbliOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <UiButton
          variant="outline"
          size="sm"
          class="gap-1 rounded-md border-brand-green text-xs font-semibold text-brand-green-foreground hover:bg-brand-green/10"
          :disabled="rowsPending || (!filtersAreDirty && activeFilterCount === 0)"
          @click="resetFilters"
        >
          <RotateCcw class="h-3.5 w-3.5" />
          <span>Reset</span>
        </UiButton>
        <UiButton
          size="sm"
          class="gap-1 rounded-md bg-brand-green text-xs font-semibold text-brand-green-foreground hover:bg-brand-green/90"
          :disabled="rowsPending || !filtersAreDirty"
          @click="applyFilters"
        >
          <LoaderCircle v-if="rowsPending" class="h-3.5 w-3.5 animate-spin" />
          <Filter v-else class="h-3.5 w-3.5" />
          <span>{{ rowsPending ? "Memuat…" : "Terapkan" }}</span>
        </UiButton>
        <UiButton
          variant="outline"
          size="sm"
          class="gap-1 rounded-md border-brand-green text-xs font-semibold text-brand-green-foreground hover:bg-brand-green/10"
          :disabled="rowsPending || totalData === 0 || isExporting"
          aria-label="Unduh data UMKM (CSV)"
          title="Unduh seluruh hasil filter (CSV, maks. 50.000 baris)"
          @click="exportCsv"
        >
          <LoaderCircle v-if="isExporting" class="h-3.5 w-3.5 animate-spin" />
          <Download v-else class="h-3.5 w-3.5" />
          <span>{{ isExporting ? "Menyiapkan…" : "CSV" }}</span>
        </UiButton>
      </div>
    </div>
    <p v-if="kelurahanError" class="mb-2 text-xs text-destructive" role="alert">
      Daftar desa/kelurahan gagal dimuat.
    </p>
    <p v-if="exportError" class="mb-2 text-right text-xs text-destructive" role="alert">
      {{ exportError }}
    </p>

    <!-- Table -->
    <div class="overflow-x-auto rounded-lg border border-border/80" :aria-busy="rowsPending">
      <table class="w-full min-w-[1260px] border-collapse text-xs">
        <thead>
          <tr class="bg-[#eee] text-[#212121]">
            <th scope="col" class="w-10 px-3 py-[7px] text-center font-bold">No.</th>
            <th scope="col" class="w-44 px-3 py-[7px] text-left font-bold">Nama Usaha</th>
            <th scope="col" class="w-32 px-3 py-[7px] text-left font-bold">Skala Usaha</th>
            <th scope="col" class="w-44 px-3 py-[7px] text-left font-bold">Kabupaten/Kota</th>
            <th scope="col" class="w-40 px-3 py-[7px] text-left font-bold">Kecamatan</th>
            <th scope="col" class="w-40 px-3 py-[7px] text-left font-bold">Desa/Kelurahan</th>
            <th scope="col" class="w-44 px-3 py-[7px] text-left font-bold">Produk Utama</th>
            <th scope="col" class="min-w-52 px-3 py-[7px] text-left font-bold">Kegiatan Usaha</th>
            <th scope="col" class="w-24 px-3 py-[7px] text-left font-bold">Kode KBLI</th>
            <th scope="col" class="w-12 px-3 py-[7px] text-center font-bold">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <!-- Skeleton saat memuat (mis. baru membuka tab): jumlah baris mengikuti page size agar tinggi tidak menciut -->
          <template v-if="rowsPending && pagedRows.length === 0">
            <tr
              v-for="row in numericPageSize"
              :key="`skeleton-${row}`"
              class="border-t border-[#9e9e9e]/40 bg-white dark:bg-card"
              aria-hidden="true"
            >
              <td class="px-3 py-[7px] text-center">
                <UiSkeleton class="mx-auto h-4 w-6" />
              </td>
              <td class="px-3 py-[7px]">
                <UiSkeleton class="h-4 w-full max-w-44" />
              </td>
              <td class="px-3 py-[7px]">
                <UiSkeleton class="h-8 w-28 rounded-lg" />
              </td>
              <td class="px-3 py-[7px]">
                <UiSkeleton class="h-4 w-full max-w-44" />
              </td>
              <td class="px-3 py-[7px]">
                <UiSkeleton class="h-4 w-full max-w-40" />
              </td>
              <td class="px-3 py-[7px]">
                <UiSkeleton class="h-4 w-full max-w-40" />
              </td>
              <td class="px-3 py-[7px]">
                <UiSkeleton class="h-4 w-full max-w-44" />
              </td>
              <td class="px-3 py-[7px]">
                <UiSkeleton class="h-4 w-full max-w-56" />
              </td>
              <td class="px-3 py-[7px]">
                <UiSkeleton class="h-4 w-full max-w-20" />
              </td>
              <td class="px-3 py-[7px] text-center">
                <UiSkeleton class="mx-auto h-4 w-6" />
              </td>
            </tr>
            <tr class="bg-white dark:bg-card" aria-hidden="true">
              <td colspan="10" class="px-3 py-[7px]">
                <span class="sr-only">Memuat data…</span>
              </td>
            </tr>
          </template>
          <tr
            v-for="(r, i) in pagedRows"
            :key="r.id"
            class="border-t border-[#9e9e9e]/40"
            :class="i % 2 === 1 ? 'bg-[#fafafa] dark:bg-muted/40' : 'bg-white dark:bg-card'"
          >
            <td class="px-3 py-[7px] text-center leading-8 text-[#212121]">{{ firstVisibleRow + i }}</td>
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
            <td class="px-3 py-[7px] leading-8 text-[#212121]">{{ r.desaKelurahan || "–" }}</td>
            <td class="px-3 py-[7px] leading-8 text-[#212121]">{{ r.produkUtama }}</td>
            <td class="px-3 py-[7px] leading-8 text-[#212121]">{{ r.kegiatanUsaha }}</td>
            <td class="px-3 py-[7px] leading-8 text-[#212121]">{{ r.kodeKbli }}</td>
            <td class="px-3 py-[7px] text-center">
              <UiDropdownMenu>
                <UiDropdownMenuTrigger as-child>
                  <button
                    type="button"
                    class="inline-flex h-8 w-6 items-center justify-center rounded-md text-[#212121] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                    :aria-label="`Aksi untuk ${r.namaUsaha}`"
                  >
                    <MoreHorizontal class="h-4 w-4" />
                  </button>
                </UiDropdownMenuTrigger>
                <UiDropdownMenuContent align="end" class="w-56">
                  <UiDropdownMenuItem as-child>
                    <NuxtLink :to="`/dashboard/umkm/${r.id}`" class="cursor-pointer">
                      <Eye class="mr-2 h-4 w-4" />
                      Lihat Profil UMKM
                    </NuxtLink>
                  </UiDropdownMenuItem>
                  <UiDropdownMenuItem as-child>
                    <NuxtLink :to="`/dashboard/talent/ajukan/${r.id}`" class="cursor-pointer">
                      <Sparkles class="mr-2 h-4 w-4" />
                      Ajukan ke Talent Scouting
                    </NuxtLink>
                  </UiDropdownMenuItem>
                </UiDropdownMenuContent>
              </UiDropdownMenu>
            </td>
          </tr>
          <!-- Empty state -->
          <tr v-if="!rowsPending && pagedRows.length === 0" class="bg-white dark:bg-card">
            <td colspan="10" class="px-3 py-10 text-center text-sm text-muted-foreground">
              Tidak ada data UMKM yang cocok dengan filter yang dipilih.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination Bar -->
    <div class="flex flex-wrap items-center gap-2 text-[10px] leading-4 text-[#777574]">
      <span class="shrink-0">Baris per halaman</span>
      <UiSelect v-model="pageSize" :disabled="rowsPending">
        <UiSelectTrigger class="h-8 w-[72px] text-xs" aria-label="Baris per halaman">
          <UiSelectValue />
        </UiSelectTrigger>
        <UiSelectContent>
          <UiSelectItem value="10">10</UiSelectItem>
          <UiSelectItem value="25">25</UiSelectItem>
          <UiSelectItem value="50">50</UiSelectItem>
        </UiSelectContent>
      </UiSelect>
      <span class="min-w-0 flex-1">
        <template v-if="rowsPending">Memuat data…</template>
        <template v-else>{{ firstVisibleRow }}–{{ lastVisibleRow }} dari {{ totalData.toLocaleString("id-ID") }} data</template>
      </span>

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded bg-[#f4f3f1] text-[#353432] transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-[#f4f3f1]"
          :disabled="rowsPending || page === 1"
          aria-label="Ke halaman pertama"
          @click="goFirst"
        >
          <ChevronsLeft class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded bg-[#f4f3f1] text-[#353432] transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-[#f4f3f1]"
          :disabled="rowsPending || page === 1"
          aria-label="Halaman sebelumnya"
          @click="goPrevious"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
        </button>

        <template v-if="!isLargeResult">
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
        </template>
        <span v-else class="px-2 text-[10px] text-[#353432]">Halaman {{ page }}</span>

        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded bg-[#f4f3f1] text-[#353432] transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-[#f4f3f1]"
          :disabled="rowsPending || !hasNext"
          aria-label="Halaman berikutnya"
          @click="goNext"
        >
          <ChevronRight class="h-3.5 w-3.5" />
        </button>
        <button
          v-if="!isLargeResult"
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded bg-[#f4f3f1] text-[#353432] transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-[#f4f3f1]"
          :disabled="rowsPending || page === pageCount"
          aria-label="Ke halaman terakhir"
          @click="goToPage(pageCount)"
        >
          <ChevronsRight class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </section>
</template>
