<script setup lang="ts">
import { formatAnalyticsNumber } from "~/lib/analytics-format";
import type { InfografisRegion } from "~/types/infografis";

const props = withDefaults(defineProps<{
  regions?: InfografisRegion[]
  geometryReady?: boolean
  geometrySource?: { name: string; edition: string; url: string; regions: number }
}>(), { regions: () => [], geometryReady: false, geometrySource: undefined });
const emit = defineEmits<{ select: [region: InfografisRegion] }>();
const sorted = computed(() => [...props.regions].sort((a, b) => b.value - a.value));
const mapped = computed(() => props.regions.filter((region) => region.geometry));
</script>
<template>
  <section class="rounded-xl border bg-muted/20 p-4" aria-labelledby="authoritative-map-title">
    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="authoritative-map-title" class="font-bold">Wilayah kabupaten/kota</h2>
        <p v-if="geometryReady && geometrySource" class="text-xs text-muted-foreground">
          27 batas resmi · {{ geometrySource.name }} · edisi {{ geometrySource.edition }}
        </p>
        <p v-else class="text-xs text-muted-foreground">
          Geometri ditampilkan setelah kode dan batas 27 wilayah lulus pemeriksaan.
        </p>
      </div>
      <NuxtLink to="/dashboard/analitik" class="text-sm font-semibold underline">Buka Analitik</NuxtLink>
    </div>

    <ClientOnly v-if="geometryReady && mapped.length === 27">
      <DashboardMapChoropleth :regions="mapped" @select="emit('select', $event)" />
      <template #fallback>
        <div class="h-[430px] animate-pulse rounded-lg bg-muted" aria-label="Memuat peta Jawa Barat" />
      </template>
    </ClientOnly>
    <p v-else class="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
      Peta belum tersedia karena geometri resmi belum lengkap. Data wilayah tetap tersedia dalam tabel.
    </p>

    <details v-if="regions.length" class="mt-4">
      <summary class="cursor-pointer text-sm font-semibold">Lihat tabel data wilayah</summary>
      <div class="mt-2 max-h-80 overflow-auto rounded-lg border bg-background">
        <table class="w-full text-left text-sm">
          <caption class="sr-only">Sebaran UMKM per wilayah</caption>
          <thead class="sticky top-0 bg-background"><tr class="border-b"><th class="p-2">Wilayah</th><th class="p-2 text-right">Jumlah UMKM</th><th class="p-2">Tindakan</th></tr></thead>
          <tbody><tr v-for="region in sorted" :key="region.id" class="border-b"><th scope="row" class="p-2">{{ region.name }}</th><td class="p-2 text-right">{{ formatAnalyticsNumber(region.value) }}</td><td class="p-2"><button type="button" class="font-semibold underline" @click="emit('select', region)">Gunakan filter</button></td></tr></tbody>
        </table>
      </div>
    </details>
    <a v-if="geometrySource" :href="geometrySource.url" target="_blank" rel="noreferrer" class="mt-3 inline-block text-xs text-muted-foreground underline">
      Sumber geometri: {{ geometrySource.name }}
    </a>
  </section>
</template>
