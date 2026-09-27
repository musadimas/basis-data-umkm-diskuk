<script setup lang="ts">
import { VisAxis, VisCrosshair, VisLine, VisScatter, VisTooltip, VisXYContainer } from "@unovis/vue";
import type { KpiLaporan } from "~/types/program";

const props = defineProps<{ laporan: KpiLaporan[]; jumlahMinggu: number; targetMingguan: number }>();

interface Point {
  minggu: number;
  target: number;
  realisasi: number | undefined;
}

// One point per programme week; weeks without a report leave a gap in the actual line.
const data = computed<Point[]>(() => {
  const byWeek = new Map(props.laporan.map((item) => [item.mingguKe, item]));
  return Array.from({ length: props.jumlahMinggu }, (_, index) => {
    const report = byWeek.get(index + 1);
    return { minggu: index + 1, target: report?.target ?? props.targetMingguan, realisasi: report?.realisasiOmzet };
  });
});

const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const x = (d: Point) => d.minggu;
const y = [(d: Point) => d.target, (d: Point) => d.realisasi];
const colors = ["#94a3b8", "#16a34a"];
const tooltip = (d: Point) =>
  `<strong>Minggu ${d.minggu}</strong><br>Target: ${full.format(d.target)}<br>Omzet: ${d.realisasi === undefined ? "belum ada" : full.format(d.realisasi)}`;
</script>

<template>
  <div class="grid gap-2">
    <div class="flex gap-4 text-xs">
      <span class="inline-flex items-center gap-1"><span class="h-0.5 w-4 bg-slate-400" /> Target</span>
      <span class="inline-flex items-center gap-1"><span class="h-0.5 w-4 bg-green-600" /> Omzet</span>
    </div>
    <VisXYContainer :data="data" :height="260" :margin="{ top: 8, right: 16, bottom: 8, left: 8 }">
      <VisLine :x="x" :y="y" :color="(_: Point, i: number) => colors[i]" :line-dash-array="(_: Point, i: number) => (i === 0 ? [4, 4] : undefined)" />
      <VisScatter :x="x" :y="(d: Point) => d.realisasi" color="#16a34a" :size="6" />
      <VisAxis type="x" label="Minggu" :tick-format="(value: number) => String(value)" :num-ticks="Math.min(jumlahMinggu, 12)" />
      <VisAxis type="y" :tick-format="(value: number) => compact.format(value)" />
      <VisCrosshair :template="tooltip" :color="colors" />
      <VisTooltip />
    </VisXYContainer>
  </div>
</template>
