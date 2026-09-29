<script setup lang="ts">
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const OPOP_TARGET = 5021;
const UMKM_TARGET = 13061;

const opopCount = ref(0);
const umkmCount = ref(0);

const rootRef = useTemplateRef<HTMLElement>("root");
const badgeRef = useTemplateRef<HTMLElement>("badge");
const headingRef = useTemplateRef<HTMLElement>("heading");
const descRef = useTemplateRef<HTMLElement>("desc");
const ctaRef = useTemplateRef<HTMLElement>("cta");
const parallaxRef = useTemplateRef<HTMLElement>("parallax");
const statSectionRef = useTemplateRef<HTMLElement>("statSection");

const prefersReducedMotion = import.meta.client
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
  : false;

let ctx: gsap.Context;

const { scrollTo } = useLenis();

function formatNumber(n: number) {
  return n.toLocaleString("id-ID");
}

onMounted(() => {
  if (prefersReducedMotion) {
    opopCount.value = OPOP_TARGET;
    umkmCount.value = UMKM_TARGET;
    return;
  }

  ctx = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.from(badgeRef.value!, { y: 24, opacity: 0, duration: 0.5 })
      .from(
        Array.from(headingRef.value!.children),
        { y: 60, opacity: 0, duration: 0.8, stagger: 0.15 },
        "-=0.25",
      )
      .from(descRef.value!, { y: 20, opacity: 0, duration: 0.6 }, "-=0.4")
      .from(ctaRef.value!, { y: 16, opacity: 0, duration: 0.5 }, "-=0.35");

    gsap.to(parallaxRef.value!, {
      yPercent: -20,
      ease: "none",
      scrollTrigger: {
        trigger: rootRef.value!,
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });

    const opopObj = { val: 0 };
    const umkmObj = { val: 0 };

    ScrollTrigger.create({
      trigger: statSectionRef.value!,
      start: "top 80%",
      once: true,
      onEnter: () => {
        gsap.to(opopObj, {
          val: OPOP_TARGET,
          duration: 2,
          ease: "power2.out",
          onUpdate() {
            opopCount.value = Math.round(opopObj.val);
          },
        });
        gsap.to(umkmObj, {
          val: UMKM_TARGET,
          duration: 2,
          ease: "power2.out",
          onUpdate() {
            umkmCount.value = Math.round(umkmObj.val);
          },
        });
      },
    });
  }, rootRef.value!);
});

onUnmounted(() => ctx?.revert());
</script>

