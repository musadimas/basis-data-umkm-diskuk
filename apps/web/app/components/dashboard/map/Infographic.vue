<script setup lang="ts">
import { Filter, Plus, Minus, RotateCcw } from "@lucide/vue";

interface RegionData {
  id: string;
  name: string;
  type: "Kabupaten" | "Kota";
  count: number;
  tier: 1 | 2 | 3 | 4 | 5;
  colorClass: string;
  cx: number;
  cy: number;
  r: number;
  d: string;
}

const emit = defineEmits<{
  (e: "filter:click"): void;
  (e: "region:select", region: RegionData): void;
}>();

// Zoom & Pan state
const zoomLevel = ref(1);
const hoveredRegion = ref<RegionData | null>(null);
const selectedFilter = ref("Semua");
const isFilterOpen = ref(false);

const zoomIn = () => {
  if (zoomLevel.value < 2)
    zoomLevel.value = Number((zoomLevel.value + 0.25).toFixed(2));
};

const zoomOut = () => {
  if (zoomLevel.value > 0.8)
    zoomLevel.value = Number((zoomLevel.value - 0.25).toFixed(2));
};

const resetZoom = () => {
  zoomLevel.value = 1;
};

// West Java choropleth regions (SVG paths matching Jawa Barat geography)
const regions = ref<RegionData[]>([
  {
    id: "bekasi",
    name: "Kabupaten & Kota Bekasi",
    type: "Kabupaten",
    count: 540200,
    tier: 1,
    colorClass: "fill-cyan-700 hover:fill-cyan-600",
    cx: 260,
    cy: 165,
    r: 12,
    d: "M 230 140 L 290 140 L 295 185 L 260 200 L 230 185 Z",
  },
  {
    id: "karawang",
    name: "Kabupaten Karawang",
    type: "Kabupaten",
    count: 365800,
    tier: 2,
    colorClass: "fill-blue-600 hover:fill-blue-500",
    cx: 335,
    cy: 175,
    r: 14,
    d: "M 290 140 L 375 145 L 370 205 L 295 185 Z",
  },
  {
    id: "subang",
    name: "Kabupaten Subang",
    type: "Kabupaten",
    count: 320400,
    tier: 2,
    colorClass: "fill-blue-600 hover:fill-blue-500",
    cx: 415,
    cy: 185,
    r: 14,
    d: "M 375 145 L 455 155 L 440 220 L 370 205 Z",
  },
  {
    id: "indramayu",
    name: "Kabupaten Indramayu",
    type: "Kabupaten",
    count: 420900,
    tier: 2,
    colorClass: "fill-blue-600 hover:fill-blue-500",
    cx: 510,
    cy: 175,
    r: 16,
    d: "M 455 155 L 565 185 L 530 235 L 440 220 Z",
  },
  {
    id: "cirebon",
    name: "Kabupaten & Kota Cirebon",
    type: "Kabupaten",
    count: 485100,
    tier: 2,
    colorClass: "fill-blue-600 hover:fill-blue-500",
    cx: 580,
    cy: 235,
    r: 12,
    d: "M 565 185 L 635 220 L 610 270 L 530 235 Z",
  },
  {
    id: "bogor",
    name: "Kabupaten & Kota Bogor",
    type: "Kabupaten",
    count: 620500,
    tier: 1,
    colorClass: "fill-cyan-700 hover:fill-cyan-600",
    cx: 215,
    cy: 230,
    r: 16,
    d: "M 175 180 L 255 190 L 250 270 L 170 260 Z",
  },
  {
    id: "depok",
    name: "Kota Depok",
    type: "Kota",
    count: 275000,
    tier: 3,
    colorClass: "fill-emerald-500 hover:fill-emerald-400",
    cx: 215,
    cy: 170,
    r: 8,
    d: "M 205 160 L 230 160 L 230 185 L 205 185 Z",
  },
  {
    id: "purwakarta",
    name: "Kabupaten Purwakarta",
    type: "Kabupaten",
    count: 185600,
    tier: 3,
    colorClass: "fill-emerald-500 hover:fill-emerald-400",
    cx: 345,
    cy: 235,
    r: 10,
    d: "M 320 205 L 380 210 L 375 260 L 315 255 Z",
  },
  {
    id: "sukabumi",
    name: "Kabupaten & Kota Sukabumi",
    type: "Kabupaten",
    count: 290100,
    tier: 3,
    colorClass: "fill-emerald-500 hover:fill-emerald-400",
    cx: 200,
    cy: 330,
    r: 20,
    d: "M 150 260 L 245 270 L 240 400 L 150 380 Z",
  },
  {
    id: "cianjur",
    name: "Kabupaten Cianjur",
    type: "Kabupaten",
    count: 245000,
    tier: 3,
    colorClass: "fill-emerald-500 hover:fill-emerald-400",
    cx: 285,
    cy: 310,
    r: 18,
    d: "M 245 250 L 320 255 L 330 395 L 240 400 Z",
  },
  {
    id: "bandung_raya",
    name: "Bandung Raya (Kota & Kab & KBB)",
    type: "Kabupaten",
    count: 750000,
    tier: 1,
    colorClass: "fill-cyan-700 hover:fill-cyan-600",
    cx: 370,
    cy: 295,
    r: 16,
    d: "M 320 255 L 420 260 L 410 335 L 330 330 Z",
  },
  {
    id: "sumedang",
    name: "Kabupaten Sumedang",
    type: "Kabupaten",
    count: 145000,
    tier: 3,
    colorClass: "fill-emerald-500 hover:fill-emerald-400",
    cx: 440,
    cy: 260,
    r: 12,
    d: "M 420 220 L 490 235 L 475 295 L 410 280 Z",
  },
  {
    id: "majalengka",
    name: "Kabupaten Majalengka",
    type: "Kabupaten",
    count: 198000,
    tier: 3,
    colorClass: "fill-emerald-500 hover:fill-emerald-400",
    cx: 515,
    cy: 275,
    r: 13,
    d: "M 490 235 L 565 250 L 545 320 L 475 295 Z",
  },
  {
    id: "kuningan",
    name: "Kabupaten Kuningan",
    type: "Kabupaten",
    count: 95400,
    tier: 4,
    colorClass: "fill-yellow-400 hover:fill-yellow-300",
    cx: 585,
    cy: 310,
    r: 11,
    d: "M 565 250 L 635 270 L 615 350 L 545 320 Z",
  },
  {
    id: "garut",
    name: "Kabupaten Garut",
    type: "Kabupaten",
    count: 310200,
    tier: 2,
    colorClass: "fill-blue-600 hover:fill-blue-500",
    cx: 410,
    cy: 375,
    r: 18,
    d: "M 330 330 L 445 335 L 455 425 L 330 395 Z",
  },
  {
    id: "tasikmalaya",
    name: "Kabupaten & Kota Tasikmalaya",
    type: "Kabupaten",
    count: 285400,
    tier: 3,
    colorClass: "fill-emerald-500 hover:fill-emerald-400",
    cx: 495,
    cy: 380,
    r: 16,
    d: "M 445 335 L 540 330 L 530 435 L 455 425 Z",
  },
  {
    id: "ciamis",
    name: "Kabupaten Ciamis & Kota Banjar",
    type: "Kabupaten",
    count: 165000,
    tier: 3,
    colorClass: "fill-emerald-500 hover:fill-emerald-400",
    cx: 565,
    cy: 365,
    r: 14,
    d: "M 540 330 L 620 350 L 595 420 L 530 405 Z",
  },
  {
    id: "pangandaran",
    name: "Kabupaten Pangandaran",
    type: "Kabupaten",
    count: 42300,
    tier: 5,
    colorClass: "fill-orange-400 hover:fill-orange-300",
    cx: 580,
    cy: 430,
    r: 10,
    d: "M 530 405 L 610 415 L 620 455 L 530 445 Z",
  },
]);

