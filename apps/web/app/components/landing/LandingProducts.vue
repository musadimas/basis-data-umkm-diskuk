<script setup lang="ts">
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Draggable from "gsap/Draggable";
import InertiaPlugin from "gsap/InertiaPlugin";
import { MapPin } from "@lucide/vue";
import type { Product } from "@/types/landing";

gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin);

const products: Product[] = [
  {
    id: 1,
    owner: "ADI CANDRA WIRATMADJA",
    name: "Sirmione Footwear",
    location: "Parongpong, Kab. Bandung Barat",
    image: "/images/products/sirmione.jpg",
  },
  {
    id: 2,
    owner: "ETI YUNIARTI",
    name: "Galeri Syahda",
    location: "Tambun Selatan, Kab. Bekasi",
    image: "/images/products/galeri-syahda.jpg",
  },
  {
    id: 3,
    owner: "RINI SUSANTI",
    name: "Batik Cirebon Premium",
    location: "Cirebon, Kota Cirebon",
    image: "/images/products/batik-cirebon.jpg",
  },
  {
    id: 4,
    owner: "BUDI SANTOSO",
    name: "Kerajinan Bambu Nusantara",
    location: "Sukabumi, Kab. Sukabumi",
    image: "/images/products/bambu.jpg",
  },
  {
    id: 5,
    owner: "DEWI RAHAYU",
    name: "Anyaman Rotan Asri",
    location: "Garut, Kab. Garut",
    image: "/images/products/rotan.jpg",
  },
  {
    id: 6,
    owner: "AHMAD FAUZI",
    name: "Kopi Priangan Arabika",
    location: "Bandung, Kab. Bandung",
    image: "/images/products/kopi.jpg",
  },
];

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
  gsap.to(trackRef.value, {
    x: gsap.utils.clamp(maxX, 0, currentX + delta),
    duration: 0.4,
    ease: "power2.out",
  });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    shiftCarousel(300);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    shiftCarousel(-300);
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
    });
  }, rootRef.value!);
});

onUnmounted(() => ctx?.revert());
</script>

<template>
  <section ref="root" id="section-products" role="region" aria-label="Produk Unggulan UMKM" class="relative isolate py-16 lg:py-24">
    <div class="mx-auto max-w-screen-7xl px-4 lg:px-8">
      <div ref="header" class="mb-12 flex flex-col items-center gap-4 text-center">
        <UiBadge variant="outline" class="text-[10px] tracking-widest uppercase">Katalog</UiBadge>
        <h2 class="text-2xl font-semibold uppercase leading-tight tracking-tight lg:text-3xl">Produk Unggulan UMKM</h2>
        <p class="max-w-md text-balance text-sm text-muted-foreground">Temukan produk-produk terbaik dari pelaku UMKM pilihan Jawa Barat.</p>
      </div>
    </div>

    <div ref="wrapper" class="overflow-hidden px-4 lg:px-8" tabindex="0" role="group" aria-label="Geser untuk melihat produk lainnya" @keydown="onKeydown">
      <div ref="track" class="flex gap-5 select-none will-change-transform" style="width: max-content">
        <article v-for="product in products" :key="product.id" class="w-[260px] shrink-0 lg:w-[calc(22vw-1.5rem)]">
          <figure class="relative aspect-square overflow-clip rounded-xl bg-muted">
            <NuxtImg :src="product.image" :alt="product.name" class="h-full w-full object-cover transition-transform duration-700 hover:scale-105" loading="lazy" draggable="false" />
          </figure>

          <div class="pt-3">
            <p class="truncate text-xs font-semibold uppercase tracking-wide text-primary">
              {{ product.owner }}
            </p>
            <h3 class="mt-1 line-clamp-2 text-sm font-medium leading-snug">
              {{ product.name }}
            </h3>
            <div class="mt-2 flex items-center gap-1 text-muted-foreground">
              <MapPin class="size-3 shrink-0" aria-hidden="true" />
              <span class="truncate text-xs">{{ product.location }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
