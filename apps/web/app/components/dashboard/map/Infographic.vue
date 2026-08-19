<script setup lang="ts">
import type { InfografisRegion } from "~/types/infografis";

const props = withDefaults(defineProps<{
  regions?: InfografisRegion[]
  geometryReady?: boolean
  geometrySource?: { name: string; edition: string; url: string; regions: number }
}>(), { regions: () => [], geometryReady: false, geometrySource: undefined });
const emit = defineEmits<{ select: [region: InfografisRegion] }>();
const mapped = computed(() => props.regions.filter((region) => region.geometry));
</script>
<template>
  <ClientOnly v-if="geometryReady && mapped.length === 27">
    <DashboardMapChoropleth :regions="mapped" @select="emit('select', $event)" />
    <template #fallback>
      <div class="h-[430px] animate-pulse rounded-lg bg-muted" aria-label="Memuat peta Jawa Barat" />
    </template>
  </ClientOnly>
  <p v-else class="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
    Peta belum tersedia karena geometri resmi belum lengkap. Data wilayah tetap tersedia dalam tabel.
  </p>
</template>
