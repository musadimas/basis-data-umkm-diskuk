<script setup lang="ts">
import gsap from "gsap";
import type { TermItem } from "@/types/landing";

const terms: TermItem[] = [
  {
    title: "Persyaratan Program UMKM Naik Kelas Bagi Pengusaha",
    content: `<ol class="list-decimal pl-5 space-y-2 text-sm leading-relaxed">
      <li>Penduduk Jawa Barat;</li>
      <li>Minimal usia 20 tahun dan maksimal usia 40 tahun;</li>
      <li>Memiliki motivasi tinggi dan terbiasa menggunakan sarana digital;</li>
      <li>Omzet usaha lebih dari Rp100.000.000,00/tahun;</li>
      <li>Memiliki perizinan minimal Nomor Induk Berusaha (NIB);</li>
      <li>Memiliki usaha minimal selama 2 tahun.</li>
    </ol>`,
  },
  {
    title: "Persyaratan Program UMKM Naik Kelas Bagi Pendamping",
    content: `<ol class="list-decimal pl-5 space-y-2 text-sm leading-relaxed">
      <li>Warga Jawa Barat dibuktikan dengan KTP;</li>
      <li>Usia 20 – 50 tahun, sehat jasmani dan rohani;</li>
      <li>Bukan Aparatur Sipil Negara (ASN);</li>
      <li>Tidak menjadi pengurus partai politik;</li>
      <li>Memiliki kemampuan dan/atau terbiasa menggunakan sarana digital;</li>
      <li>Bersedia melakukan kunjungan lapangan ke tempat UMKM.</li>
    </ol>`,
  },
];

const rootRef = useTemplateRef<HTMLElement>("root");
const leftRef = useTemplateRef<HTMLElement>("left");
const rightRef = useTemplateRef<HTMLElement>("right");
let ctx: gsap.Context;

onMounted(() => {
  ctx = gsap.context(() => {
    gsap.from([leftRef.value!, rightRef.value!], {
      y: 40,
      opacity: 0,
      duration: 0.75,
      stagger: 0.2,
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
  <section ref="root" id="section-terms" role="region" aria-label="Syarat dan Ketentuan" class="relative isolate -mt-px overflow-x-clip bg-sky-300 py-16 lg:mb-16 lg:py-20">
    <div class="mx-auto max-w-7xl px-3 lg:px-12 xl:px-0">
      <div class="grid gap-8 lg:grid-cols-12 lg:gap-16">
        <!-- Mobile-only heading -->
        <div class="col-span-full lg:hidden">
          <div class="flex flex-col items-center gap-4 text-center">
            <span class="inline-flex items-center rounded-full bg-amber-100 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-800"> Syarat &amp; Ketentuan </span>
            <h2 class="text-balance font-semibold uppercase leading-none">Syarat &amp; Ketentuan</h2>
          </div>
        </div>

        <!-- Center image column -->
        <div class="col-span-full lg:order-2 lg:col-span-4">
          <div class="relative size-full">
            <div class="aspect-square size-full overflow-clip rounded-xl lg:aspect-3/4">
              <NuxtImg src="/images/kegiatan-umkm-2.jpg" alt="Kegiatan UMKM Jawa Barat" draggable="false" loading="lazy" class="size-full object-cover" />
            </div>
            <div class="absolute bottom-0 left-0 hidden w-1/2 -translate-x-16 translate-y-16 lg:block" aria-hidden="true">
              <div class="aspect-square overflow-clip rounded-xl">
                <NuxtImg src="/images/pameran-umkm-3.jpg" alt="" draggable="false" loading="lazy" class="size-full object-cover" />
              </div>
            </div>
            <div class="absolute -inset-x-8 top-0 -z-10 aspect-square -translate-x-1/4 -translate-y-1/4 rounded-full bg-sky-400 blur-3xl" aria-hidden="true" />
          </div>
        </div>

        <!-- Left text column -->
        <div ref="left" class="col-span-full z-10 lg:order-1 lg:col-span-4">
          <div class="flex flex-col gap-8 lg:h-full lg:justify-between lg:gap-16 2xl:py-8">
            <div class="hidden flex-col items-start gap-4 lg:flex lg:gap-6">
              <span class="inline-flex items-center rounded-full bg-amber-100 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-800"> Syarat &amp; Ketentuan </span>
              <h2 class="text-balance text-6xl font-semibold uppercase leading-none">Calon Peserta Program UMKM</h2>
            </div>
            <p class="text-balance text-sky-950/70 text-justify max-w-[90%]">
              Calon peserta program adalah pengusaha yang memiliki visi dan niat sungguh-sungguh untuk menjalankan usaha, memiliki SDM yang memadai, potensi pasar, dan lain-lain.
            </p>
          </div>
        </div>

        <!-- Right terms list column -->
        <div ref="right" class="col-span-full z-10 lg:order-3 lg:col-span-4">
          <div class="flex flex-col gap-8 lg:h-full lg:justify-end lg:gap-16 2xl:py-8">
            <ul class="flex flex-col divide-y divide-sky-950/20" role="list">
              <li v-for="(term, i) in terms" :key="i" class="py-6 first:pt-0 last:pb-0">
                <UiDialog>
                  <UiDialogTrigger as-child>
                    <UiButton variant="ghost" class="hover:bg-transparent group h-auto w-full justify-start gap-4 px-0 text-left" :aria-label="`Buka: ${term.title}`">
                      <SvgoPlus class="mt-0.5 size-5 shrink-0 text-blue-500 transition duration-200 group-hover:rotate-45" :font-controlled="false" aria-hidden="true" />
                      <span class="text-sm font-medium leading-snug">{{ term.title }}</span>
                    </UiButton>
                  </UiDialogTrigger>
                  <UiDialogContent class="max-h-[80vh] max-w-lg overflow-y-auto">
                    <UiDialogHeader>
                      <UiDialogTitle class="text-base leading-snug">{{ term.title }}</UiDialogTitle>
                    </UiDialogHeader>
                    <div class="mt-4 text-muted-foreground" v-html="term.content" />
                    <div class="mt-6 flex justify-end">
                      <UiDialogClose as-child>
                        <UiButton variant="outline" size="sm">Tutup</UiButton>
                      </UiDialogClose>
                    </div>
                  </UiDialogContent>
                </UiDialog>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom white glow decoration -->
    <div class="absolute -bottom-px top-1/3 inset-x-[-200vw] -z-10 overflow-clip pt-48" aria-hidden="true">
      <div class="aspect-square rounded-full bg-white blur-[5rem]" />
    </div>
  </section>
</template>
