<script setup lang="ts">
defineProps<{
  title: string;
  subtitle: string;
  badgeColor?: string;
}>();
</script>

<template>
  <section
    id="page-header"
    class="relative isolate w-dvw pt-(--space-header) h-[40dvh] mb-20"
  >
    <div class="relative pb-8 pt-16 | lg:pb-16 lg:pt-20 h-full">
      <div
        class="max-w-screen-7xl mx-auto px-3 | lg:px-12 | xl:px-0 absolute bottom-0 left-1/2 -translate-x-1/2"
      >
        <div class="grid gap-8 | lg:grid-cols-12 lg:gap-16">
          <div
            class="grid-item col-span-full text-center | lg:col-span-8 lg:col-start-3"
          >
            <UiBadge :color="badgeColor" class="mb-4 | lg:mb-6">
              {{ subtitle }}
            </UiBadge>
            <h1
              class="font-bold uppercase leading-[0.9] text-balance text-7xl w-min mx-auto"
            >
              {{ title }}
            </h1>
          </div>
        </div>
      </div>
    </div>
    <div
      class="absolute top-0 -bottom-16 -inset-x-1/2 mask-[linear-gradient(black,transparent)] z-[-1] opacity-30 overflow-clip lg:inset-x-0"
    >
      <div class="overflow-hidden relative">
        <NuxtImg
          src="images/gedung-sate.webp"
          alt=""
          class="block size-full transform-gpu overflow-hidden object-cover object-top backface-hidden grayscale -translate-y-50"
        />
      </div>
      <div class="absolute inset-0 bg-black mix-blend-screen" />
    </div>
    <div
      class="absolute inset-y-0 inset-x-[-200vw] z-[-1] overflow-clip pt-48 -scale-y-100 mix-blend-multiply"
    >
      <div class="aspect-square rounded-full bg-blue-100 blur-[5rem]" />
    </div>
  </section>
</template>
