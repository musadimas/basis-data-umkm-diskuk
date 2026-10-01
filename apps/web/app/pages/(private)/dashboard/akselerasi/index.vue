<script setup lang="ts">
import { VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from "@unovis/vue";
import { endpoint } from "~/lib/directus";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import type { ExecutiveMonitoring } from "~/types/executive";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Monitoring Akselerasi" });
const directus = useDirectus();
const { data, error, refresh } = await useAsyncData("executive:monitoring", () =>
  directus.request(endpoint<ExecutiveMonitoring>("/v1/program/executive/monitoring")));
const updating = ref(false);
const updateMessage = ref("");
async function recompute() {
  updating.value = true;
  updateMessage.value = "";
  try {
    const result = await directus.request(endpoint<{ dibuat: number; totalRisiko: number }>("/v1/program/executive/monitoring/recompute", { method: "POST" }));
    updateMessage.value = `${result.dibuat} tugas pendamping baru dari ${result.totalRisiko} peserta berisiko.`;
    await refresh();
  } catch { updateMessage.value = "Tugas belum dapat diperbarui."; }
  finally { updating.value = false; }
}
const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const percent = (v: number | null) => v == null ? "—" : `${number.format(v)}%`;
const rupiah = (v: number | null) => v == null ? "—" : formatAnalyticsCurrency(v);
const x = (d: ExecutiveMonitoring["tren"][number]) => d.minggu;
const y = [(d: ExecutiveMonitoring["tren"][number]) => d.target, (d: ExecutiveMonitoring["tren"][number]) => d.realisasi ?? undefined];
const colors = ["#64748b", "#16a34a"];
</script>

<template>
  <main class="flex w-full flex-col gap-6 pb-10">
    <header><h1 class="text-2xl font-bold">Monitoring Program Akselerasi</h1>
      <p class="text-sm text-muted-foreground">Agregat 12 minggu dari laporan mingguan yang telah disetujui.</p></header>
    <p v-if="error" role="alert" class="text-destructive">Monitoring belum dapat dimuat.</p>
    <template v-else-if="data">
      <div class="grid gap-4 md:grid-cols-2">
        <UiCard><UiCardHeader><UiCardTitle>Kenaikan omzet peserta</UiCardTitle></UiCardHeader>
          <UiCardContent><p class="text-3xl font-bold">{{ percent(data.kenaikanOmzet.persen) }}</p>
            <p class="text-sm text-muted-foreground">{{ data.kenaikanOmzet.pesertaDihitung }} peserta · {{ data.kenaikanOmzet.sumber }}</p></UiCardContent></UiCard>
        <UiCard><UiCardHeader><UiCardTitle>Kepatuhan laporan terverifikasi</UiCardTitle></UiCardHeader>
          <UiCardContent><p class="text-3xl font-bold">{{ percent(data.kepatuhan.persen) }}</p>
            <p class="text-sm text-muted-foreground">{{ data.kepatuhan.terverifikasi }} dari {{ data.kepatuhan.diharapkan }} laporan · Target &gt;95%</p></UiCardContent></UiCard>
      </div>
      <UiCard><UiCardHeader><UiCardTitle>Target agregat dan realisasi terverifikasi</UiCardTitle></UiCardHeader>
        <UiCardContent><div class="flex gap-5 text-sm"><span>┄ Target rencana agregat</span><span class="text-green-700">━ Realisasi terverifikasi</span></div>
          <ClientOnly><VisXYContainer :data="data.tren" :height="280">
            <VisLine :x="x" :y="y" :color="(_: unknown, i: number) => colors[i]" :line-dash-array="(_: unknown, i: number) => i === 0 ? [5, 5] : undefined" />
            <VisAxis type="x" label="Minggu" :num-ticks="12" /><VisAxis type="y" />
            <VisCrosshair /><VisTooltip />
          </VisXYContainer></ClientOnly>
          <table class="mt-4 w-full text-sm"><caption class="sr-only">Angka grafik target dan realisasi per minggu</caption>
            <thead><tr><th class="text-left">Minggu</th><th class="text-right">Target</th><th class="text-right">Realisasi disetujui</th></tr></thead>
            <tbody><tr v-for="point in data.tren" :key="point.minggu" class="border-t"><td>{{ point.minggu }}</td><td class="text-right">{{ rupiah(point.target) }}</td><td class="text-right">{{ rupiah(point.realisasi) }}</td></tr></tbody>
          </table>
        </UiCardContent></UiCard>
      <UiCard><UiCardHeader><UiCardTitle>Peta risiko penurunan omzet</UiCardTitle></UiCardHeader>
        <UiCardContent><p class="mb-3 text-sm">Dua pekan terakhir masing-masing ≤70% dari baseline mingguan SIDT. Pekan hilang memutus rangkaian.</p>
          <ClientOnly><OperasionalAtRiskMap :items="data.atRisk" /></ClientOnly>
          <UiButton type="button" class="mt-4" :disabled="updating" @click="recompute">Buat tugas pendamping</UiButton>
          <p v-if="updateMessage" role="status" class="mt-2 text-sm">{{ updateMessage }}</p>
        </UiCardContent></UiCard>
    </template>
  </main>
</template>
