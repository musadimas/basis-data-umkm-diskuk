<script setup lang="ts">
import { ArrowRight, MapPin } from "@lucide/vue";
import type { Product } from "@/types/landing";

defineProps<{
  product: Product;
  href?: string;
}>();
</script>

<template>
  <a :href="href ?? '#'" class="group flex flex-col">
    <figure class="relative aspect-square shrink-0 overflow-clip rounded-xl bg-muted">
      <NuxtImg :src="product.image" :alt="product.name" class="size-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" draggable="false" />
    </figure>

    <div class="flex items-start gap-4 py-4 lg:pl-4">
      <!-- Arrow badge — desktop only, overlaps image bottom -->
      <div class="-mt-4 hidden size-9 -translate-y-1/2 shrink-0 items-center justify-center rounded-full bg-amber-400 transition-transform duration-300 group-hover:translate-x-1 lg:inline-flex" aria-hidden="true">
        <ArrowRight class="size-4 text-amber-900" />
      </div>

      <div class="flex min-w-0 grow flex-col gap-1.5">
        <p class="truncate text-xs font-semibold uppercase tracking-wide text-primary">
          {{ product.owner }}
        </p>
        <h3 class="line-clamp-1 text-balance text-sm font-medium leading-snug">
          {{ product.name }}
        </h3>
        <div class="flex items-center gap-1 text-muted-foreground">
          <MapPin class="size-3 shrink-0" aria-hidden="true" />
          <span class="truncate text-xs">{{ product.location }}</span>
        </div>
        <p v-if="product.price" class="text-sm font-semibold text-foreground">
          Rp{{ product.price.toLocaleString("id-ID") }}
        </p>
      </div>
    </div>
  </a>
</template>