<template>
  <section
    id="section-hero"
    ref="root"
    aria-label="Beranda"
    class="relative isolate min-h-svh overflow-x-clip bg-sky-300 pt-16"
  >
    <!-- Parallax background -->
    <div
      ref="parallax"
      class="absolute inset-x-[-80%] top-0 -z-10 overflow-clip opacity-30 mask-[linear-gradient(black,transparent)] lg:inset-0"
      aria-hidden="true"
    >
      <NuxtImg
        src="/images/gedung-sate.webp"
        alt=""
        draggable="false"
        class="w-full object-contain grayscale lg:size-full lg:object-cover"
      />
      <div class="absolute inset-0 bg-sky-300 mix-blend-screen" />
    </div>

    <!-- Top blur ellipse decoration -->
    <div
      class="absolute inset-x-[-5vw] top-0 -z-20 aspect-video -translate-y-1/2 rounded-[100%] bg-slate-100 blur-[5rem]"
      aria-hidden="true"
    />

    <div class="relative py-16 lg:py-20">
      <div class="mx-auto max-w-screen-2xl px-3 2xl:px-0">
        <div class="relative">
          <!-- Stat & image cards -->
          <div
            ref="statSection"
            class="lg:absolute lg:inset-0 lg:flex lg:flex-col lg:justify-center"
          >
            <div
              class="grid -space-y-12 gap-3 lg:space-y-0 lg:grid-cols-7 2xl:gap-16"
            >
              <!-- Left column -->
              <div class="col-span-full lg:col-span-2">
                <div
                  class="grid grid-cols-2 gap-3 [&>*:nth-child(odd)]:mt-12 lg:gap-0 lg:[&>*:nth-child(odd)]:mt-0"
                >
                  <!-- OPOP stat card -->
                  <div class="relative">
                    <div
                      class="flex aspect-square flex-col justify-between rounded-xl bg-sky-400 p-4 lg:p-6"
                    >
                      <div class="flex items-center gap-2">
                        <SvgoOpop
                          class="size-7 shrink-0 text-sky-950"
                          :font-controlled="false"
                          aria-hidden="true"
                        />
                        <span
                          class="w-min text-[11px] font-semibold uppercase leading-tight tracking-wide text-sky-950"
                          >Jumlah OPOP</span
                        >
                      </div>
                      <span
                        class="self-end text-4xl font-bold leading-none tabular-nums text-sky-950"
                        :aria-label="`${OPOP_TARGET} OPOP`"
                      >
                        {{ formatNumber(opopCount) }}
                      </span>
                    </div>
                    <div
                      class="absolute left-full top-full hidden w-4/5 lg:block"
                      aria-hidden="true"
                    >
                      <div class="aspect-3/4 overflow-clip rounded-xl">
                        <NuxtImg
                          src="/images/kegiatan-umkm.jpg"
                          alt=""
                          draggable="false"
                          loading="lazy"
                          class="size-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                  <!-- Hero image card -->
                  <div class="relative">
                    <div
                      class="aspect-square overflow-clip rounded-xl bg-amber-300 lg:-translate-y-full"
                    >
                      <NuxtImg
                        src="/images/pelaku-umkm.jpg"
                        alt="Pelaku UMKM Jawa Barat"
                        draggable="false"
                        loading="lazy"
                        class="size-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right column -->
              <div class="col-span-full lg:col-span-2 lg:col-start-6">
                <div
                  class="grid grid-cols-2 gap-3 [&>*:nth-child(odd)]:mt-12 lg:gap-0 lg:[&>*:nth-child(odd)]:mt-0"
                >
                  <!-- Hero image card -->
                  <div class="relative">
                    <div
                      class="aspect-square overflow-clip rounded-xl bg-stone-200 lg:translate-y-full"
                    >
                      <NuxtImg
                        src="/images/pameran-umkm.jpg"
                        alt="Produk UMKM unggulan"
                        draggable="false"
                        loading="lazy"
                        class="size-full object-cover"
                      />
                    </div>
                  </div>
                  <!-- UMKM stat card -->
                  <div class="relative">
                    <div
                      class="flex aspect-square flex-col justify-between rounded-xl bg-slate-900 p-4 lg:p-6"
                    >
                      <div class="flex items-center gap-2">
                        <SvgoUmkm
                          class="size-7 shrink-0 text-sky-400"
                          :font-controlled="false"
                          aria-hidden="true"
                        />
                        <span
                          class="w-min text-[11px] font-semibold uppercase leading-tight tracking-wide text-white/80"
                          >Jumlah UMKM</span
                        >
                      </div>
                      <span
                        class="self-end text-4xl font-bold leading-none tabular-nums text-white"
                        :aria-label="`${UMKM_TARGET} UMKM`"
                      >
                        {{ formatNumber(umkmCount) }}
                      </span>
                    </div>
                    <div
                      class="absolute bottom-full right-full hidden w-4/5 lg:block"
                      aria-hidden="true"
                    >
                      <div class="aspect-square overflow-clip rounded-xl">
                        <NuxtImg
                          src="/images/pameran-umkm-2.jpg"
                          alt=""
                          draggable="false"
                          loading="lazy"
                          class="size-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Center text column -->
          <div
            class="relative mb-16 grid gap-8 lg:mb-0 lg:grid-cols-7 2xl:gap-16"
          >
            <div class="col-span-full text-center lg:col-span-3 lg:col-start-3">
              <div class="flex flex-col items-center gap-8 lg:my-16">
                <div class="flex flex-col items-center gap-4 lg:gap-6">
                  <span
                    ref="badge"
                    class="inline-flex items-center rounded-full bg-sky-100/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-sky-800"
                  >
                    Selamat Datang
                  </span>
                  <h1
                    ref="heading"
                    class="font-extrabold uppercase leading-[0.85] tracking-tighter text-[clamp(4.5rem,9vw,9rem)]"
                  >
                    <span class="block lg:ml-[-8vw]">UMKM</span>
                    <span class="block lg:ml-[8vw]">BERDAYA SAING</span>
                  </h1>
                </div>
                <p ref="desc" class="text-balance text-sky-950/80 w-full">
                  Pelaku usaha yang sudah memiliki karakteristik wirausaha
                  ditandai dengan semangat, sikap, perilaku, dan kemampuan dalam
                  menangani usaha.
                </p>
                <div ref="cta">
                  <UiButton
                    variant="outline"
                    class="rounded-full bg-transparent! py-3 border-black relative group overflow-hidden"
                    @click="scrollTo('#section-terms', { duration: 1.2 })"
                    ><span
                      class="relative z-10 font-semibold transition-colors duration-300 ease-in-out group-hover:text-white"
                    >
                      Pelajari Selengkapnya
                    </span>
                    <div
                      class="w-[full]! scale-150 aspect-square rounded-full bg-black absolute inset-x-0 top-0 translate-y-[200%] group-hover:translate-y-0 transition-transform duration-500 ease-in-out"
                      aria-hidden="true"
                    />
                  </UiButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
