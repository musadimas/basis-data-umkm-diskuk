<script setup lang="ts" generic="T extends Record<string, unknown>">
import type { ChartConfig } from "@/components/ui/chart";
import { GroupedBar } from "@unovis/ts";
import {
  VisAxis,
  VisGroupedBar,
  VisTooltip,
  VisXYContainer,
} from "@unovis/vue";
import { useMounted } from "@vueuse/core";
import { computed } from "vue";
import ChartContainer from "@/components/ui/chart/ChartContainer.vue";

type KeyOfT = Extract<keyof T, string>;

interface SeriesConfig {
  /** Must name a column of the `data` rows so the accessors stay type-safe. */
  key: KeyOfT;
  label: string;
  color: string;
}

const props = withDefaults(
  defineProps<{
    data: T[];
    /** X-axis category key (e.g. "gender"). */
    index: KeyOfT;
    /** One bar per series, grouped side by side under each category tick. */
    series: SeriesConfig[];
    valueFormatter?: (value: number) => string;
    showLegend?: boolean;
    showTooltip?: boolean;
    roundedCorners?: number | boolean;
    barPadding?: number;
    groupPadding?: number;
    orientation?: "vertical" | "horizontal";
  }>(),
  {
    showLegend: true,
    showTooltip: true,
    roundedCorners: 4,
    barPadding: 0.1,
    groupPadding: 0,
  },
);

const isMounted = useMounted();
const valueFormatter = props.valueFormatter ?? ((v: number) => `${v}`);

const barColors = computed(() => props.series.map((s) => s.color));
const barY = computed(() =>
  props.series.map((s) => (row: T) => Number(row[s.key] ?? 0)),
);
const barX = (_: T, i: number) => i;

const chartConfig = computed<ChartConfig>(() =>
  Object.fromEntries(
    props.series.map((s) => [s.key, { label: s.label, color: s.color }]),
  ),
);

const categoryTicks = computed(() => props.data.map((_, i) => i));
const categoryLabel = (tick: number) =>
  String(props.data[tick]?.[props.index] ?? "");
// const valueTick = (tick: number) => valueFormatter(tick);

/**
 * VisTooltip binds to GroupedBar's internal per-rect record, not the plain row
 * (same `.datum` wrapper quirk StackedBar's tooltip needs — see BarChart.vue).
 * The optional `datum` on the parameter type models that wrapper without an
 * assertion.
 */
type TooltipRow = T & Partial<{ datum?: T }>;
function tooltipTemplate(row: TooltipRow): string {
  const datum = row.datum ?? row;
  if (!datum) return "";
  const label = String(datum[props.index] ?? "");
  const rows = props.series
    .map((s) => {
      const value = Number(datum[s.key] ?? 0);
      return `<div class="flex items-center gap-2"><span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${s.color}"></span><span class="font-medium text-foreground">${s.label}</span><span class="ml-auto font-semibold tabular-nums text-foreground">${valueFormatter(value)}</span></div>`;
    })
    .join("");
  return `<div class="border-border/50 bg-background flex flex-col gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"><span class="font-semibold text-foreground">${label}</span>${rows}</div>`;
}
</script>

<template>
  <ChartContainer :config="chartConfig">
    <div v-if="showLegend" class="mb-3 flex items-center gap-4">
      <span
        v-for="s in series"
        :key="s.key"
        class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        <span class="size-2.5 rounded-full" :style="{ background: s.color }" />
        {{ s.label }}
      </span>
    </div>
    <VisXYContainer
      class="w-full flex-1"
      :style="{ height: isMounted ? '100%' : 'auto' }"
      :data="data"
      :margin="{ top: 8, right: 8, bottom: 8, left: 8 }"
    >
      <VisGroupedBar
        :x="barX"
        :y="barY"
        :color="barColors"
        :rounded-corners="roundedCorners"
        :bar-padding="barPadding"
        :group-padding="groupPadding"
      />

      <VisAxis
        type="x"
        position="bottom"
        :tick-values="categoryTicks"
        :tick-format="categoryLabel"
        :grid-line="false"
        :tick-line="false"
        :domain-line="false"
      />
      <!-- <VisAxis
        type="y"
        position="left"
        :num-ticks="4"
        :tick-format="valueTick"
        :grid-line="false"
        :tick-line="false"
        :domain-line="false"
      /> -->

      <VisTooltip
        v-if="showTooltip"
        :triggers="{ [GroupedBar.selectors.bar]: tooltipTemplate }"
      />
    </VisXYContainer>
  </ChartContainer>
</template>
