<script setup lang="ts">
import { LayoutGrid, Search, SlidersHorizontal, X } from "@lucide/vue";
import type { Product } from "@/types/landing";

definePageMeta({ layout: "landing" });

useSeoMeta({
  title: "Katalog Produk UMKM – Diskuk Jawa Barat",
  description:
    "Jelajahi katalog produk UMKM unggulan dari seluruh Jawa Barat, cari berdasarkan kategori, lokasi, dan kata kunci.",
  ogTitle: "Katalog Produk UMKM – Diskuk Jawa Barat",
  ogDescription:
    "Jelajahi katalog produk UMKM unggulan dari seluruh Jawa Barat, cari berdasarkan kategori, lokasi, dan kata kunci.",
  ogImage: "/images/og-cover.jpg",
  twitterCard: "summary_large_image",
});

const preloaderDone = ref(false);

interface CatalogProduct extends Product {
  category: string;
  price: number;
}

const CATEGORIES = [
  "Semua",
  "Makanan",
  "Kuliner",
  "Fashion",
  "Craft",
  "Minuman",
  "Kerajinan",
  "Kesehatan",
  "Agribisnis",
];

const LOCATIONS = [
  "Semua Lokasi",
  "Kota Bandung",
  "Kab. Bandung",
  "Kab. Bandung Barat",
  "Kota Bekasi",
  "Kab. Bekasi",
  "Kab. Garut",
  "Kota Cirebon",
  "Kab. Tasikmalaya",
  "Kab. Sukabumi",
  "Kab. Indramayu",
  "Kab. Ciamis",
];

const SORT_OPTIONS = [
  { value: "terbaru", label: "Terbaru" },
  { value: "nama", label: "Nama A-Z" },
  { value: "harga-rendah", label: "Harga Terendah" },
  { value: "harga-tinggi", label: "Harga Tertinggi" },
];

// Dummy catalog — swap for real product data once the backend is wired up.
const products: CatalogProduct[] = [
  { id: 1, owner: "ADI CANDRA WIRATMADJA", name: "Sirmione Footwear", location: "Kab. Bandung Barat", image: "/images/produk-1.jpg", category: "Fashion", price: 185000 },
  { id: 2, owner: "ETI YUNIARTI", name: "Galeri Syahda", location: "Kab. Bekasi", image: "/images/produk-1.jpg", category: "Craft", price: 95000 },
  { id: 3, owner: "RINI SUSANTI", name: "Batik Cirebon Premium", location: "Kota Cirebon", image: "/images/produk-1.jpg", category: "Fashion", price: 320000 },
  { id: 4, owner: "BUDI SANTOSO", name: "Kerajinan Bambu Nusantara", location: "Kab. Sukabumi", image: "/images/produk-1.jpg", category: "Kerajinan", price: 75000 },
  { id: 5, owner: "DEWI RAHAYU", name: "Anyaman Rotan Asri", location: "Kab. Garut", image: "/images/produk-1.jpg", category: "Kerajinan", price: 140000 },
  { id: 6, owner: "AHMAD FAUZI", name: "Kopi Priangan Arabika", location: "Kab. Bandung", image: "/images/produk-1.jpg", category: "Minuman", price: 65000 },
  { id: 7, owner: "SITI NURHALIZA", name: "Olahan Tempe Nusantara", location: "Kab. Tasikmalaya", image: "/images/produk-1.jpg", category: "Makanan", price: 25000 },
  { id: 8, owner: "HENDRA GUNAWAN", name: "Wayang Golek Asli", location: "Kota Bandung", image: "/images/produk-1.jpg", category: "Craft", price: 450000 },
  { id: 9, owner: "YUNI ASTUTI", name: "Bordir Indramayu", location: "Kab. Indramayu", image: "/images/produk-1.jpg", category: "Fashion", price: 210000 },
  { id: 10, owner: "DEDEN SAEPUDIN", name: "Gula Aren Organik", location: "Kab. Ciamis", image: "/images/produk-1.jpg", category: "Makanan", price: 32000 },
  { id: 11, owner: "RATNA DEWI", name: "Tenun Garut Handmade", location: "Kab. Garut", image: "/images/produk-1.jpg", category: "Fashion", price: 380000 },
  { id: 12, owner: "MAMAN ABDURRAHMAN", name: "Sambal Cibiuk Autentik", location: "Kab. Garut", image: "/images/produk-1.jpg", category: "Kuliner", price: 28000 },
  { id: 13, owner: "LINA MARLINA", name: "Madu Hutan Priangan", location: "Kab. Bandung Barat", image: "/images/produk-1.jpg", category: "Kesehatan", price: 85000 },
  { id: 14, owner: "ASEP KURNIAWAN", name: "Keripik Singkong Balado", location: "Kota Bekasi", image: "/images/produk-1.jpg", category: "Kuliner", price: 18000 },
  { id: 15, owner: "NENG SRI WAHYUNI", name: "Teh Herbal Sereh Wangi", location: "Kab. Sukabumi", image: "/images/produk-1.jpg", category: "Kesehatan", price: 42000 },
  { id: 16, owner: "IWAN SETIAWAN", name: "Beras Organik Pandanwangi", location: "Kab. Ciamis", image: "/images/produk-1.jpg", category: "Agribisnis", price: 55000 },
  { id: 17, owner: "TETI RUSMIATI", name: "Keripik Pisang Aneka Rasa", location: "Kota Cirebon", image: "/images/produk-1.jpg", category: "Kuliner", price: 15000 },
  { id: 18, owner: "OJANG SUHERMAN", name: "Kaos Sablon Khas Priangan", location: "Kota Bandung", image: "/images/produk-1.jpg", category: "Fashion", price: 95000 },
];

