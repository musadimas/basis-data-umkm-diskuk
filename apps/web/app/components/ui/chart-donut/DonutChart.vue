<script setup lang="ts" generic="T extends Record<string, unknown>">
import type { BaseChartProps } from ".";
import { Donut } from "@unovis/ts";
import { VisDonut, VisSingleContainer, VisTooltip } from "@unovis/vue";
import { useMounted } from "@vueuse/core";
import { computed, ref } from "vue";
import { cn } from "@/lib/utils";
import { defaultColors } from "@/components/ui/chart";

const props = withDefaults(
  defineProps<
    Pick<
      BaseChartProps<T>,
      | "data"
      | "colors"
      | "index"
      | "margin"
      | "showLegend"
      | "showTooltip"
      | "filterOpacity"
    > & {
      /**
       * Sets the name of the key containing the quantitative chart values.
       */
      category: KeyOfT;
      /**
       * Change the type of the chart
       * @default "donut"
       */
      type?: "donut" | "pie";
      /**
       * Function to sort the segment
       */
      sortFunction?: (a: T, b: T) => number | undefined;
      /**
       * Controls the formatting for the label.
       */
      valueFormatter?: (tick: number, i?: number, ticks?: number[]) => string;
      /**
       * Teks di tengah donut. Bila diisi (termasuk string kosong), nilai ini
       * dipakai apa adanya; bila `undefined` akan menampilkan total otomatis.
       */
      centralLabel?: string;
    }
  >(),
  {
    margin: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    sortFunction: () => undefined,
    type: "donut",
    filterOpacity: 0.2,
    showTooltip: true,
    showLegend: true,
  },
);

type KeyOfT = Extract<keyof T, string>;
type Data = (typeof props.data)[number] & {
  data?: (typeof props.data)[number];
};

const valueFormatter = props.valueFormatter ?? ((tick: number) => `${tick}`);
// SAFETY: `category` is declared as KeyOfT in the props; the assertion only restores the generic key type erased by defineProps' runtime extraction.
const category = computed(() => props.category as KeyOfT);
// SAFETY: `index` is declared as KeyOfT in the props; likewise the assertion restores the erased generic key type.
const index = computed(() => props.index as KeyOfT);

const isMounted = useMounted();
const activeSegmentKey = ref<string>();
const colors = computed(() =>
  props.colors?.length ? props.colors : defaultColors(props.data.length),
);

const totalValue = computed(() =>
  props.data.reduce((prev, curr) => {
    return prev + Number(curr[props.category] ?? 0);
  }, 0),
);

const centralLabelText = computed(() =>
  props.centralLabel !== undefined
    ? props.centralLabel
    : props.type === "donut"
      ? valueFormatter(totalValue.value)
      : "",
);

function segmentKey(d: Data) {
  return String(d.data?.[index.value] ?? d[index.value] ?? "");
}

function onSegmentClick(
  _d: Data,
  _event: PointerEvent,
  i: number,
  elements: HTMLElement[],
) {
  const key = segmentKey(_d);
  if (key === activeSegmentKey.value) {
    activeSegmentKey.value = undefined;
    elements.forEach((element) => (element.style.opacity = "1"));
    return;
  }

  activeSegmentKey.value = key;
  elements.forEach(
    (element) => (element.style.opacity = `${props.filterOpacity}`),
  );
  const element = elements[i];
  if (element) element.style.opacity = "1";
}

/**
 * Tooltip per segmen donut. unovis meneruskan datum arc yang bentuknya
 * `{ ..., data: <baris asli>, index: <indeks baris> }`, sehingga label dan
 * nilai diambil dari `d.data` (bukan dari `d` langsung) agar tidak ikut
 * menampilkan properti arc seperti `startAngle`/`endAngle`.
 */
type DonutTooltipDatum = Data & { data?: Data; index?: number };

// SAFETY: unovis memanggil template ini dengan datum arc internalnya sendiri
// (lihat kontrak DonutTooltipDatum di atas); assertion di bawah hanya mengetik
// ulang kontrak tersebut, bukan parsing input eksternal.
function tooltipTemplate(
  tooltipInput: DonutTooltipDatum | null | undefined,
  i: number,
  _elements: (HTMLElement | SVGElement)[],
): string {
  // SAFETY: parameter sudah bertipe DonutTooltipDatum | null | undefined; assertion hanya
  // mempersempit union untuk akses properti, tidak mengubah sumber kebenarannya.
  const datum = tooltipInput as DonutTooltipDatum;
  if (!datum) return "";
  // SAFETY: `data` bila ada adalah baris Data yang dikirim lewat props; fallback ke datum itu sendiri
  // mengikuti bentuk arc tanpa wrapper. Akses properti di bawah sudah defensive (?? / String/Number).
  const raw = (datum.data ?? datum) as Data;
  const label = String(raw?.[index.value] ?? raw?.label ?? "");
  if (!label) return "";
  const value = Number(raw?.[props.category] ?? 0);
  const color =
    colors.value[Number(datum?.index ?? i)] ?? colors.value[i] ?? "transparent";
  return `<div class="flex items-center gap-2 text-xs"><span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${color}"></span><span class="font-medium text-foreground">${label}</span><span class="ml-auto font-semibold tabular-nums text-foreground">${valueFormatter(value)}</span></div>`;
}
</script>

<template>
  <div :class="cn('w-full h-48 flex flex-col items-end', $attrs.class ?? '')">
    <VisSingleContainer
      class="w-full"
      :style="{ height: isMounted ? '100%' : 'auto' }"
      :margin="{ left: 20, right: 20 }"
      :data="data"
    >
      <VisTooltip
        v-if="showTooltip"
        :horizontal-shift="20"
        :vertical-shift="20"
        :triggers="{ [Donut.selectors.segment]: tooltipTemplate }"
      />

      <VisDonut
        :value="(d: Data) => Number(d[category] ?? 0)"
        :sort-function="sortFunction"
        :color="colors"
        :arc-width="type === 'donut' ? 20 : 0"
        :show-background="false"
        :central-label="centralLabelText"
        :events="{
          [Donut.selectors.segment]: {
            click: onSegmentClick,
          },
        }"
      />

      <slot />
    </VisSingleContainer>
  </div>
</template>
