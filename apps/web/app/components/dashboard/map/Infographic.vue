<script setup lang="ts">
import type { InfografisRegion } from "~/types/infografis";

const props = withDefaults(defineProps<{
  regions?: InfografisRegion[]
  regionLevel?: "kota" | "kecamatan" | "kelurahan"
  geometryReady?: boolean
  geometryMissing?: number
  geometrySource?: { name: string; edition: string; url: string; regions: number }
  canGoBack?: boolean
}>(), {
  regions: () => [],
  regionLevel: "kota",
  geometryReady: false,
  geometryMissing: 0,
  geometrySource: undefined,
  canGoBack: false,
});
const emit = defineEmits<{ select: [region: InfografisRegion]; back: [] }>();
const mapped = computed(() => props.regions.filter((region) => region.geometry));
const levelLabel = computed(() => ({
  kota: "Kabupaten/Kota",
  kecamatan: "Kecamatan",
  kelurahan: "Desa/Kelurahan",
})[props.regionLevel]);
const clientReady = ref(false);
onNuxtReady(() => { clientReady.value = true; });
</script>
<template>
  <div class="space-y-2">
    <div class="flex min-h-8 items-center justify-between gap-3 text-sm">
      <button
        v-if="canGoBack"
        type="button"
        class="rounded-md border px-3 py-1.5 font-medium hover:bg-muted"
        @click="emit('back')"
      >
        ← Kembali
      </button>
      <span class="ml-auto text-muted-foreground">Level: {{ levelLabel }}</span>
    </div>
    <DashboardMapChoropleth
      v-if="clientReady && geometryReady && mapped.length > 0"
      :regions="mapped"
      :level="regionLevel"
      @select="emit('select', $event)"
    />
    <div
      v-else-if="!clientReady"
      class="h-[430px] animate-pulse rounded-lg bg-muted"
      aria-label="Memuat peta Jawa Barat"
    />
    <p v-else class="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
      Peta belum tersedia karena geometri wilayah belum tersedia. Data wilayah tetap tersedia melalui filter.
    </p>
    <p
      v-if="geometryMissing > 0"
      class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs"
    >
      {{ geometryMissing }} wilayah pada hasil ini belum memiliki geometri yang cocok dan tidak digambar di peta.
    </p>
  </div>
</template>
