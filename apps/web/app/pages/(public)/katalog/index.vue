<script setup lang="ts">
import { aggregate, readItems } from "@directus/sdk";
import { LayoutGrid, Search, SlidersHorizontal, X } from "@lucide/vue";
import { JENIS_LEGALITAS } from "~/constants";
import {
  DEFAULT_KATALOG_FILTERS,
  KATALOG_CHIPS,
  KATALOG_FIELDS,
  KATALOG_MAX_LIMIT,
  KATALOG_PAGE_SIZE,
  KATALOG_SKALA,
  KATALOG_SORT,
  KATALOG_TALENT,
  katalogFilter,
  katalogFiltersFromQuery,
  katalogQueryFromFilters,
  katalogSort,
  type KatalogFilters,
} from "~/lib/katalog";
import type { JenisLegalitas, ProdukPublik } from "~/types/program";

definePageMeta({ layout: "landing" });

useSeoMeta({
  title: "Katalog Produk UMKM – Diskuk Jawa Barat",
  description:
    "Jelajahi katalog produk UMKM unggulan dari seluruh Jawa Barat yang sudah dikurasi DISKUK, cari berdasarkan kategori, wilayah, dan sertifikasi.",
  ogTitle: "Katalog Produk UMKM – Diskuk Jawa Barat",
  ogDescription:
    "Jelajahi katalog produk UMKM unggulan dari seluruh Jawa Barat yang sudah dikurasi DISKUK, cari berdasarkan kategori, wilayah, dan sertifikasi.",
  ogImage: "/images/og-cover.jpg",
  twitterCard: "summary_large_image",
});

const route = useRoute();
const router = useRouter();
const directus = useDirectus();
const preloaderDone = ref(false);

// The URL is the state: a shared link reopens the same chips, filters and sort.
const filters = reactive<KatalogFilters>(katalogFiltersFromQuery(route.query));
const searchInput = ref(filters.q);
const limit = ref(KATALOG_PAGE_SIZE);

// Debounced search: only the settled keyword reaches the server query and the URL.
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(searchInput, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => (filters.q = value.trim()), 300);
});

watch(
  () => JSON.stringify(filters),
  () => {
    const query = katalogQueryFromFilters(filters);
    if (JSON.stringify(query) !== JSON.stringify(route.query)) void router.replace({ query });
  },
);

watch(
  () => JSON.stringify(filters),
  () => (limit.value = KATALOG_PAGE_SIZE),
);

const queryKey = computed(() => JSON.stringify({ ...filters, limit: Math.min(limit.value, KATALOG_MAX_LIMIT) }));

const { data, pending, error } = await useAsyncData(
  "katalog:list",
  async () => {
    const filter = katalogFilter(filters);
    // SAFETY: the query mirrors the Public policy's field allowlist; the SDK's generic field typing
    // cannot express the nested `foto.directus_files_id` path of the junction collection.
    const query = {
      fields: KATALOG_FIELDS,
      filter,
      sort: katalogSort(filters.sort),
      limit: Math.min(limit.value, KATALOG_MAX_LIMIT),
      deep: { foto: { _limit: 1, _sort: ["sort"] } },
    } as never;
    // SAFETY: SDK tidak dapat mengetik pohon filter dinamis pada query agregat; filter dibangun helper tervalidasi.
    const [items, total] = await Promise.all([
      directus.request(readItems("produk", query)),
      directus.request(aggregate("produk", { aggregate: { count: "*" }, query: { filter } as never })),
    ]);
    const count = Number(Array.isArray(total) ? total[0]?.count ?? 0 : 0);
    // SAFETY: query di atas dibatasi allowlist field publik; SDK tidak dapat mengetik jalur junction `foto.directus_files_id`.
    const list = Array.isArray(items) ? (items as ProdukPublik[]) : [];
    return { items: list, count };
  },
  { watch: [queryKey] },
);

/**
 * All 27 kabupaten/kota of Jawa Barat come from the reference table (`kota`, public grant
 * 20260926R) — not from the products that happen to be published. Counts follow the other
 * filters, so an empty region is explicitly empty instead of missing.
 */