const formatNumber = (val: number) => {
  return new Intl.NumberFormat("id-ID").format(val);
};

const handleFilterSelect = (filter: string) => {
  selectedFilter.value = filter;
  isFilterOpen.value = false;
};
</script>

<template>
  <div
    class="relative overflow-hidden rounded-xl border border-slate-200 bg-[#cce3f0] dark:bg-slate-900 shadow-xs"
  >
    <!-- Map Control Buttons (Top Left) -->
    <div
      class="absolute left-4 top-4 z-20 flex flex-col gap-1.5 rounded-lg bg-white/95 p-1 shadow-md backdrop-blur-xs"
    >
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded text-slate-700 transition-colors hover:bg-slate-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label="Perbesar peta"
        @click="zoomIn"
      >
        <Plus class="h-4 w-4" />
      </button>
      <div class="h-px bg-slate-200" />
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded text-slate-700 transition-colors hover:bg-slate-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label="Perkecil peta"
        @click="zoomOut"
      >
        <Minus class="h-4 w-4" />
      </button>
      <button
        v-if="zoomLevel !== 1"
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-foreground"
        aria-label="Reset zoom peta"
        @click="resetZoom"
      >
        <RotateCcw class="h-3 w-3" />
      </button>
    </div>

    <!-- Filter Data Button (Top Right) -->
    <div class="absolute right-4 top-4 z-20">
      <UiDropdownMenu v-model:open="isFilterOpen">
        <UiDropdownMenuTrigger as-child>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Filter class="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Filter Data</span>
          </button>
        </UiDropdownMenuTrigger>
        <UiDropdownMenuContent align="end" class="w-48">
          <UiDropdownMenuLabel>Filter Skala Usaha</UiDropdownMenuLabel>
          <UiDropdownMenuSeparator />
          <UiDropdownMenuItem @click="handleFilterSelect('Semua')"
            >Semua Wilayah</UiDropdownMenuItem
          >
          <UiDropdownMenuItem @click="handleFilterSelect('≥ 500.000')"
            >Kepadatan Tinggi (≥ 500k)</UiDropdownMenuItem
          >
          <UiDropdownMenuItem @click="handleFilterSelect('100.000 - 499.000')"
            >Kepadatan Sedang</UiDropdownMenuItem
          >
          <UiDropdownMenuItem @click="handleFilterSelect('< 100.000')"
            >Kepadatan Rendah</UiDropdownMenuItem
          >
        </UiDropdownMenuContent>
      </UiDropdownMenu>
    </div>

    <!-- Interactive SVG Map Canvas -->
    <div
      class="relative h-[340px] sm:h-[380px] lg:h-[400px] w-full cursor-grab active:cursor-grabbing overflow-hidden"
    >
      <div
        class="h-full w-full transition-transform duration-300 ease-out flex items-center justify-center"
        :class="[
          zoomLevel === 1.25 ? 'scale-125' : '',
          zoomLevel === 1.5 ? 'scale-150' : '',
          zoomLevel === 1.75 ? 'scale-175' : '',
          zoomLevel === 2 ? 'scale-200' : '',
          zoomLevel === 0.75 ? 'scale-75' : '',
        ]"
      >
        <svg
          viewBox="100 110 580 370"
          class="h-full w-full max-w-5xl select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <!-- Water Pattern -->
            <pattern
              id="water-dots"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="0.8" class="fill-slate-400/20" />
            </pattern>
          </defs>

          <!-- Water Background Fill -->
          <rect x="0" y="0" width="800" height="600" fill="url(#water-dots)" />

          <!-- Surrounding Provinces (Muted Land) -->
          <!-- Banten (West) -->
          <path
            d="M 60 140 L 175 180 L 170 260 L 150 260 L 120 310 L 60 300 Z"
            class="fill-slate-200/80 stroke-slate-300 dark:fill-slate-800/80 dark:stroke-slate-700"
            stroke-width="1.5"
          />
          <text
            x="110"
            y="210"
            class="fill-slate-500 font-medium text-[11px] select-none"
          >
            BANTEN
          </text>

          <!-- DKI Jakarta -->
          <path
            d="M 180 140 L 230 140 L 230 170 L 180 170 Z"
            class="fill-amber-200/90 stroke-amber-400 dark:fill-amber-950/70"
            stroke-width="1.5"
          />
          <text
            x="185"
            y="160"
            class="fill-amber-900 font-bold text-[10px] select-none"
          >
            Jakarta
          </text>

          <!-- Jawa Tengah (East) -->
          <path
            d="M 610 220 L 720 220 L 740 460 L 610 415 Z"
            class="fill-slate-200/80 stroke-slate-300 dark:fill-slate-800/80 dark:stroke-slate-700"
            stroke-width="1.5"
          />
          <text
            x="640"
            y="290"
            class="fill-slate-500 font-medium text-[11px] select-none"
          >
            JAWA TENGAH
          </text>

          <!-- West Java Regions (Choropleth Paths) -->
          <g class="transition-all">
            <path
              v-for="region in regions"
              :key="region.id"
              :d="region.d"
              class="cursor-pointer stroke-white/90 stroke-1.5 transition-all duration-200 dark:stroke-slate-900"
              :class="[
                region.colorClass,
                hoveredRegion?.id === region.id
                  ? 'stroke-white stroke-2.5 filter drop-shadow-md brightness-110'
                  : '',
              ]"
              @mouseenter="hoveredRegion = region"
              @mouseleave="hoveredRegion = null"
              @click="emit('region:select', region)"
            />
          </g>

          <!-- Regional Text Labels -->
          <g class="pointer-events-none select-none">
            <text
              v-for="region in regions"
              :key="`label-${region.id}`"
              :x="region.cx"
              :y="region.cy"
              text-anchor="middle"
              class="fill-white font-bold text-[8.5px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
            >
              {{
                region.name
                  .replace("Kabupaten & Kota ", "")
                  .replace("Kabupaten ", "")
                  .replace("Kota ", "")
              }}
            </text>
          </g>
        </svg>
      </div>

      <!-- Hover Tooltip -->
      <div
        v-if="hoveredRegion"
        class="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-lg bg-slate-900/90 px-3.5 py-2 text-white shadow-xl backdrop-blur-xs transition-all z-30"
      >
        <div class="text-xs font-semibold">{{ hoveredRegion.name }}</div>
        <div class="text-[11px] text-emerald-400 font-medium">
          Total UMKM: {{ formatNumber(hoveredRegion.count) }}
        </div>
      </div>
    </div>

    <!-- Floating Legend Box (Bottom Left) -->
    <div
      class="absolute bottom-4 left-4 z-20 rounded-xl bg-white/95 p-3.5 shadow-lg backdrop-blur-xs border border-slate-100 max-w-[200px] sm:max-w-xs"
    >
      <div class="mb-2 text-xs font-bold text-slate-800">Jumlah UMKM</div>
      <div class="space-y-1.5 text-[11px] text-slate-600 font-medium">
        <div class="flex items-center gap-2">
          <span class="h-3 w-3 shrink-0 rounded-xs bg-cyan-700" />
          <span>&ge; 500.000</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-3 w-3 shrink-0 rounded-xs bg-blue-600" />
          <span>300.000 &ndash; 499.000</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-3 w-3 shrink-0 rounded-xs bg-emerald-500" />
          <span>100.000 &ndash; 300.000</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-3 w-3 shrink-0 rounded-xs bg-yellow-400" />
          <span>50.000 &ndash; 100.000</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-3 w-3 shrink-0 rounded-xs bg-orange-400" />
          <span>&lt; 50.000</span>
        </div>
      </div>
    </div>
  </div>
</template>
