<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <main class="grid min-h-svh bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
    <section class="relative min-h-[18rem] overflow-hidden bg-sky-400 sm:min-h-[24rem] lg:min-h-svh" aria-label="Gedung Sate, Jawa Barat">
      <NuxtImg src="/images/gedung-sate.webp" alt="Gedung Sate, pusat pemerintahan Provinsi Jawa Barat" sizes="100vw lg:55vw" class="absolute inset-0 size-full object-cover grayscale" />
      <div class="absolute inset-0 bg-sky-500/55 mix-blend-multiply" aria-hidden="true" />
      <div class="absolute inset-0 bg-linear-to-t from-sky-950 via-sky-800/45 to-sky-300/10" aria-hidden="true" />

      <div class="relative flex h-full min-h-[18rem] flex-col justify-between p-6 text-white sm:min-h-[24rem] sm:p-10 lg:min-h-svh lg:p-12 xl:p-16">
        <span class="text-xs font-bold uppercase tracking-[0.18em] text-white/80">Pemerintah Provinsi Jawa Barat</span>

        <div class="max-w-xl">
          <p class="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-sky-200">Basis Data UMKM Jawa Barat</p>
          <h2 class="max-w-lg text-3xl font-bold leading-tight tracking-tight sm:text-4xl xl:text-5xl">Data yang terhubung untuk UMKM yang lebih berdaya saing.</h2>
        </div>
      </div>
    </section>

    <section class="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-20" :aria-label="label">
      <div class="flex w-full max-w-md flex-col">
        <NuxtLink to="/" class="mb-8 self-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" aria-label="Kembali ke beranda DISKUK Jawa Barat">
          <NuxtImg src="/images/diskuk-jabar-logo.png" alt="DISKUK Jawa Barat" width="125" height="87" class="h-16 w-auto object-contain" />
        </NuxtLink>
        <slot />
      </div>
    </section>
  </main>
</template>
