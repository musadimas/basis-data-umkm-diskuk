<script setup lang="ts">
import gsap from "gsap";
import { MapPin, RefreshCcw, Search } from "@lucide/vue";

const kabupatenKota = [
  "Kab. Bandung",
  "Kab. Bandung Barat",
  "Kab. Bekasi",
  "Kab. Bogor",
  "Kab. Ciamis",
  "Kab. Cianjur",
  "Kab. Cirebon",
  "Kab. Garut",
  "Kab. Indramayu",
  "Kab. Karawang",
  "Kab. Kuningan",
  "Kab. Majalengka",
  "Kab. Pangandaran",
  "Kab. Purwakarta",
  "Kab. Subang",
  "Kab. Sukabumi",
  "Kab. Sumedang",
  "Kab. Tasikmalaya",
  "Kota Bandung",
  "Kota Bekasi",
  "Kota Bogor",
  "Kota Cimahi",
  "Kota Cirebon",
  "Kota Depok",
  "Kota Sukabumi",
  "Kota Tasikmalaya",
  "Kota Banjar",
];

const kategori = ["Makanan & Minuman", "Fashion & Tekstil", "Kerajinan & Seni", "Pertanian & Perkebunan", "Jasa & Perdagangan", "Teknologi & Digital"];

const rootRef = useTemplateRef<HTMLElement>("root");
const headerRef = useTemplateRef<HTMLElement>("header");
const mapRef = useTemplateRef<HTMLElement>("map");
let ctx: gsap.Context;

const searchQuery = ref("");
const selectedKabupaten = ref("");
const selectedKategori = ref("");

function resetFilter() {
  searchQuery.value = "";
  selectedKabupaten.value = "";
  selectedKategori.value = "";
}

onMounted(() => {
  ctx = gsap.context(() => {
    gsap.from([headerRef.value!, mapRef.value!], {
      y: 30,
      opacity: 0,
      duration: 0.75,
      stagger: 0.15,
      ease: "power2.out",
      scrollTrigger: {
        trigger: rootRef.value!,
        start: "top 80%",
        once: true,
      },
    });
  }, rootRef.value!);
});

onUnmounted(() => ctx?.revert());
</script>

<template>
  <section id="section-map" ref="root" role="region" aria-label="Sebaran UMKM Jawa Barat" class="relative isolate overflow-x-clip py-16 lg:py-20">
    <div class="mx-auto max-w-7xl px-3 lg:px-12 xl:px-0">
      <div class="grid gap-8 lg:grid-cols-12">
        <!-- Heading -->
        <div ref="header" class="col-span-full lg:col-span-6 lg:col-start-4">
          <div class="flex flex-col items-center gap-4 text-center lg:gap-6">
            <span class="inline-flex items-center rounded-full bg-amber-100 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-800"> UMKM Jawa Barat </span>
            <h2 class="text-balance font-semibold uppercase leading-none text-5xl">Sebaran UMKM Jawa Barat</h2>
          </div>
        </div>

        <!-- Map + search panel -->
        <div ref="map" class="col-span-full">
          <div class="relative -space-y-3 lg:space-y-0">
            <!-- Map placeholder -->
            <div class="relative aspect-square size-full overflow-clip rounded-t-xl bg-slate-100 lg:aspect-21/9 lg:rounded-xl" aria-label="Peta sebaran UMKM Jawa Barat — akan segera tersedia">
              <div class="flex h-full flex-col items-center justify-center gap-3 text-center">
                <MapPin class="size-4" aria-hidden="true" />
                <p class="text-sm font-medium text-slate-400">Peta Sebaran UMKM</p>
                <p class="text-xs text-slate-300">Peta interaktif akan ditampilkan di sini</p>
              </div>
              <div class="pointer-events-none absolute inset-0 opacity-[0.04]" style="background-image: radial-gradient(circle, currentColor 1px, transparent 1px); background-size: 24px 24px" aria-hidden="true" />
            </div>

            <!-- Search panel — on desktop overlaps bottom of map via translate -->
            <div class="relative z-10 lg:pointer-events-none lg:absolute lg:inset-0">
              <div class="lg:pointer-events-auto lg:absolute lg:inset-x-0 lg:bottom-0 lg:translate-y-1/2 lg:px-3">
                <div class="overflow-clip rounded-xl bg-white shadow-lg ring-1 ring-black/5">
                  <form class="grid lg:grid-cols-3" @submit.prevent>
                    <!-- Search input group -->
                    <div class="border-b px-5 py-4 lg:border-b-0 lg:border-r">
                      <label for="map-search" class="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cari</label>
                      <UiInputGroup class="mt-0.5 pr-1 pl-2 gap-2 h-auto border-none shadow-none focus-within:ring-0">
                        <UiInputGroupInput id="map-search" v-model="searchQuery" type="search" placeholder="Ketik lalu tekan enter" class="h-8! px-0 py-0 text-sm" />
                        <UiInputGroupButton type="submit" variant="ghost" aria-label="Cari" class="hover:bg-transparent p-0!">
                          <Search class="size-4" aria-hidden="true" />
                        </UiInputGroupButton>
                      </UiInputGroup>
                    </div>

                    <!-- Kabupaten/Kota -->
                    <div class="border-b px-5 py-4 lg:border-b-0 lg:border-r">
                      <label class="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kabupaten/Kota</label>
                      <UiSelect v-model="selectedKabupaten">
                        <UiSelectTrigger class="mt-0.5 border-none px-0 py-0 text-sm shadow-none focus:ring-0 w-full h-8!">
                          <UiSelectValue placeholder="Semua Kabupaten/Kota" />
                        </UiSelectTrigger>
                        <UiSelectContent>
                          <UiSelectItem v-for="kab in kabupatenKota" :key="kab" :value="kab">{{ kab }}</UiSelectItem>
                        </UiSelectContent>
                      </UiSelect>
                    </div>

                    <!-- Kategori + reset -->
                    <div class="flex items-end gap-3 px-5 py-4">
                      <div class="min-w-0 flex-1">
                        <label class="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kategori</label>
                        <UiSelect v-model="selectedKategori">
                          <UiSelectTrigger class="mt-0.5 border-none px-0 py-0 text-sm shadow-none focus:ring-0 h-8!">
                            <UiSelectValue placeholder="Semua Kategori" />
                          </UiSelectTrigger>
                          <UiSelectContent>
                            <UiSelectItem v-for="kat in kategori" :key="kat" :value="kat">{{ kat }}</UiSelectItem>
                          </UiSelectContent>
                        </UiSelect>
                      </div>
                      <UiButton type="button" size="icon-sm" @click="resetFilter"><RefreshCcw /></UiButton>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
