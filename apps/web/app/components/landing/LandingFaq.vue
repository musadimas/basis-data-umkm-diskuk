<script setup lang="ts">
import gsap from "gsap";
import { Minus, Plus } from "@lucide/vue";
import type { FaqItem } from "@/types/landing";

const faqItems: FaqItem[] = [
  {
    question: "Apa itu Program UMKM Naik Kelas?",
    answer:
      "Program UMKM Naik Kelas mentargetkan peserta dari pengusaha di Jawa Barat yang berkomitmen untuk maju dan berkembang di bidang bisnis. Manfaat yang didapatkan adalah penguatan diri, manajemen usaha untuk bisa naik kelas, dan pemanfaatan teknologi informasi untuk mencapai pasar yang lebih luas.",
  },
  {
    question: "Batas waktu dan cara mendaftar?",
    answer:
      "Untuk tahap awal pendaftaran di tahun 2025, silakan mengunjungi Dinas KUMKM Kab./Kota sesuai domisili untuk direkomendasikan ke tenaga pendamping di wilayahnya hingga bulan Mei 2025. Program dilaksanakan bulan Juni s.d. November 2025.",
  },
  {
    question: "Apakah bisa dibantu mendaftar secara online?",
    answer:
      "Ya, jika Anda tidak memiliki akses internet atau mengalami kesulitan teknis, Anda bisa datang langsung ke Dinas KUMKM Kab./Kota sesuai domisili untuk mendapatkan bantuan proses pendaftaran.",
  },
  {
    question: "Persyaratan Program UMKM Naik Kelas Bagi Pengusaha",
    answer:
      "Penduduk Jawa Barat; minimal usia 20 tahun dan maksimal usia 40 tahun; memiliki motivasi tinggi dan terbiasa menggunakan sarana digital; omzet usaha lebih dari Rp100.000.000/tahun; memiliki NIB; memiliki usaha minimal 2 tahun.",
  },
  {
    question: "Persyaratan Program UMKM Naik Kelas Bagi Pendamping",
    answer:
      "Warga Jawa Barat (KTP); usia 20–50 tahun; sehat jasmani dan rohani; bukan ASN; tidak menjadi pengurus partai politik; memiliki kemampuan dan/atau terbiasa menggunakan sarana digital; bersedia melakukan kunjungan lapangan ke tempat UMKM.",
  },
  {
    question:
      "Dimanakah lokasi Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat?",
    answer: "Jalan Soekarno-Hatta No. 705 Kota Bandung.",
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
  <section
    id="section-faq"
    ref="root"
    role="region"
    aria-label="Pertanyaan yang Sering Diajukan"
    class="relative isolate overflow-x-clip py-16 lg:py-20"
  >
    <div class="mx-auto max-w-7xl px-3 lg:px-12 xl:px-0">
      <div class="grid gap-8 lg:grid-cols-12 lg:gap-16">
        <!-- Image — bleeds to left viewport edge on xl+ -->
        <div ref="image" class="hidden lg:col-span-6 lg:col-start-1 lg:block">
          <div class="relative h-full lg:-ml-12 xl:-ml-[calc((100vw-80rem)/2)]">
            <figure
              class="relative aspect-square size-full overflow-clip rounded-xl bg-muted lg:rounded-r-xl rounded-l-none! 2xl:aspect-4/3.5"
            >
              <NuxtImg
                src="/images/pameran-umkm.jpg"
                alt="Konsultasi UMKM Jawa Barat"
                class="size-full object-cover"
                loading="lazy"
                draggable="false"
              />
            </figure>
            <div
              class="absolute right-0 top-0 -z-1 aspect-square h-2/3 -translate-y-1/4 translate-x-1/4 rounded-full bg-sky-200 blur-3xl"
              aria-hidden="true"
            />
          </div>
        </div>

        <!-- Content -->
        <div ref="content" class="col-span-full lg:col-span-5 lg:col-start-8">
          <div class="flex flex-col gap-8 lg:h-full lg:gap-16">
            <div
              class="flex flex-col items-center gap-4 text-center lg:items-start lg:gap-6 lg:text-start"
            >
              <span
                class="inline-flex items-center rounded-full bg-amber-100 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-800"
                >FAQ</span
              >
              <h2
                class="text-balance text-5xl font-semibold uppercase leading-none"
              >
                Seputar Tanya Jawab
              </h2>
            </div>

            <div class="mt-auto flex flex-col gap-8 lg:gap-16">
              <UiAccordion
                type="single"
                collapsible
                default-value="faq-0"
                class="divide-y divide-foreground/10"
              >
                <UiAccordionItem
                  v-for="(item, i) in faqItems"
                  :key="i"
                  :value="`faq-${i}`"
                  class="py-6 first:pt-0 last:pb-0"
                >
                  <UiAccordionTrigger
                    class="py-0 hover:no-underline [&>svg:last-child]:hidden cursor-pointer"
                  >
                    <div class="flex w-full items-baseline gap-4 text-left">
                      <span
                        class="grow text-balance text-xl font-bold transition-colors duration-300 in-data-[state=open]:text-primary"
                      >
                        {{ item.question }}
                      </span>
                      <Minus
                        class="size-3.5 shrink-0 text-primary in-data-[state=closed]:hidden"
                        aria-hidden="true"
                      />
                      <Plus
                        class="size-3.5 shrink-0 text-primary in-data-[state=open]:hidden"
                        aria-hidden="true"
                      />
                    </div>
                  </UiAccordionTrigger>
                  <UiAccordionContent class="pb-0!">
                    <div class="flex flex-col items-start gap-2 pt-4">
                      <p
                        class="line-clamp-3 text-balance text-sm leading-relaxed text-muted-foreground"
                      >
                        {{ item.answer }}
                      </p>

                      <UiButton
                        variant="ghost"
                        size="sm"
                        as-child
                        class="group relative bg-transparent hover:bg-transparent px-0!"
                      >
                        <NuxtLink to="/faq" class="font-semibold">
                          Selengkapnya
                          <span
                            class="absolute inset-x-0 bottom-1 h-0.5 origin-left scale-x-0 bg-blue-500 transition-transform duration-300 group-hover:scale-x-100"
                            aria-hidden="true"
                          />
                        </NuxtLink>
                      </UiButton>
                    </div>
                  </UiAccordionContent>
                </UiAccordionItem>
              </UiAccordion>

              <div
                class="flex items-center justify-between gap-6 lg:justify-center"
              >
                <p class="text-sm text-muted-foreground">Butuh Bantuan?</p>
                <UiButton
                  variant="outline"
                  class="rounded-full py-3 border-blue-500 relative group overflow-hidden"
                  as="a"
                  href="/faq"
                  ><span
                    class="relative z-10 font-semibold transition-colors duration-300 ease-in-out group-hover:text-white"
                    >Selengkapnya</span
                  >
                  <div
                    class="w-[full]! scale-150 aspect-square rounded-full bg-blue-500 absolute inset-x-0 top-0 translate-y-[200%] group-hover:translate-y-0 transition-transform duration-500 ease-in-out"
                    aria-hidden="true"
                  />
                </UiButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
