<script setup lang="ts">
/** Five-axis radar (0–100) for the Talent Passport; plain SVG so it renders on the server too. */
import { RADAR_DIMENSI } from "~/constants";
import type { PassportSkor } from "~/types/program";

const props = defineProps<{ skor: PassportSkor }>();

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 90;
const angle = (index: number) => (Math.PI * 2 * index) / RADAR_DIMENSI.length - Math.PI / 2;
const point = (index: number, value: number) => {
  const r = (RADIUS * Math.max(0, Math.min(100, value))) / 100;
  return [CENTER + r * Math.cos(angle(index)), CENTER + r * Math.sin(angle(index))] as const;
};
const ring = (value: number) => RADAR_DIMENSI.map((_, index) => point(index, value).join(",")).join(" ");
const shape = computed(() => RADAR_DIMENSI.map((dim, index) => point(index, props.skor[dim.key]).join(",")).join(" "));
const labels = computed(() =>
  RADAR_DIMENSI.map((dim, index) => {
    const [x, y] = point(index, 122);
    return { ...dim, x, y, value: props.skor[dim.key] };
  }),
);
const summary = computed(() => RADAR_DIMENSI.map((dim) => `${dim.label} ${props.skor[dim.key]}`).join(", "));
</script>

<template>
  <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="h-auto w-full max-w-xs" role="img" :aria-label="`Radar skor: ${summary}`">
    <polygon v-for="value in [25, 50, 75, 100]" :key="value" :points="ring(value)" fill="none" class="stroke-slate-200" stroke-width="1" />
    <line v-for="(_, index) in RADAR_DIMENSI" :key="index" :x1="CENTER" :y1="CENTER" :x2="point(index, 100)[0]" :y2="point(index, 100)[1]" class="stroke-slate-200" />
    <polygon :points="shape" class="fill-primary/25 stroke-primary" stroke-width="2" />
    <text v-for="label in labels" :key="label.key" :x="label.x" :y="label.y" text-anchor="middle" dominant-baseline="middle" class="fill-foreground text-[10px]">
      <tspan :x="label.x" dy="-0.4em">{{ label.label }}</tspan>
      <tspan :x="label.x" dy="1.2em" class="font-bold">{{ label.value }}</tspan>
    </text>
  </svg>
</template>
