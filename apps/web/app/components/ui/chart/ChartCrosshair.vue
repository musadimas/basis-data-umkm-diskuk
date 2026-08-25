<script setup lang="ts">
import type { BulletLegendItemInterface } from "@unovis/ts";
import type { Component } from "vue";
import { omit } from "@unovis/ts";
import { VisCrosshair, VisTooltip } from "@unovis/vue";
import { createApp } from "vue";
import { ChartTooltip } from ".";

type DatumValue = number | string | boolean | null | Datum | undefined;
type Datum = {
  [key: string]: DatumValue;
};

const props = withDefaults(
  defineProps<{
    colors: string[];
    index: string;
    items: BulletLegendItemInterface[];
    customTooltip?: Component;
  }>(),
  {
    colors: () => [],
  },
);

// Use weakmap to store reference to each datapoint for Tooltip
const wm = new WeakMap<object, string>();
function isDatum(value: DatumValue): value is Datum {
  return typeof value === "object" && value !== null;
}

function template(d: DatumValue) {
  if (!isDatum(d)) return "";

  if (wm.has(d)) return wm.get(d) ?? "";

  const componentDiv = document.createElement("div");
  const omittedData = Object.entries(omit(d, [props.index])).map(
    ([key, value]) => {
      const legendReference = props.items.find((i) => i.name === key);
      const legendColor = legendReference?.color;
      const color = Array.isArray(legendColor)
        ? (legendColor[0] ?? "transparent")
        : (legendColor ?? "transparent");
      return { name: String(legendReference?.name ?? key), color, value };
    },
  );
  const TooltipComponent = props.customTooltip ?? ChartTooltip;
  const title = String(d[props.index] ?? "");
  createApp(TooltipComponent, { title, data: omittedData }).mount(componentDiv);
  wm.set(d, componentDiv.innerHTML);
  return componentDiv.innerHTML;
}

function color(_d: DatumValue, i: number) {
  return props.colors[i] ?? "transparent";
}
</script>

<template>
  <VisTooltip :horizontal-shift="20" :vertical-shift="20" />
  <VisCrosshair :template="template" :color="color" />
</template>
