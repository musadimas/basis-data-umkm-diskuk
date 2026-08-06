<script setup lang="ts">
import gsap from "gsap";
import type { FaqItem } from "@/types/landing";

const faqItems: FaqItem[] = [
  {
    question: "Apa itu Program UMKM Naik Kelas?",
    answer:
      "Program UMKM Naik Kelas menargetkan peserta dari pengusaha di Jawa Barat yang berkomitmen untuk maju dan berkembang di bidang bisnis. Manfaat yang didapatkan adalah penguatan diri, manajemen usaha, dan pemanfaatan teknologi informasi untuk mencapai pasar yang lebih luas.",
  },
  {
    question: "Batas waktu dan cara mendaftar?",
    answer: "Untuk tahap awal pendaftaran di tahun 2025, silakan mengunjungi Dinas KUMKM Kab./Kota sesuai domisili hingga bulan Mei 2025. Program dilaksanakan bulan Juni s.d. November 2025.",
  },
  {
    question: "Apakah bisa dibantu mendaftar secara online?",
    answer: "Ya, jika Anda tidak memiliki akses internet atau mengalami kesulitan teknis, Anda bisa datang langsung ke Dinas KUMKM Kab./Kota sesuai domisili untuk mendapatkan bantuan proses pendaftaran.",
  },
  {
    question: "Apa persyaratan bagi pengusaha?",
    answer: "Penduduk Jawa Barat, usia 20–40 tahun, memiliki motivasi tinggi dan terbiasa menggunakan sarana digital, omzet usaha lebih dari Rp100 juta/tahun, memiliki NIB, dan usaha minimal 2 tahun.",
  },
  {
    question: "Apa persyaratan bagi pendamping?",
    answer: "Warga Jawa Barat (dibuktikan dengan KTP), usia 20–50 tahun, sehat jasmani dan rohani, bukan ASN, tidak menjadi pengurus partai politik, memiliki kompetensi pendampingan UMKM, dan bersedia melakukan kunjungan lapangan.",
  },
];

const rootRef = useTemplateRef<HTMLElement>("root");
const imageRef = useTemplateRef<HTMLElement>("image");
const contentRef = useTemplateRef<HTMLElement>("content");
let ctx: gsap.Context;

onMounted(() => {
  ctx = gsap.context(() => {
    gsap.from([imageRef.value!, contentRef.value!], {
      y: 40,
      opacity: 0,
      duration: 0.75,
      stagger: 0.2,
      ease: "power2.out",
      scrollTrigger: {
        trigger: rootRef.value!,
        start: "top 78%",
        once: true,
      },
    });
  }, rootRef.value!);
});

onUnmounted(() => ctx?.revert());
</script>

<template>
  <section ref="root" id="section-faq" role="region" aria-label="Pertanyaan yang Sering Diajukan" class="relative isolate py-16 lg:py-24">
    <div class="mx-auto max-w-screen-7xl px-4 lg:px-8">
      <div class="grid gap-12 lg:grid-cols-12 lg:gap-8">
        <div ref="image" class="hidden lg:block lg:col-span-5 lg:col-start-1">
          <figure class="aspect-4/5 overflow-clip rounded-2xl bg-muted">
            <NuxtImg src="/images/faq-cover.jpg" alt="Konsultasi UMKM Jawa Barat" class="h-full w-full object-cover" loading="lazy" draggable="false" />
          </figure>
        </div>

        <div ref="content" class="col-span-full lg:col-span-5 lg:col-start-8">
          <div class="flex flex-col gap-10">
            <div class="flex flex-col gap-4">
              <UiBadge variant="outline" class="w-fit text-[10px] tracking-widest uppercase">FAQ</UiBadge>
              <h2 class="text-2xl font-semibold uppercase leading-tight tracking-tight lg:text-3xl">Seputar Tanya Jawab</h2>
            </div>

            <UiAccordion type="single" collapsible default-value="faq-0">
              <UiAccordionItem v-for="(item, i) in faqItems" :key="i" :value="`faq-${i}`">
                <UiAccordionTrigger class="text-left text-sm font-medium leading-snug hover:no-underline">
                  {{ item.question }}
                </UiAccordionTrigger>
                <UiAccordionContent>
                  <p class="text-sm leading-relaxed text-muted-foreground">{{ item.answer }}</p>
                  <NuxtLink to="/faq" class="mt-3 inline-block text-xs font-semibold text-primary hover:underline"> Selengkapnya → </NuxtLink>
                </UiAccordionContent>
              </UiAccordionItem>
            </UiAccordion>

            <p class="text-sm text-muted-foreground">
              Masih ada pertanyaan?
              <NuxtLink to="/faq" class="font-semibold text-primary hover:underline"> Kunjungi halaman FAQ lengkap </NuxtLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
