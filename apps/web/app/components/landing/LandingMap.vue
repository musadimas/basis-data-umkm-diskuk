<script setup lang="ts">
import gsap from 'gsap'
import { Map } from '@lucide/vue'

const rootRef = useTemplateRef<HTMLElement>('root')
const headerRef = useTemplateRef<HTMLElement>('header')
const placeholderRef = useTemplateRef<HTMLElement>('placeholder')
let ctx: gsap.Context

onMounted(() => {
  ctx = gsap.context(() => {
    gsap.from([headerRef.value!, placeholderRef.value!], {
      y: 30,
      opacity: 0,
      duration: 0.75,
      stagger: 0.15,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: rootRef.value!,
        start: 'top 80%',
        once: true,
      },
    })
  }, rootRef.value!)
})

onUnmounted(() => ctx?.revert())
</script>

<template>
  <section
    ref="root"
    id="section-map"
    role="region"
    aria-label="Sebaran UMKM Jawa Barat"
    class="relative isolate py-16 lg:py-24"
  >
    <div class="mx-auto max-w-screen-7xl px-4 lg:px-8">
      <div ref="header" class="mb-12 flex flex-col items-center gap-4 text-center">
        <UiBadge variant="outline" class="text-[10px] tracking-widest uppercase">
          UMKM Jawa Barat
        </UiBadge>
        <h2 class="text-2xl font-semibold uppercase leading-tight tracking-tight lg:text-3xl">
          Sebaran UMKM Jawa Barat
        </h2>
        <p class="max-w-md text-balance text-sm text-muted-foreground">
          Distribusi pelaku usaha mikro, kecil, dan menengah di seluruh kabupaten/kota Provinsi
          Jawa Barat.
        </p>
      </div>

      <div
        ref="placeholder"
        class="relative aspect-square overflow-clip rounded-2xl border border-border bg-muted lg:aspect-21/8"
        aria-label="Peta sebaran UMKM — akan segera tersedia"
      >
        <div class="flex h-full flex-col items-center justify-center gap-3 text-center">
          <Map class="size-12 text-muted-foreground/30" aria-hidden="true" />
          <p class="text-sm font-medium text-muted-foreground">Peta Sebaran UMKM</p>
          <p class="text-xs text-muted-foreground/60">Peta interaktif akan ditampilkan di sini</p>
        </div>

        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 opacity-[0.04]"
          style="
            background-image: radial-gradient(circle, currentColor 1px, transparent 1px);
            background-size: 24px 24px;
          "
        />
      </div>
    </div>
  </section>
</template>
