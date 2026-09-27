<script setup lang="ts">
import { ArrowLeft } from "@lucide/vue";
import { FASE_LABEL, LAPORAN_STATUS } from "~/constants";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import type { KpiPeserta, KpiPesertaDetail } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Tren KPI Peserta – Dashboard UMKM" });

const route = useRoute();
const id = String(route.params.pesertaId);
const directus = useDirectus();

const { data, error, refresh } = await useAsyncData(`kpi:peserta:${id}`, () =>
  directus.request(endpoint<KpiPesertaDetail>(`/v1/program/kpi/peserta/${encodeURIComponent(id)}`)),
);

const saving = ref(false);
const pitchingError = ref("");
async function setPitching(value: boolean | "indeterminate") {
  if (!data.value || value === "indeterminate") return;
  pitchingError.value = "";
  saving.value = true;
  try {
    await directus.request(
      endpoint<KpiPeserta, { rekomendasi: boolean }>(`/v1/program/kpi/peserta/${id}/pitching`, { method: "PATCH", body: { rekomendasi: value } }),
    );
    await refresh();
  } catch (cause) {
    pitchingError.value =
      requestErrorCode(cause) === "PITCHING_BELUM_MEMENUHI"
        ? "Rekomendasi pitching membutuhkan 4 minggu berturut-turut yang disetujui dan mencapai target."
        : "Rekomendasi tidak dapat disimpan. Coba lagi.";
  } finally {
    saving.value = false;
  }
}

const rupiah = (value: number) => formatAnalyticsCurrency(value);
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
    <NuxtLink to="/dashboard/pendampingan" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft class="size-4" /> Panel Pendampingan
    </NuxtLink>

    <div v-if="error" role="alert" class="rounded-lg border border-destructive/30 p-6 text-sm text-destructive">
      Peserta tidak ditemukan atau Anda tidak memiliki akses.
    </div>

    <template v-else-if="data">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ data.peserta.usaha.nama }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ FASE_LABEL[data.peserta.fase] || data.peserta.fase }} · Batch {{ data.peserta.batch }} · Minggu ke-{{ data.peserta.mingguBerjalan }} dari {{ data.peserta.jumlahMinggu }} · Target {{ rupiah(data.peserta.targetMingguan) }}/minggu
        </p>
      </div>

      <UiCard>
        <UiCardHeader>
          <UiCardTitle>Target vs Realisasi Omzet</UiCardTitle>
        </UiCardHeader>
        <UiCardContent>
          <ProgramKpiTrend :laporan="data.laporan" :jumlah-minggu="data.peserta.jumlahMinggu" :target-mingguan="data.peserta.targetMingguan" />
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardHeader>
          <UiCardTitle>Rekomendasi Pitching</UiCardTitle>
          <UiCardDescription>
            Rangkaian terpanjang: {{ data.pitching.streak }} minggu berturut-turut mencapai target (dibutuhkan {{ data.pitching.dibutuhkan }}).
          </UiCardDescription>
        </UiCardHeader>
        <UiCardContent class="grid gap-2">
          <label class="flex items-center gap-2 text-sm font-medium">
            <UiCheckbox
              :model-value="data.peserta.rekomendasiPitching"
              :disabled="saving || !data.akses.review || (!data.pitching.memenuhi && !data.peserta.rekomendasiPitching)"
              name="rekomendasi-pitching"
              @update:model-value="setPitching"
            />
            Rekomendasikan untuk sesi pitching investor
          </label>
          <p v-if="!data.pitching.memenuhi && !data.peserta.rekomendasiPitching" class="text-xs text-muted-foreground">
            Aktif setelah {{ data.pitching.dibutuhkan }} minggu berturut-turut laporan disetujui dan omzet mencapai target.
          </p>
          <p v-if="pitchingError" role="alert" class="text-sm text-destructive">{{ pitchingError }}</p>
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardHeader>
          <UiCardTitle>Laporan Mingguan</UiCardTitle>
        </UiCardHeader>
        <UiCardContent class="overflow-x-auto p-0">
          <p v-if="!data.laporan.length" class="p-6 text-sm text-muted-foreground">Belum ada laporan.</p>
          <table v-else class="w-full min-w-[36rem] text-sm">
            <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-4 py-3">Minggu</th>
                <th class="px-4 py-3 text-right">Target</th>
                <th class="px-4 py-3 text-right">Omzet</th>
                <th class="px-4 py-3 text-right">Capaian</th>
                <th class="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.laporan" :key="item.id" class="border-b last:border-0">
                <td class="px-4 py-3">{{ item.mingguKe }}</td>
                <td class="px-4 py-3 text-right tabular-nums">{{ rupiah(item.target) }}</td>
                <td class="px-4 py-3 text-right tabular-nums">{{ rupiah(item.realisasiOmzet) }}</td>
                <td class="px-4 py-3 text-right tabular-nums">{{ item.capaianPersen ?? "—" }}%</td>
                <td class="px-4 py-3"><ProgramStatusPill :meta="LAPORAN_STATUS[item.status]" /></td>
              </tr>
            </tbody>
          </table>
        </UiCardContent>
      </UiCard>
    </template>
  </div>
</template>
