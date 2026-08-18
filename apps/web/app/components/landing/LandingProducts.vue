<script setup lang="ts">
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Draggable from "gsap/Draggable";
import InertiaPlugin from "gsap/InertiaPlugin";
import { ArrowRight, ChevronLeft, ChevronRight } from "@lucide/vue";
import type { Product } from "@/types/landing";

gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin);

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

const CARD_STEP = 260; // w-60 (240px) + gap-5 (20px)

const rootRef = useTemplateRef<HTMLElement>("root");
const headerRef = useTemplateRef<HTMLElement>("header");
const wrapperRef = useTemplateRef<HTMLElement>("wrapper");
const trackRef = useTemplateRef<HTMLElement>("track");
let ctx: gsap.Context;

function getMaxX() {
  if (!trackRef.value || !wrapperRef.value) return 0;
  return -(trackRef.value.scrollWidth - wrapperRef.value.clientWidth);
}

function shiftCarousel(delta: number) {
  if (!trackRef.value) return;
  const maxX = getMaxX();
  const currentX = gsap.getProperty(trackRef.value, "x") as number;
  const snapped = gsap.utils.snap(CARD_STEP, currentX + delta);
  gsap.to(trackRef.value, {
    x: gsap.utils.clamp(maxX, 0, snapped),
    duration: 0.4,
    ease: "power2.out",
  });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    shiftCarousel(CARD_STEP);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    shiftCarousel(-CARD_STEP);
  }
}

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

    gsap.from(Array.from(trackRef.value!.children), {
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

    const maxX = getMaxX();

    Draggable.create(trackRef.value!, {
      type: "x",
      bounds: { minX: maxX, maxX: 0 },
      inertia: true,
      cursor: "grab",
      activeCursor: "grabbing",
      snap: {
        x: (endValue) => gsap.utils.clamp(maxX, 0, gsap.utils.snap(CARD_STEP, endValue)),
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

    <div ref="wrapper" class="pl-[max(1rem,calc((100%-80rem)/2+1rem))] lg:pl-[max(2rem,calc((100%-80rem)/2+2rem))]" tabindex="0" role="group" aria-label="Geser untuk melihat produk lainnya" @keydown="onKeydown">
      <div ref="track" class="flex gap-5 select-none will-change-transform pr-4 lg:pr-8" style="width: max-content">
        <div v-for="product in products" :key="product.id" class="w-60 shrink-0">
          <LandingProductCard :product="product" />
        </div>
      </div>
    </div>

    <div class="mx-auto mt-8 max-w-7xl px-4 lg:px-8">
      <div class="flex items-center justify-between">
        <UiButton variant="outline" as="a" href="/katalog" class="gap-2">
          Katalog Lainnya
          <ArrowRight class="size-4" aria-hidden="true" />
        </UiButton>
        <div class="flex gap-2">
          <UiButton variant="outline" size="icon" aria-label="Produk sebelumnya" @click="shiftCarousel(300)">
            <ChevronLeft class="size-4" aria-hidden="true" />
          </UiButton>
          <UiButton variant="outline" size="icon" aria-label="Produk selanjutnya" @click="shiftCarousel(-300)">
            <ChevronRight class="size-4" aria-hidden="true" />
          </UiButton>
        </div>
      </div>
    </div>
  </section>
</template>