const wilayahKey = computed(() => JSON.stringify({ ...filters, kota: null }));
const { data: wilayah } = await useAsyncData(
  "katalog:wilayah",
  async () => {
    const filter = katalogFilter({ ...filters, kota: null });
    // SAFETY: SDK tidak dapat mengetik pohon filter dinamis pada query agregat; filter dibangun helper tervalidasi.
    const [daftar, groups] = await Promise.all([
      // No client-side province filter: the public grant itself is limited to Jawa Barat
      // (migration 20260926R), and Directus rejects filters on fields outside the allowlist.
      // SAFETY: SDK tidak dapat mengetik `fields` union koleksi kota; field yang diminta persis allowlist publik.
      directus.request(readItems("kota", { fields: ["id", "nama"], sort: ["nama"], limit: 100 } as never)),
      directus.request(aggregate("produk", { aggregate: { count: "*" }, groupBy: ["usaha_kota"], query: { filter } as never })),
    ]);
    const rows = Array.isArray(groups) ? groups : [];
    const counts = new Map<number, number>(
      rows.filter((group) => group.usaha_kota).map((group) => [Number(group.usaha_kota), Number(group.count)]),
    );
    // SAFETY: field yang diminta persis allowlist publik koleksi kota (id, nama).
    const daftarKota = Array.isArray(daftar) ? (daftar as { id: number; nama: string }[]) : [];
    return daftarKota.map((kota) => ({
      value: String(kota.id),
      label: kota.nama,
      jumlah: counts.get(Number(kota.id)) ?? 0,
    }));
  },
  { watch: [wilayahKey] },
);

const kotaOptions = computed(() => {
  const options = wilayah.value ?? [];
  // A published product whose region is missing from the reference list must stay selectable.
  if (filters.kota && !options.some((option) => option.value === String(filters.kota))) {
    return [...options, { value: String(filters.kota), label: `Wilayah ${filters.kota}`, jumlah: 0 }];
  }
  return options;
});

const kotaModel = computed({
  get: () => (filters.kota ? String(filters.kota) : "semua"),
  set: (value: string) => (filters.kota = value === "semua" ? null : Number(value)),
});

const items = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.count ?? 0);
const hasMore = computed(() => items.value.length < total.value && limit.value < KATALOG_MAX_LIMIT);
const hasActiveFilters = computed(
  () => JSON.stringify({ ...filters, q: "", sort: "terbaru" }) !== JSON.stringify({ ...DEFAULT_KATALOG_FILTERS, q: "", sort: "terbaru" }) || searchInput.value !== "",
);

function toggle<T>(list: T[], value: T) {
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
  else list.push(value);
}

function resetFilters() {
  Object.assign(filters, structuredClone(DEFAULT_KATALOG_FILTERS));
  searchInput.value = "";
}
</script>

