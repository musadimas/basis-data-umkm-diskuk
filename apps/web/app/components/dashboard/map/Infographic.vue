<script setup lang="ts">
import type { InfografisRegion } from "~/types/infografis";

const props = withDefaults(defineProps<{
  regions?: InfografisRegion[]
  geometryReady?: boolean
  geometrySource?: { name: string; edition: string; url: string; regions: number }
}>(), { regions: () => [], geometryReady: false, geometrySource: undefined });
const emit = defineEmits<{ select: [region: InfografisRegion] }>();
const mapped = computed(() => props.regions.filter((region) => region.geometry));
const clientReady = ref(false);
onNuxtReady(() => { clientReady.value = true; });
</script>
<template>
  <DashboardMapChoropleth
    v-if="clientReady && geometryReady && mapped.length === 27"
    :regions="mapped"
    @select="emit('select', $event)"
  />
  <div
    v-else-if="!clientReady"
    class="h-[430px] animate-pulse rounded-lg bg-muted"
    aria-label="Memuat peta Jawa Barat"
  />
  <p v-else class="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
    Peta belum tersedia karena geometri resmi belum lengkap. Data wilayah tetap tersedia dalam tabel.
  </p>
</template>
