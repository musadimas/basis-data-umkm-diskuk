<script setup lang="ts">
import type { BulletLegendItemInterface } from "@unovis/ts";
import type { Component } from "vue";
import { omit } from "@unovis/ts";
import { VisTooltip } from "@unovis/vue";
import { createApp } from "vue";
import { ChartTooltip } from ".";

type Datum = Record<string, unknown>;

const props = defineProps<{
  selector: string;
  index: string;
  items?: BulletLegendItemInterface[];
  valueFormatter?: (tick: number, i?: number, ticks?: number[]) => string;
  customTooltip?: Component;
}>();

// Use weakmap to store reference to each datapoint for Tooltip
const wm = new WeakMap<object, string>();
function isDatum(value: unknown): value is Datum {
  return typeof value === "object" && value !== null;
}

function legendColor(item: BulletLegendItemInterface | undefined) {
  if (typeof item?.color === "string")
    return item.color;
  return item?.color?.[0] ?? "transparent";
}

function tooltipData(items: BulletLegendItemInterface[] | undefined, data: Datum, index: string, valueFormatter: (tick: number) => string) {
  return Object.entries(omit(data, [index])).map(([key, value]) => {
    const legendReference = items?.find(i => i.name === key);
    return {
      name: String(legendReference?.name ?? key),
      color: legendColor(legendReference),
      value: valueFormatter(Number(value)),
    };
  });
}

function template(d: unknown, i: number, elements: (HTMLElement | SVGElement)[]) {
  const valueFormatter = props.valueFormatter ?? ((tick: number) => `${tick}`);
  if (!isDatum(d))
    return;

  if (props.index in d) {
    if (wm.has(d))
      return wm.get(d);

    const componentDiv = document.createElement("div");
    const omittedData = tooltipData(props.items, d, props.index, valueFormatter);
    const TooltipComponent = props.customTooltip ?? ChartTooltip;
    createApp(TooltipComponent, { title: String(d[props.index] ?? ""), data: omittedData }).mount(componentDiv);
    wm.set(d, componentDiv.innerHTML);
    return componentDiv.innerHTML;
  }

  const data = d.data;
  if (!isDatum(data))
    return;
  if (wm.has(data))
    return wm.get(data);

  const element = elements[i];
  if (!element)
    return;

  const style = getComputedStyle(element);
  const omittedData = [{
    name: String(data.name ?? ""),
    value: valueFormatter(Number(data[props.index])),
    color: style.fill,
  }];
  const componentDiv = document.createElement("div");
  const TooltipComponent = props.customTooltip ?? ChartTooltip;
  createApp(TooltipComponent, { title: String(d[props.index] ?? ""), data: omittedData }).mount(componentDiv);
  wm.set(data, componentDiv.innerHTML);
  return componentDiv.innerHTML;
}
</script>

<template>
  <VisTooltip
    :horizontal-shift="20" :vertical-shift="20" :triggers="{
      [selector]: template,
    }"
  />
</template>
