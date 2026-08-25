<script setup lang="ts">
import { CircleHelp } from "@lucide/vue";
import type { InfografisRegion } from "~/types/infografis";
import type { SpasialUmkmItem } from "~/types/dashboard";

const props = withDefaults(
  defineProps<{
    /** Judul section (crumb pertama pada breadcrumb). */
    title: string;
    /** Teks tooltip informasi section. */
    tooltip?: string;
    /** Wilayah yang sedang dipilih (crumb kedua), mis. "Bandung". */
    selection: string;
    regions?: InfografisRegion[];
    regionLevel?: "kota" | "kecamatan" | "kelurahan";
    geometryReady?: boolean;
    geometryMissing?: number;
    geometrySource?: {
      name: string;
      edition: string;
      url: string;
      regions: number;
    };
    canGoBack?: boolean;
    /** Titik UMKM untuk layer sebaran titik (clustered). */
    points?: SpasialUmkmItem[];
    /** Saklar tampil/sembunyi poligon wilayah (v-model:show-regions). */
    showRegions?: boolean;
    /** Saklar tampil/sembunyi titik UMKM (v-model:show-points). */
    showPoints?: boolean;
  }>(),
  {
    tooltip: "",
    regions: () => [],
    regionLevel: "kota",
    geometryReady: false,
    geometryMissing: 0,
    geometrySource: undefined,
    canGoBack: false,
    points: () => [],
    showRegions: true,
    showPoints: false,
  },
);
const emit = defineEmits<{
  select: [region: InfografisRegion];
  back: [];
  "update:showRegions": [value: boolean];
  "update:showPoints": [value: boolean];
}>();
const mapped = computed(() =>
  props.regions.filter((region) => region.geometry),
);
const clientReady = ref(false);
onNuxtReady(() => {
  clientReady.value = true;
});
</script>
<template>
  <div class="space-y-2">
    <!-- Breadcrumb: judul section (atas) › wilayah terpilih (bawah). Klik untuk kembali satu level. -->
    <div
      class="absolute left-3 top-3 z-[6] flex w-fit flex-col gap-1 rounded-xl border bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-xs"
      :class="canGoBack ? 'cursor-pointer hover:bg-slate-50' : ''"
      :role="canGoBack ? 'button' : undefined"
      :tabindex="canGoBack ? 0 : undefined"
      :aria-label="canGoBack ? 'Kembali ke level sebelumnya' : undefined"
      @click="canGoBack && emit('back')"
      @keydown.enter="canGoBack && emit('back')"
    >
      <div class="flex items-center gap-1.5">
        <span class="font-bold text-slate-800">{{ title }}</span>
        <UiTooltipProvider v-if="tooltip">
          <UiTooltip>
            <UiTooltipTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                :aria-label="`Informasi tentang ${title}`"
                @click.stop
              >
                <CircleHelp class="h-3.5 w-3.5" />
              </button>
            </UiTooltipTrigger>
            <UiTooltipContent
              class="text-justify max-w-2xs text-xs font-normal"
            >
              <p>{{ tooltip }}</p>
            </UiTooltipContent>
          </UiTooltip>
        </UiTooltipProvider>
      </div>
      <div class="flex items-center gap-1 text-muted-foreground">
        <span class="text-slate-400" aria-hidden="true">›</span>
        <span class="font-medium">{{ selection }}</span>
      </div>
    </div>
    <DashboardMapChoropleth
      v-if="clientReady && geometryReady && mapped.length > 0"
      :regions="mapped"
      :level="regionLevel"
      :points="points"
      :show-regions="showRegions"
      :show-points="showPoints"
      @update:show-regions="emit('update:showRegions', $event)"
      @update:show-points="emit('update:showPoints', $event)"
      @select="emit('select', $event)"
    />
    <div
      v-else-if="!clientReady"
      class="h-[480px] animate-pulse rounded-lg bg-muted lg:h-[620px]"
      aria-label="Memuat peta Jawa Barat"
    />
    <p
      v-else
      class="m-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm"
    >
      Peta belum tersedia karena geometri wilayah belum tersedia. Data wilayah
      tetap tersedia melalui filter.
    </p>
    <p
      v-if="geometryMissing > 0"
      class="mx-3 mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs"
    >
      {{ geometryMissing }} wilayah pada hasil ini belum memiliki geometri yang
      cocok dan tidak digambar di peta.
    </p>
  </div>
</template>