const searchQuery = ref("");
const selectedCategory = ref("Semua");
const selectedLocation = ref("Semua Lokasi");
const sortBy = ref("terbaru");
const visibleCount = ref(9);
const PAGE_SIZE = 9;

const hasActiveFilters = computed(
  () =>
    searchQuery.value.trim() !== "" ||
    selectedCategory.value !== "Semua" ||
    selectedLocation.value !== "Semua Lokasi",
);

function resetFilters() {
  searchQuery.value = "";
  selectedCategory.value = "Semua";
  selectedLocation.value = "Semua Lokasi";
  sortBy.value = "terbaru";
}

const filteredProducts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  const result = products.filter((product) => {
    const matchesQuery =
      !query ||
      product.name.toLowerCase().includes(query) ||
      product.owner.toLowerCase().includes(query);
    const matchesCategory =
      selectedCategory.value === "Semua" ||
      product.category === selectedCategory.value;
    const matchesLocation =
      selectedLocation.value === "Semua Lokasi" ||
      product.location === selectedLocation.value;
    return matchesQuery && matchesCategory && matchesLocation;
  });

  const sorted = [...result];
  switch (sortBy.value) {
    case "nama":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "harga-rendah":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "harga-tinggi":
      sorted.sort((a, b) => b.price - a.price);
      break;
    default:
      sorted.sort((a, b) => b.id - a.id);
  }
  return sorted;
});

const visibleProducts = computed(() =>
  filteredProducts.value.slice(0, visibleCount.value),
);
const hasMore = computed(
  () => visibleCount.value < filteredProducts.value.length,
);

watch([searchQuery, selectedCategory, selectedLocation, sortBy], () => {
  visibleCount.value = PAGE_SIZE;
});
</script>

<template>
  <LandingPreloader @done="preloaderDone = true" />
  <div class="min-h-dvh">
    <LandingHeaderMask
      title="Produk UMKM"
      subtitle="Katalog"
      badge-color="#cbd5e1"
    />

    <div class="mx-auto max-w-7xl px-3 pb-20 | lg:px-12 xl:px-0">
      <div class="grid gap-8 | lg:grid-cols-[280px_1fr]">
        <!-- Sidebar filters -->
        <aside class="lg:sticky lg:top-24 lg:self-start">
          <div class="flex flex-col gap-6 rounded-xl border bg-card p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <h2 class="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                <SlidersHorizontal class="size-4" aria-hidden="true" />
                Filter
              </h2>
              <button
                v-if="hasActiveFilters"
                type="button"
                class="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                @click="resetFilters"
              >
                <X class="size-3.5" aria-hidden="true" />
                Reset
              </button>
            </div>

            <!-- Search -->
            <div class="flex flex-col gap-1.5">
              <label for="search-produk" class="text-xs font-semibold text-muted-foreground">
                Cari Produk
              </label>
              <div class="relative">
                <Search
                  class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <UiInput
                  id="search-produk"
                  v-model="searchQuery"
                  type="search"
                  placeholder="Nama produk atau pelaku UMKM"
                  class="pl-9"
                />
              </div>
            </div>

            <!-- Category -->
            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-muted-foreground">Kategori</span>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="category in CATEGORIES"
                  :key="category"
                  type="button"
                  :aria-pressed="selectedCategory === category"
                  class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                  :class="
                    selectedCategory === category
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-transparent text-foreground hover:bg-accent'
                  "
                  @click="selectedCategory = category"
                >
                  {{ category }}
                </button>
              </div>
            </div>

            <!-- Location -->
            <div class="flex flex-col gap-1.5">
              <label for="filter-lokasi" class="text-xs font-semibold text-muted-foreground">
                Lokasi
              </label>
              <UiSelect v-model="selectedLocation">
                <UiSelectTrigger id="filter-lokasi" class="w-full">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectItem v-for="loc in LOCATIONS" :key="loc" :value="loc">
                    {{ loc }}
                  </UiSelectItem>
                </UiSelectContent>
              </UiSelect>
            </div>
          </div>
        </aside>

        <!-- Results -->
        <div>
          <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-muted-foreground">
              Menampilkan
              <span class="font-semibold text-foreground">{{ visibleProducts.length }}</span>
              dari
              <span class="font-semibold text-foreground">{{ filteredProducts.length }}</span>
              produk
            </p>
            <UiSelect v-model="sortBy">
              <UiSelectTrigger class="w-44" aria-label="Urutkan produk">
                <UiSelectValue />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem
                  v-for="option in SORT_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <div
            v-if="visibleProducts.length"
            class="grid grid-cols-2 gap-x-4 gap-y-8 | md:grid-cols-3"
          >
            <LandingProductCard
              v-for="product in visibleProducts"
              :key="product.id"
              :product="product"
            />
          </div>

          <div
            v-else
            class="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center"
          >
            <LayoutGrid class="size-8 text-muted-foreground" aria-hidden="true" />
            <p class="text-sm font-medium text-foreground">
              Produk tidak ditemukan
            </p>
            <p class="max-w-xs text-balance text-xs text-muted-foreground">
              Coba ubah kata kunci pencarian atau filter yang dipilih.
            </p>
            <UiButton variant="outline" size="sm" class="mt-2" @click="resetFilters">
              Reset Filter
            </UiButton>
          </div>

          <div v-if="hasMore" class="mt-10 flex justify-center">
            <UiButton variant="outline" @click="visibleCount += PAGE_SIZE">
              Muat Lebih Banyak
            </UiButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
