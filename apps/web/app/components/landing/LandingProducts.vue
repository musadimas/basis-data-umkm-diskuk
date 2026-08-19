<script setup lang="ts">
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { ArrowRight, ChevronLeft, ChevronRight } from "@lucide/vue";
import type { Product } from "@/types/landing";

gsap.registerPlugin(ScrollTrigger);

const products: Product[] = [
  {
    id: 1,
    owner: "ADI CANDRA WIRATMADJA",
    name: "Sirmione Footwear",
    location: "Parongpong, Kab. Bandung Barat",
    image: "/images/produk-1.jpg",
  },
  {
    id: 2,
    owner: "ETI YUNIARTI",
    name: "Galeri Syahda",
    location: "Tambun Selatan, Kab. Bekasi",
    image: "/images/produk-1.jpg",
  },
  {
    id: 3,
    owner: "RINI SUSANTI",
    name: "Batik Cirebon Premium",
    location: "Cirebon, Kota Cirebon",
    image: "/images/produk-1.jpg",
  },
  {
    id: 4,
    owner: "BUDI SANTOSO",
    name: "Kerajinan Bambu Nusantara",
    location: "Sukabumi, Kab. Sukabumi",
    image: "/images/produk-1.jpg",
  },
  {
    id: 5,
    owner: "DEWI RAHAYU",
    name: "Anyaman Rotan Asri",
    location: "Garut, Kab. Garut",
    image: "/images/produk-1.jpg",
  },
  {
    id: 6,
    owner: "AHMAD FAUZI",
    name: "Kopi Priangan Arabika",
    location: "Bandung, Kab. Bandung",
    image: "/images/produk-1.jpg",
  },
  {
    id: 7,
    owner: "SITI NURHALIZA",
    name: "Olahan Tempe Nusantara",
    location: "Tasikmalaya, Kab. Tasikmalaya",
    image: "/images/produk-1.jpg",
  },
  {
    id: 8,
    owner: "HENDRA GUNAWAN",
    name: "Wayang Golek Asli",
    location: "Bandung, Kota Bandung",
    image: "/images/produk-1.jpg",
  },
  {
    id: 9,
    owner: "YUNI ASTUTI",
    name: "Bordir Indramayu",
    location: "Indramayu, Kab. Indramayu",
    image: "/images/produk-1.jpg",
  },
  {
    id: 10,
    owner: "DEDEN SAEPUDIN",
    name: "Gula Aren Organik",
    location: "Ciamis, Kab. Ciamis",
    image: "/images/produk-1.jpg",
  },
  {
    id: 11,
    owner: "RATNA DEWI",
    name: "Tenun Garut Handmade",
    location: "Garut, Kab. Garut",
    image: "/images/produk-1.jpg",
  },
];

const rootRef = useTemplateRef<HTMLElement>("root");
const headerRef = useTemplateRef<HTMLElement>("header");
let ctx: gsap.Context;

onMounted(() => {
  ctx = gsap.context(() => {
    gsap.from(headerRef.value!, {
      y: 30,
      opacity: 0,
      duration: 0.75,
      ease: "power2.out",
      scrollTrigger: {
        trigger: rootRef.value!,
        start: "top 80%",
        once: true,
      },
    });

    gsap.from(rootRef.value!.querySelectorAll('[aria-roledescription="slide"]'), {
      y: 40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.08,
      ease: "power2.out",
      scrollTrigger: {
        trigger: rootRef.value!,
        start: "top 70%",
        once: true,
      },
    });
  }, rootRef.value!);
});

onUnmounted(() => ctx?.revert());
</script>

<template>
  <section id="section-products" ref="root" role="region" aria-label="Produk Unggulan UMKM" class="relative isolate overflow-x-clip py-16 lg:py-24">
    <div class="mx-auto max-w-7xl px-4 lg:px-8">
      <div ref="header" class="mb-12 flex flex-col items-center gap-4 text-center">
        <UiBadge variant="outline" class="text-[10px] tracking-widest uppercase">Katalog</UiBadge>
        <h2 class="text-2xl font-semibold uppercase leading-tight tracking-tight lg:text-5xl">Produk Unggulan UMKM</h2>
        <p class="max-w-md text-balance text-sm text-muted-foreground">Temukan produk-produk terbaik dari pelaku UMKM pilihan Jawa Barat.</p>
      </div>
    </div>

    <UiCarousel aria-label="Geser untuk melihat produk lainnya" :opts="{ align: 'start', dragFree: true, containScroll: 'trimSnaps' }">
      <template #default="{ scrollPrev, scrollNext, canScrollPrev, canScrollNext }">
        <UiCarouselContent class="-ml-5 pl-[max(1rem,calc((100%-80rem)/2+1rem))] pr-4 lg:pl-[max(2rem,calc((100%-80rem)/2+2rem))] lg:pr-8">
          <UiCarouselItem v-for="product in products" :key="product.id" class="w-60 basis-auto pl-5">
            <LandingProductCard :product="product" />
          </UiCarouselItem>
        </UiCarouselContent>

        <div class="mx-auto mt-8 max-w-7xl px-4 lg:px-8">
          <div class="flex items-center justify-between">
            <UiButton variant="outline" as="a" href="/katalog" class="gap-2">
              Katalog Lainnya
              <ArrowRight class="size-4" aria-hidden="true" />
            </UiButton>
            <div class="flex gap-2">
              <UiButton variant="outline" size="icon" :disabled="!canScrollPrev" aria-label="Produk sebelumnya" @click="scrollPrev">
                <ChevronLeft class="size-4" aria-hidden="true" />
              </UiButton>
              <UiButton variant="outline" size="icon" :disabled="!canScrollNext" aria-label="Produk selanjutnya" @click="scrollNext">
                <ChevronRight class="size-4" aria-hidden="true" />
              </UiButton>
            </div>
          </div>
        </div>
      </template>
    </UiCarousel>
  </section>
</template>