<template>
  <LandingPreloader @done="preloaderDone = true" />
  <div class="min-h-dvh">
    <LandingHeaderMask title="Produk UMKM" subtitle="Katalog" badge-color="#cbd5e1" />

    <div class="mx-auto max-w-7xl px-3 pb-20 | lg:px-12 xl:px-0">
      <!-- Search and the brief's five quick chips -->
      <div class="mb-6 grid gap-3">
        <div class="relative">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <UiInput
            id="search-produk"
            v-model="searchInput"
            type="search"
            placeholder="Cari nama produk, UMKM, atau KBLI 5 digit"
            class="h-11 pl-9"
            aria-label="Cari produk"
          />
        </div>
        <div class="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Kategori populer">
          <UiToggleChip
            :pressed="filters.kategori === null"
            class="shrink-0 px-3 py-1 text-xs"
            @toggle="filters.kategori = null"
          >Semua</UiToggleChip>
          <UiToggleChip
            v-for="chip in KATALOG_CHIPS"
            :key="chip.key"
            :pressed="filters.kategori === chip.key"
            class="shrink-0 px-3 py-1 text-xs"
            @toggle="filters.kategori = filters.kategori === chip.key ? null : chip.key"
          >{{ chip.label }}</UiToggleChip>
        </div>
      </div>

      <div class="grid gap-8 | lg:grid-cols-[260px_1fr]">
        <aside class="lg:sticky lg:top-24 lg:self-start" aria-label="Filter katalog">
          <div class="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <h2 class="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                <SlidersHorizontal class="size-4" aria-hidden="true" /> Filter
              </h2>
              <button v-if="hasActiveFilters" type="button" class="flex items-center gap-1 text-xs font-medium text-primary hover:underline" @click="resetFilters">
                <X class="size-3.5" aria-hidden="true" /> Reset
              </button>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="filter-wilayah" class="text-xs font-semibold text-muted-foreground">Wilayah (27 kabupaten/kota)</label>
              <UiSelect v-model="kotaModel">
                <UiSelectTrigger id="filter-wilayah" class="text-sm"><UiSelectValue /></UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectItem value="semua">Semua Kab/Kota</UiSelectItem>
                  <UiSelectItem v-for="kota in kotaOptions" :key="kota.value" :value="kota.value">{{ kota.label }} ({{ kota.jumlah }})</UiSelectItem>
                </UiSelectContent>
              </UiSelect>
            </div>

            <fieldset class="flex flex-col gap-1.5">
              <legend class="mb-1 text-xs font-semibold text-muted-foreground">Skala usaha</legend>
              <label v-for="skala in KATALOG_SKALA" :key="skala.value" class="flex items-center gap-2 text-sm">
                <UiCheckbox :model-value="filters.skala.includes(skala.value)" @update:model-value="toggle(filters.skala, skala.value)" /> {{ skala.label }}
              </label>
            </fieldset>

            <fieldset class="flex flex-col gap-1.5">
              <legend class="mb-1 text-xs font-semibold text-muted-foreground">Tahap program</legend>
              <label v-for="tahap in KATALOG_TALENT" :key="tahap.value" class="flex items-center gap-2 text-sm">
                <UiCheckbox :model-value="filters.talent.includes(tahap.value)" @update:model-value="toggle(filters.talent, tahap.value)" /> {{ tahap.label }}
              </label>
            </fieldset>

            <fieldset class="flex flex-col gap-1.5">
              <legend class="mb-1 text-xs font-semibold text-muted-foreground">Sertifikasi</legend>
              <label v-for="jenis in JENIS_LEGALITAS" :key="jenis.value" class="flex items-center gap-2 text-sm">
                <UiCheckbox :model-value="filters.sertifikasi.includes(jenis.value)" @update:model-value="toggle<JenisLegalitas>(filters.sertifikasi, jenis.value)" /> {{ jenis.label }}
              </label>
            </fieldset>

            <fieldset class="flex flex-col gap-1.5">
              <legend class="mb-1 text-xs font-semibold text-muted-foreground">Lainnya</legend>
              <label class="flex items-center gap-2 text-sm"><UiCheckbox v-model="filters.pdn" /> Produk Dalam Negeri (PDN)</label>
              <label class="flex items-center gap-2 text-sm"><UiCheckbox v-model="filters.ramahDisabilitas" /> Ramah disabilitas</label>
            </fieldset>
          </div>
        </aside>

        <div>
          <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-muted-foreground" aria-live="polite">
              Menampilkan <span class="font-semibold text-foreground">{{ items.length }}</span>
              dari <span class="font-semibold text-foreground" data-testid="katalog-total">{{ total }}</span> produk
            </p>
            <UiSelect v-model="filters.sort">
              <UiSelectTrigger class="text-sm" aria-label="Urutkan produk"><UiSelectValue /></UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="option in KATALOG_SORT" :key="option.value" :value="option.value">{{ option.label }}</UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <div v-if="error" role="alert" class="rounded-xl border border-destructive/30 p-6 text-sm text-destructive">
            Katalog tidak dapat dimuat. Coba beberapa saat lagi.
          </div>
          <div v-else-if="items.length" class="grid grid-cols-2 gap-4 | md:grid-cols-3">
            <KatalogProductCard v-for="produk in items" :key="produk.id" :produk="produk" />
          </div>
          <div v-else-if="!pending" class="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
            <LayoutGrid class="size-8 text-muted-foreground" aria-hidden="true" />
            <p class="text-sm font-medium">Produk tidak ditemukan</p>
            <p class="max-w-xs text-balance text-xs text-muted-foreground">Tidak ada produk yang cocok dengan kombinasi filter ini. Coba ubah kata kunci atau filter yang dipilih.</p>
            <UiButton variant="outline" size="sm" class="mt-2" @click="resetFilters">Reset Filter</UiButton>
          </div>

          <div v-if="hasMore" class="mt-10 flex justify-center">
            <UiButton variant="outline" :disabled="pending" @click="limit = Math.min(limit + KATALOG_PAGE_SIZE, KATALOG_MAX_LIMIT)">Muat Lebih Banyak</UiButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
