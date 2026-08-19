<script setup lang="ts">
import gsap from "gsap";
import type { GalleryItem } from "@/types/landing";

const galleryItems: GalleryItem[] = [
  { image: "/images/kegiatan-umkm.jpg", alt: "Pendampingan UMKM Jawa Barat" },
  { image: "/images/pameran-umkm.jpg", alt: "Pameran produk UMKM Jawa Barat" },
  { image: "/images/pelaku-umkm.jpg", alt: "Pelaku UMKM Jawa Barat" },
  { image: "/images/kegiatan-umkm-2.jpg", alt: "Kegiatan mentoring UMKM" },
  { image: "/images/pameran-umkm-2.jpg", alt: "Pameran UMKM Jawa Barat" },
  { image: "/images/pameran-umkm-3.jpg", alt: "Pameran UMKM Jawa Barat" },
];

const rootRef = useTemplateRef<HTMLElement>("root");
const headerRef = useTemplateRef<HTMLElement>("header");
const galleryRef = useTemplateRef<HTMLElement>("gallery");
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

    gsap.from(galleryRef.value!.querySelectorAll("figure"), {
      y: 40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.06,
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
  <section id="section-galeri" ref="root" role="region" aria-label="Galeri Pendampingan dan Mentoring UMKM" class="relative isolate -mt-px overflow-x-clip bg-primary py-16 lg:py-20">
    <div class="mx-auto max-w-7xl px-3 lg:px-12 xl:px-0">
      <div ref="header" class="mb-8 flex flex-col items-center gap-4 text-center lg:mb-16 lg:gap-6">
        <span class="inline-flex items-center rounded-full bg-amber-100 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-800">Galeri</span>
        <h2 class="text-balance text-3xl font-semibold uppercase leading-none text-white lg:text-5xl">Pendampingan &amp; Mentoring UMKM</h2>
        <UiButton variant="outline" as="a" href="/galeri" class="group relative overflow-hidden rounded-full border-white bg-transparent py-3 text-white shadow-none hover:bg-transparent">
          <span class="relative z-10 font-semibold transition-colors duration-300 ease-in-out group-hover:text-primary">Galeri Lainnya</span>
          <div class="absolute inset-x-0 top-0 aspect-square w-full! -translate-y-full rounded-full bg-white transition-transform duration-300 ease-in-out group-hover:translate-y-0" aria-hidden="true" />
        </UiButton>
      </div>
    </div>

    <div class="mx-auto max-w-7xl px-3 lg:px-12 xl:px-0">
      <div ref="gallery" class="relative isolate grid gap-3 lg:gap-0 lg:-space-y-[calc(4rem+2vw)]">
        <!-- Row 1 -->
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-10 lg:items-center lg:gap-6">
          <figure class="relative aspect-square overflow-clip rounded-xl lg:col-span-2 lg:col-start-2 lg:aspect-4/3 lg:-translate-y-1/2 lg:rotate-6 lg:shadow-[0_2rem_3.25rem_-0.5rem] lg:shadow-black/20 lg:transition-transform lg:duration-300 lg:ease-out lg:hover:scale-105">
            <NuxtImg :src="galleryItems[0]!.image" :alt="galleryItems[0]!.alt" class="size-full object-cover" loading="lazy" draggable="false" />
          </figure>
          <figure class="relative order-3 col-span-full aspect-video overflow-clip rounded-xl lg:order-2 lg:col-span-4 lg:z-1 lg:-rotate-3 lg:shadow-[0_2rem_3.25rem_-0.5rem] lg:shadow-black/20 lg:transition-transform lg:duration-300 lg:ease-out lg:hover:scale-105">
            <NuxtImg :src="galleryItems[1]!.image" :alt="galleryItems[1]!.alt" class="size-full object-cover" loading="lazy" draggable="false" />
          </figure>
          <figure class="relative order-2 aspect-square overflow-clip rounded-xl lg:order-3 lg:col-span-2 lg:z-1 lg:aspect-4/3 lg:-translate-y-1/2 lg:rotate-12 lg:shadow-[0_2rem_3.25rem_-0.5rem] lg:shadow-black/20 lg:transition-transform lg:duration-300 lg:ease-out lg:hover:scale-105">
            <NuxtImg :src="galleryItems[2]!.image" :alt="galleryItems[2]!.alt" class="size-full object-cover" loading="lazy" draggable="false" />
          </figure>
        </div>

        <!-- Row 2 -->
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-10 lg:items-center lg:gap-6">
          <figure class="relative aspect-square overflow-clip rounded-xl lg:col-span-2 lg:-translate-y-1/2 lg:rotate-8 lg:shadow-[0_2rem_3.25rem_-0.5rem] lg:shadow-black/20 lg:transition-transform lg:duration-300 lg:ease-out lg:hover:scale-105">
            <NuxtImg :src="galleryItems[3]!.image" :alt="galleryItems[3]!.alt" class="size-full object-cover" loading="lazy" draggable="false" />
          </figure>
          <figure class="relative aspect-square overflow-clip rounded-xl lg:col-span-2 lg:aspect-4/3 lg:-translate-y-1/4 lg:-rotate-6 lg:shadow-[0_2rem_3.25rem_-0.5rem] lg:shadow-black/20 lg:transition-transform lg:duration-300 lg:ease-out lg:hover:scale-105">
            <NuxtImg :src="galleryItems[4]!.image" :alt="galleryItems[4]!.alt" class="size-full object-cover" loading="lazy" draggable="false" />
          </figure>
          <figure class="relative hidden aspect-square overflow-clip rounded-xl lg:z-1 lg:col-span-2 lg:block lg:aspect-4/3 lg:translate-y-1/4 lg:rotate-4 lg:shadow-[0_2rem_3.25rem_-0.5rem] lg:shadow-black/20 lg:transition-transform lg:duration-300 lg:ease-out lg:hover:scale-105">
            <NuxtImg :src="galleryItems[5]!.image" :alt="galleryItems[5]!.alt" class="size-full object-cover" loading="lazy" draggable="false" />
          </figure>
        </div>
      </div>
    </div>

    <div class="absolute inset-0 -z-2 opacity-50 mix-blend-multiply [mask-image:linear-gradient(to_bottom,transparent,rgba(0,0,0,0.5))]" aria-hidden="true">
      <NuxtImg src="/images/pameran-umkm.jpg" alt="" class="size-full object-cover grayscale" loading="lazy" draggable="false" />
    </div>
    <div class="absolute -inset-x-[200vw] -bottom-px top-1/3 -z-1 overflow-clip pt-48" aria-hidden="true">
      <div class="aspect-square rounded-full bg-white blur-[5rem]" />
    </div>
  </section>
</template>
