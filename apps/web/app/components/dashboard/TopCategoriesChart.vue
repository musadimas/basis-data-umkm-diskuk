<script setup lang="ts">
import type { TopCategoryItem } from "~/types/dashboard";

interface Props {
  items?: TopCategoryItem[];
  buttonText?: string;
  buttonHref?: string;
}

const props = withDefaults(defineProps<Props>(), {
  buttonText: "Lihat Data",
  items: () => [
    { code: "G", name: "Perdagangan Besar dan Eceran", value: 2150000 },
    { code: "I", name: "Penyediaan Akomodasi dan Makan Minum", value: 1680000 },
    { code: "C", name: "Industri Pengolahan", value: 1350000 },
    { code: "S", name: "Aktivitas Jasa Lainnya", value: 890000 },
    { code: "H", name: "Pengangkutan dan Pergudangan", value: 520000 },
  ],
});

const emit = defineEmits<{
  (e: "click:action"): void;
}>();

const hoveredItem = ref<TopCategoryItem | null>(null);

const yAxisMarks = [
  { label: "2.500.000", val: 2500000 },
  { label: "2.000.000", val: 2000000 },
  { label: "1.500.000", val: 1500000 },
  { label: "1.000.000", val: 1000000 },
  { label: "500.000", val: 500000 },
  { label: "0", val: 0 },
];

const getHeightClass = (val: number) => {
  const pct = (val / 2500000) * 100;
  if (pct >= 85) return "h-5/6";
  if (pct >= 65) return "h-2/3";
  if (pct >= 50) return "h-1/2";
  if (pct >= 35) return "h-1/3";
  if (pct >= 20) return "h-1/5";
  return "h-1/6";
};
</script>

<template>
  <div class="flex h-full flex-col justify-between space-y-2">
    <!-- Chart Container -->
    <div class="relative pt-2">
      <!-- Grid + Bars Area -->
      <div class="flex h-32 items-end gap-3">
        <!-- Y-Axis Labels -->
        <div class="flex flex-col justify-between h-full pr-2 text-[10px] sm:text-xs text-muted-foreground font-mono select-none">
          <span v-for="mark in yAxisMarks" :key="mark.label" class="leading-none text-right">
            {{ mark.label }}
          </span>
        </div>

        <!-- Chart Grid & Bars -->
        <div class="relative flex-1 h-full border-b border-l border-border/80 flex items-end justify-around px-2 sm:px-6">
          <!-- Horizontal Grid Lines -->
          <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
            <div
              v-for="idx in 6"
              :key="idx"
              class="w-full border-b border-dashed border-border/40"
            />
          </div>

          <!-- Bars -->
          <div
            v-for="item in items"
            :key="item.code"
            class="group relative flex flex-col items-center justify-end h-full w-8 sm:w-10 z-10"
            @mouseenter="hoveredItem = item"
            @mouseleave="hoveredItem = null"
          >
            <!-- Vertical Bar -->
            <div
              class="w-2.5 sm:w-3.5 rounded-t-xs bg-emerald-700 transition-all duration-300 group-hover:bg-emerald-600 group-hover:w-4"
              :class="getHeightClass(item.value)"
            />

            <!-- Tooltip -->
            <div
              v-if="hoveredItem?.code === item.code"
              class="pointer-events-none absolute -top-12 z-20 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white shadow-md backdrop-blur-xs"
            >
              <div>{{ item.name }}</div>
              <div class="text-emerald-400 font-mono">{{ new Intl.NumberFormat('id-ID').format(item.value) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- X-Axis Labels (G, I, C, S, H) -->
      <div class="flex items-center justify-around pl-14 sm:pl-20 pr-2 sm:pr-6 pt-2">
        <div
          v-for="item in items"
          :key="`label-${item.code}`"
          class="w-8 sm:w-10 text-center text-xs font-bold text-foreground sm:text-sm"
        >
          {{ item.code }}
        </div>
      </div>
    </div>

    <!-- Centered Action Button -->
    <div class="flex justify-center pt-2">
      <NuxtLink
        v-if="buttonHref"
        :to="buttonHref"
        class="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <span>{{ buttonText }}</span>
      </NuxtLink>
      <button
        v-else
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        @click="emit('click:action')"
      >
        <span>{{ buttonText }}</span>
      </button>
    </div>
  </div>
</template>
