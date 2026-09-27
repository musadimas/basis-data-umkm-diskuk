<script setup lang="ts">
import { aggregate, readItems } from "@directus/sdk";
import { LayoutGrid, Search, SlidersHorizontal, X } from "@lucide/vue";
import { JENIS_LEGALITAS, KATEGORI_PRODUK } from "~/constants";
import { DEFAULT_KATALOG_FILTERS, KATALOG_FIELDS, katalogFilter, katalogSort, type KatalogFilters } from "~/lib/katalog";
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

const PAGE_SIZE = 12;
const SORT_OPTIONS = [
  { value: "terbaru", label: "Terbaru" },
  { value: "nama", label: "Nama A-Z" },
  { value: "harga-rendah", label: "Harga Terendah" },
  { value: "harga-tinggi", label: "Harga Tertinggi" },
];
const SKALA_OPTIONS = [
  { value: "micro", label: "Mikro" },
  { value: "small", label: "Kecil" },
  { value: "medium", label: "Menengah" },
];

const directus = useDirectus();
const preloaderDone = ref(false);
const filters = reactive<KatalogFilters>(structuredClone(DEFAULT_KATALOG_FILTERS));
const searchInput = ref("");
const limit = ref(PAGE_SIZE);

// Debounced search: the Directus `search` param matches the readable text fields.
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(searchInput, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => (filters.q = value.trim()), 300);
});

const queryKey = computed(() => JSON.stringify({ ...filters, limit: limit.value }));
watch(
  () => JSON.stringify(filters),
  () => (limit.value = PAGE_SIZE),
);

type Row = ProdukPublik & Record<string, unknown>;

const { data, pending, error } = await useAsyncData(
  "katalog:list",
  async () => {
    const filter = katalogFilter(filters);
    const search = filters.q || undefined;
    // SAFETY: the query mirrors the Public policy's field allowlist; the SDK's generic field typing
    // cannot express the nested `foto.directus_files_id` path of the junction collection.
    const query = {
      fields: KATALOG_FIELDS,
      filter,
      search,
      sort: katalogSort(filters.sort),
      limit: limit.value,
      deep: { foto: { _limit: 1, _sort: ["sort"] } },
    } as never;
    const [items, total] = await Promise.all([
      directus.request(readItems("produk", query)),
      directus.request(aggregate("produk", { aggregate: { count: "*" }, query: { filter, search } as never })),
    ]);
    const count = Number((total as { count?: number | string }[])[0]?.count ?? 0);
    return { items: (Array.isArray(items) ? items : []) as Row[], count };
  },
  { watch: [queryKey] },
);

// Regions that actually have published products, from the public copy on produk.
const { data: kotaOptions } = await useAsyncData("katalog:kota", async () => {
  const groups = await directus.request(
    aggregate("produk", { aggregate: { count: "*" }, groupBy: ["usaha_kota", "usaha_kota_nama"] } as never),
  );
  return (Array.isArray(groups) ? (groups as { usaha_kota: number | null; usaha_kota_nama: string | null }[]) : [])
    .filter((group) => group.usaha_kota && group.usaha_kota_nama)
    .map((group) => ({ value: String(group.usaha_kota), label: String(group.usaha_kota_nama) }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const kotaModel = computed({
  get: () => (filters.kota ? String(filters.kota) : "semua"),
  set: (value: string) => (filters.kota = value === "semua" ? null : Number(value)),
});

const items = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.count ?? 0);
const hasMore = computed(() => items.value.length < total.value);
const hasActiveFilters = computed(() => JSON.stringify({ ...filters, sort: "terbaru" }) !== JSON.stringify(DEFAULT_KATALOG_FILTERS) || searchInput.value !== "");

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
      <!-- Search and quick category chips -->
      <div class="mb-6 grid gap-3">
        <div class="relative">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <UiInput id="search-produk" v-model="searchInput" type="search" placeholder="Cari produk atau nama usaha" class="h-11 pl-9" aria-label="Cari produk" />
        </div>
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Kategori">
          <button
            type="button"
            :aria-pressed="filters.kategori === null"
            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            :class="filters.kategori === null ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'"
            @click="filters.kategori = null"
          >Semua</button>
          <button
            v-for="kategori in KATEGORI_PRODUK"
            :key="kategori.value"
            type="button"
            :aria-pressed="filters.kategori === kategori.value"
            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            :class="filters.kategori === kategori.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'"
            @click="filters.kategori = kategori.value"
          >{{ kategori.label }}</button>
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
              <label for="filter-wilayah" class="text-xs font-semibold text-muted-foreground">Wilayah</label>
              <select id="filter-wilayah" v-model="kotaModel" class="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
                <option value="semua">Semua Kab/Kota</option>
                <option v-for="kota in kotaOptions ?? []" :key="kota.value" :value="kota.value">{{ kota.label }}</option>
              </select>
            </div>

            <fieldset class="flex flex-col gap-1.5">
              <legend class="mb-1 text-xs font-semibold text-muted-foreground">Skala usaha</legend>
              <label v-for="skala in SKALA_OPTIONS" :key="skala.value" class="flex items-center gap-2 text-sm">
                <UiCheckbox :model-value="filters.skala.includes(skala.value)" @update:model-value="toggle(filters.skala, skala.value)" /> {{ skala.label }}
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
              <label class="flex items-center gap-2 text-sm"><UiCheckbox v-model="filters.talent" /> Talent Jabar</label>
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
            <select v-model="filters.sort" class="h-9 rounded-md border border-input bg-transparent px-2 text-sm" aria-label="Urutkan produk">
              <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
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
            <p class="max-w-xs text-balance text-xs text-muted-foreground">Coba ubah kata kunci pencarian atau filter yang dipilih.</p>
            <UiButton variant="outline" size="sm" class="mt-2" @click="resetFilters">Reset Filter</UiButton>
          </div>

          <div v-if="hasMore" class="mt-10 flex justify-center">
            <UiButton variant="outline" :disabled="pending" @click="limit += PAGE_SIZE">Muat Lebih Banyak</UiButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
