<script setup lang="ts">
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import { Users, Store } from '@lucide/vue'

gsap.registerPlugin(ScrollTrigger)

const OPOP_TARGET = 5021
const UMKM_TARGET = 13061

const opopCount = ref(0)
const umkmCount = ref(0)

const rootRef = useTemplateRef<HTMLElement>('root')
const badgeRef = useTemplateRef<HTMLElement>('badge')
const headingRef = useTemplateRef<HTMLElement>('heading')
const descRef = useTemplateRef<HTMLElement>('desc')
const ctaRef = useTemplateRef<HTMLElement>('cta')
const parallaxRef = useTemplateRef<HTMLElement>('parallax')
const statSectionRef = useTemplateRef<HTMLElement>('statSection')

const prefersReducedMotion = import.meta.client
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false

let ctx: gsap.Context

const { scrollTo } = useLenis()

function formatNumber(n: number) {
  return n.toLocaleString('id-ID')
}

onMounted(() => {
  if (prefersReducedMotion) {
    opopCount.value = OPOP_TARGET
    umkmCount.value = UMKM_TARGET
    return
  }

  ctx = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

    tl.from(badgeRef.value!, { y: 24, opacity: 0, duration: 0.5 })
      .from(
        Array.from(headingRef.value!.querySelector('h1')!.children),
        { y: 60, opacity: 0, duration: 0.8, stagger: 0.15 },
        '-=0.25',
      )
      .from(descRef.value!, { y: 20, opacity: 0, duration: 0.6 }, '-=0.4')
      .from(ctaRef.value!, { y: 16, opacity: 0, duration: 0.5 }, '-=0.35')

    gsap.to(parallaxRef.value!, {
      yPercent: -20,
      ease: 'none',
      scrollTrigger: {
        trigger: rootRef.value!,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    })

    const opopObj = { val: 0 }
    const umkmObj = { val: 0 }

    ScrollTrigger.create({
      trigger: statSectionRef.value!,
      start: 'top 80%',
      once: true,
      onEnter: () => {
        gsap.to(opopObj, {
          val: OPOP_TARGET,
          duration: 2,
          ease: 'power2.out',
          onUpdate() {
            opopCount.value = Math.round(opopObj.val)
          },
        })
        gsap.to(umkmObj, {
          val: UMKM_TARGET,
          duration: 2,
          ease: 'power2.out',
          onUpdate() {
            umkmCount.value = Math.round(umkmObj.val)
          },
        })
      },
    })
  }, rootRef.value!)
})

onUnmounted(() => ctx?.revert())
</script>

<template>
  <section
    ref="root"
    id="section-hero"
    aria-label="Beranda"
    class="relative isolate min-h-svh overflow-x-clip bg-sky-50 pt-16"
  >
    <div
      ref="parallax"
      class="pointer-events-none absolute inset-0 -z-10 h-[125%] w-full overflow-clip opacity-10 grayscale"
    >
      <NuxtImg
        src="/images/gedungsate.webp"
        alt=""
        aria-hidden="true"
        class="h-full w-full object-cover"
        loading="eager"
      />
    </div>

    <div class="mx-auto max-w-screen-2xl px-4 py-16 lg:px-8 lg:py-24">
      <div class="grid gap-8 lg:grid-cols-7">
        <div
          ref="statSection"
          class="col-span-full flex flex-col gap-4 lg:col-span-2 lg:row-start-1 lg:col-start-1"
        >
          <div class="grid grid-cols-2 gap-4">
            <UiCard
              class="aspect-square border-0 bg-sky-400 p-4 flex flex-col justify-between text-sky-950"
            >
              <div class="flex items-start gap-2">
                <Users class="size-6 shrink-0" aria-hidden="true" />
                <span class="text-[10px] font-semibold uppercase leading-tight tracking-wide">
                  Jumlah OPOP
                </span>
              </div>
              <span
                class="self-end text-3xl font-bold leading-none tabular-nums"
                :aria-label="`${OPOP_TARGET} OPOP`"
              >
                {{ formatNumber(opopCount) }}
              </span>
            </UiCard>

            <div class="aspect-square overflow-clip rounded-xl bg-amber-300">
              <NuxtImg
                src="/images/hero-1.jpg"
                alt="Pelaku UMKM Jawa Barat"
                class="h-full w-full object-cover"
                loading="eager"
                draggable="false"
              />
            </div>
          </div>
        </div>

        <div class="col-span-full flex flex-col items-center gap-8 text-center lg:col-span-3 lg:col-start-3 lg:my-16">
          <div ref="badge">
            <UiBadge variant="secondary" class="text-[10px] tracking-widest uppercase px-3 py-1">
              Selamat Datang
            </UiBadge>
          </div>

          <div ref="heading">
            <h1 class="text-[clamp(3.5rem,8vw,7.5rem)] font-extrabold uppercase leading-none tracking-tighter">
              <span class="block text-foreground">UMKM</span>
              <span class="block text-primary">BERDAYA SAING</span>
            </h1>
          </div>

          <p ref="desc" class="max-w-sm text-balance text-muted-foreground">
            Pelaku usaha yang memiliki karakteristik entrepreneur ditandai dengan semangat, sikap,
            perilaku, dan kemampuan dalam menangani usaha dan menciptakan nilai tambah.
          </p>

          <div ref="cta">
            <UiButton
              size="lg"
              variant="outline"
              class="rounded-full px-8"
              @click="scrollTo('#section-terms', { duration: 1.2 })"
            >
              Pelajari Selengkapnya
            </UiButton>
          </div>
        </div>

        <div class="col-span-full flex flex-col gap-4 lg:col-span-2 lg:row-start-1 lg:col-start-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="aspect-square overflow-clip rounded-xl bg-stone-200">
              <NuxtImg
                src="/images/hero-2.jpg"
                alt="Produk UMKM unggulan"
                class="h-full w-full object-cover"
                loading="eager"
                draggable="false"
              />
            </div>

            <UiCard
              class="aspect-square border-0 bg-slate-900 p-4 flex flex-col justify-between text-white"
            >
              <div class="flex items-start gap-2">
                <Store class="size-6 shrink-0 text-sky-400" aria-hidden="true" />
                <span class="text-[10px] font-semibold uppercase leading-tight tracking-wide text-white/80">
                  Jumlah UMKM
                </span>
              </div>
              <span
                class="self-end text-3xl font-bold leading-none tabular-nums"
                :aria-label="`${UMKM_TARGET} UMKM`"
              >
                {{ formatNumber(umkmCount) }}
              </span>
            </UiCard>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
