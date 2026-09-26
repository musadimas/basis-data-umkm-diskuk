<script setup lang="ts" generic="T extends Record<string, unknown>">
import type { BaseChartProps } from "../chart/interface";
import { Orientation, StackedBar } from "@unovis/ts";
import {
  VisAxis,
  VisStackedBar,
  VisTooltip,
  VisXYContainer,
  VisXYLabels,
} from "@unovis/vue";
import { useMounted } from "@vueuse/core";
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { defaultColors } from "@/components/ui/chart";

type KeyOfT = Extract<keyof T, string>;

const props = withDefaults(
  defineProps<
    BaseChartProps<T> & {
      /**
       * Layout direction of the bars.
       * @default "vertical"
       */
      orientation?: "horizontal" | "vertical";
      /** @default 4 */
      roundedCorners?: number | boolean;
      /** @default 0.35 */
      barPadding?: number;
      /** Renders the numeric value next to/above each bar. @default true */
      showValueLabels?: boolean;
      /** Formats the on-bar value label text (separate from the axis tick formatters). */
      valueFormatter?: (value: number) => string;
    }
  >(),
  {
    orientation: "vertical",
    roundedCorners: 4,
    barPadding: 0.35,
    filterOpacity: 0.2,
    showXAxis: true,
    showYAxis: true,
    showTooltip: true,
    showLegend: false,
    showGridLine: false,
    showValueLabels: true,
    margin: () => ({ top: 24, right: 24, bottom: 8, left: 8 }),
  },
);

// SAFETY: BaseChartProps<T> declares `categories` as KeyOfT-typed, but defineProps'
// runtime extraction erases the generic parameter; restore it for the accessors.
const valueKey = computed(() => props.categories[0] as KeyOfT);
// SAFETY: same defineProps generic erasure as `valueKey` above.
const index = computed(() => props.index as KeyOfT);

const isMounted = useMounted();
const isHorizontal = computed(() => props.orientation === "horizontal");
const colors = computed(() =>
  props.colors?.length ? props.colors : defaultColors(props.data.length),
);
const valueFormatter = props.valueFormatter ?? ((v: number) => `${v}`);

/**
 * Colors can't be derived from the accessor's `i` (unreliable per-row), so each
 * row is stamped with its own color up front — matching unovis's own default
 * color accessor convention (`d => d.color`) — and read back off the datum.
 */
/** Each rendered row carries its stamped color so accessors read it back off the datum. */
type ChartRow = T & { __color: string };
const chartData = computed<ChartRow[]>(() =>
  props.data.map((row, i) => ({
    ...row,
    __color: colors.value[i % colors.value.length] ?? "currentColor",
  })),
);

/**
 * unovis renders horizontal-bar index 0 at the BOTTOM, increasing upward — invert
 * only for horizontal mode so index 0 (assumed pre-sorted desc by the caller)
 * renders at the visual top. Vertical mode needs no inversion.
 */
function positionFor(i: number) {
  return isHorizontal.value ? props.data.length - 1 - i : i;
}
const barX = (_: ChartRow, i: number) => positionFor(i);
const barY = [(row: ChartRow) => Number(row[valueKey.value] ?? 0)];
const barColor = (row: ChartRow) => row.__color;

const categoryTicks = computed(() => props.data.map((_, i) => positionFor(i)));
const categoryLabel = (tick: number) => {
  const i = isHorizontal.value ? props.data.length - 1 - tick : tick;
  return String(props.data[i]?.[index.value] ?? "");
};

const maxValue = computed(() =>
  Math.max(0, ...props.data.map((row) => Number(row[valueKey.value] ?? 0))),
);
/**
 * Nudges the label just past the bar tip. VisXYLabels positions labels in data
 * space, so without headroom past the max value the tallest bar's label can be
 * dropped as out-of-range — the extra 6% keeps it inside the scale's domain.
 */
const labelValue = (row: T) =>
  Number(row[valueKey.value] ?? 0) + maxValue.value * 0.06;
const labelText = (row: T) => valueFormatter(Number(row[valueKey.value] ?? 0));

/**
 * VisTooltip binds to StackedBar's internal per-rect record, not the plain row —
 * unwrap `.datum` (confirmed via runtime inspection: `{ datum, index, stacked,
 * stackIndex, isEnding }`) before reading label/value/color off it. The optional
 * `datum` on the parameter type models that wrapper without an assertion.
 */
type TooltipRow = T & Partial<{ datum?: ChartRow }>;
function tooltipTemplate(row: TooltipRow): string {
  const datum = row.datum ?? row;
  if (!datum) return "";
  const label = String(datum[index.value] ?? "");
  const value = Number(datum[valueKey.value] ?? 0);
  const color = datum.__color ?? "currentColor";
  return `<div class="flex items-center gap-2 text-xs"><span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${color}"></span><span class="font-medium text-foreground">${label}</span><span class="ml-auto font-semibold tabular-nums text-foreground">${valueFormatter(value)}</span></div>`;
}
</script>

<template>
  <div :class="cn('w-full h-48 flex flex-col', $attrs.class ?? '')">
    <VisXYContainer
      class="w-full"
      :style="{ height: isMounted ? '100%' : 'auto' }"
      :data="chartData"
      :margin="margin"
    >
      <VisStackedBar
        :x="barX"
        :y="barY"
        :color="barColor"
        :orientation="
          isHorizontal ? Orientation.Horizontal : Orientation.Vertical
        "
        :rounded-corners="roundedCorners"
        :bar-padding="barPadding"
        :bar-min-height="2"
      />

      <VisAxis
        v-if="isHorizontal ? showYAxis : showXAxis"
        :type="isHorizontal ? 'y' : 'x'"
        :position="isHorizontal ? 'left' : 'bottom'"
        :tick-values="categoryTicks"
        :tick-format="categoryLabel"
        :tick-text-width="isHorizontal ? 140 : undefined"
        tick-text-trim-type="middle"
        :grid-line="showGridLine"
        :tick-line="false"
        :domain-line="false"
      />
      <VisAxis
        v-if="isHorizontal ? showXAxis : showYAxis"
        :type="isHorizontal ? 'x' : 'y'"
        :position="isHorizontal ? 'top' : 'left'"
        :num-ticks="3"
        :tick-format="isHorizontal ? xFormatter : yFormatter"
        :grid-line="showGridLine"
        :tick-line="false"
        :domain-line="false"
      />

      <VisXYLabels
        v-if="showValueLabels"
        :x="isHorizontal ? labelValue : barX"
        :y="isHorizontal ? barX : labelValue"
        :label="labelText"
        :color="barColor"
        :clustering="false"
      />

      <VisTooltip
        v-if="showTooltip"
        :triggers="{ [StackedBar.selectors.bar]: tooltipTemplate }"
      />
    </VisXYContainer>

    <ul v-if="showLegend" class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      <li
        v-for="(row, i) in data"
        :key="i"
        class="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <span
          class="size-2 rounded-full"
          :style="{ background: colors[i % colors.length] }"
        />
        {{ row[index] }}
      </li>
    </ul>
  </div>
</template>
