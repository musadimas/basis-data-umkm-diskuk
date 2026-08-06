<script setup lang="ts">
import gsap from "gsap";
import { Plus } from "@lucide/vue";
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
  <section ref="root" id="section-terms" role="region" aria-label="Syarat dan Ketentuan" class="relative isolate -mt-px bg-sky-50 py-16 lg:py-24">
    <div class="mx-auto max-w-screen-7xl px-4 lg:px-8">
      <div class="grid gap-12 lg:grid-cols-12 lg:gap-8">
        <div ref="left" class="col-span-full lg:col-span-4">
          <div class="flex h-full flex-col justify-between gap-10">
            <div class="flex flex-col gap-4">
              <UiBadge variant="outline" class="w-fit text-[10px] tracking-widest uppercase"> Syarat &amp; Ketentuan </UiBadge>
              <h2 class="text-2xl font-semibold uppercase leading-tight tracking-tight lg:text-3xl">Calon Peserta Program UMKM</h2>
            </div>
            <p class="text-balance text-muted-foreground">
              Calon peserta adalah pengusaha yang memiliki visi dan niat sungguh-sungguh untuk menjalankan usaha, memiliki SDM yang memadai, potensi pasar yang jelas, serta komitmen untuk berkembang bersama program.
            </p>
          </div>
        </div>

        <div class="col-span-full hidden lg:block lg:col-span-4">
          <div class="aspect-[3/4] overflow-clip rounded-2xl bg-stone-200">
            <NuxtImg src="/images/terms-cover.jpg" alt="Pelaku UMKM Jawa Barat" class="h-full w-full object-cover" loading="lazy" draggable="false" />
          </div>
        </div>

        <div ref="right" class="col-span-full lg:col-span-4">
          <ul class="divide-y divide-border" role="list">
            <li v-for="(term, i) in terms" :key="i" class="py-6 first:pt-0 last:pb-0">
              <UiDialog>
                <UiDialogTrigger as-child>
                  <button class="group flex w-full items-start gap-4 text-left" :aria-label="`Buka: ${term.title}`">
                    <Plus class="mt-0.5 size-5 shrink-0 text-primary transition-transform duration-200 group-hover:rotate-45" aria-hidden="true" />
                    <span class="text-sm font-medium leading-snug">{{ term.title }}</span>
                  </button>
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
  </section>
</template>
