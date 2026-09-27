<script setup lang="ts">
import { LAPORAN_STATUS, assetUrl } from "~/constants";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import type { KpiLaporan, KpiLaporanQueueItem, KpiPesertaListItem, LaporanStatus } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Panel Pendampingan – Dashboard UMKM" });

type Tab = LaporanStatus | "belum_mengirim";
const TABS: { value: Tab; label: string }[] = [
  { value: "menunggu", label: "Menunggu" },
  { value: "disetujui", label: "Disetujui" },
  { value: "ditolak", label: "Ditolak" },
  { value: "belum_mengirim", label: "Belum Mengirim" },
];

const directus = useDirectus();
const tab = ref<Tab>("menunggu");

const { data: queue, pending, error, refresh } = await useAsyncData(
  "kpi:laporan",
  () =>
    tab.value === "belum_mengirim"
      ? Promise.resolve([] as KpiLaporanQueueItem[])
      : directus.request(endpoint<KpiLaporanQueueItem[]>("/v1/program/kpi/laporan", { query: { status: tab.value } })),
  { watch: [tab] },
);
const { data: peserta, refresh: refreshPeserta } = await useAsyncData("kpi:peserta:panel", () =>
  directus.request(endpoint<KpiPesertaListItem[]>("/v1/program/kpi/peserta")),
);
const belumMengirim = computed(() => (peserta.value ?? []).filter((item) => item.statusMingguIni === "belum_mengirim"));

const active = ref<KpiLaporanQueueItem | null>(null);
const zoom = ref<string | null>(null);
const catatan = ref("");
const deciding = ref<"disetujui" | "ditolak" | null>(null);
const reviewError = ref("");
const message = ref("");

function open(item: KpiLaporanQueueItem) {
  active.value = item;
  catatan.value = item.catatanPendamping ?? "";
  reviewError.value = "";
}

async function decide(keputusan: "disetujui" | "ditolak") {
  if (!active.value) return;
  reviewError.value = "";
  if (keputusan === "ditolak" && !catatan.value.trim()) {
    reviewError.value = "Tulis catatan perbaikan sebelum menolak laporan.";
    return;
  }
  deciding.value = keputusan;
  try {
    const reviewed = await directus.request(
      endpoint<KpiLaporan, { keputusan: string; catatan: string | null }>(`/v1/program/kpi/laporan/${active.value.id}/review`, {
        method: "POST",
        body: { keputusan, catatan: catatan.value.trim() || null },
      }),
    );
    message.value = `Laporan ${active.value.pesertaInfo?.usaha.nama ?? ""} minggu ke-${reviewed.mingguKe} ${keputusan === "disetujui" ? "disetujui" : "dikembalikan untuk perbaikan"}.`;
    active.value = null;
    await Promise.all([refresh(), refreshPeserta()]);
  } catch (cause) {
    reviewError.value =
      requestErrorCode(cause) === "LAPORAN_SUDAH_DIREVIEW" ? "Laporan ini sudah direview." : "Keputusan tidak dapat disimpan. Coba lagi.";
  } finally {
    deciding.value = null;
  }
}

const rupiah = (value: number) => formatAnalyticsCurrency(value);
const capaianClass = (value: number | null) => (value !== null && value >= 100 ? "text-emerald-700" : "text-amber-700");
</script>

<template>
  <div class="flex w-full flex-col gap-6 pb-10">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Panel Pendampingan</h1>
      <p class="mt-1 text-sm text-muted-foreground">Verifikasi laporan KPI mingguan peserta program akselerasi.</p>
    </div>

    <p v-if="message" role="status" class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{{ message }}</p>

    <div role="tablist" aria-label="Status laporan" class="flex flex-wrap gap-2">
      <button
        v-for="item in TABS"
        :key="item.value"
        type="button"
        role="tab"
        :aria-selected="tab === item.value"
        class="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
        :class="tab === item.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
        @click="tab = item.value"
      >
        {{ item.label }}<template v-if="item.value === 'belum_mengirim'"> ({{ belumMengirim.length }})</template>
      </button>
    </div>

    <UiCard>
      <UiCardContent class="overflow-x-auto p-0">
        <template v-if="tab === 'belum_mengirim'">
          <p v-if="!belumMengirim.length" class="p-6 text-sm text-muted-foreground">Semua peserta sudah mengirim laporan minggu ini.</p>
          <ul v-else class="divide-y text-sm">
            <li v-for="item in belumMengirim" :key="item.id" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p class="font-medium">{{ item.usaha.nama }}</p>
                <p class="text-xs text-muted-foreground">Minggu ke-{{ item.mingguBerjalan }} · Batch {{ item.batch }} · {{ item.usaha.kota || "—" }}</p>
              </div>
              <NuxtLink :to="`/dashboard/pendampingan/${item.id}`" class="font-semibold underline">Tren</NuxtLink>
            </li>
          </ul>
        </template>
        <div v-else-if="error" role="alert" class="p-6 text-sm text-destructive">Antrean laporan tidak dapat dimuat.</div>
        <div v-else-if="pending && !queue?.length" class="p-6 text-sm text-muted-foreground">Memuat…</div>
        <div v-else-if="!queue?.length" class="p-6 text-sm text-muted-foreground">Tidak ada laporan dengan status ini.</div>
        <table v-else class="w-full min-w-[44rem] text-sm">
          <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th class="px-4 py-3">Usaha</th>
              <th class="px-4 py-3">Minggu</th>
              <th class="px-4 py-3 text-right">Omzet</th>
              <th class="px-4 py-3 text-right">Capaian</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in queue" :key="item.id" class="border-b last:border-0">
              <td class="px-4 py-3">
                <p class="font-medium">{{ item.pesertaInfo?.usaha.nama }}</p>
                <p class="text-xs text-muted-foreground">Batch {{ item.pesertaInfo?.batch }}</p>
              </td>
              <td class="px-4 py-3">{{ item.mingguKe }}</td>
              <td class="px-4 py-3 text-right tabular-nums">{{ rupiah(item.realisasiOmzet) }}</td>
              <td class="px-4 py-3 text-right font-semibold tabular-nums" :class="capaianClass(item.capaianPersen)">{{ item.capaianPersen ?? "—" }}%</td>
              <td class="px-4 py-3"><ProgramStatusPill :meta="LAPORAN_STATUS[item.status]" /></td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-3 whitespace-nowrap">
                  <button type="button" class="font-semibold underline" @click="open(item)">{{ item.status === "menunggu" ? "Review" : "Lihat" }}</button>
                  <NuxtLink :to="`/dashboard/pendampingan/${item.peserta}`" class="font-semibold underline">Tren</NuxtLink>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </UiCardContent>
    </UiCard>

    <UiDialog :open="Boolean(active)" @update:open="(value) => !value && (active = null)">
      <UiDialogScrollContent v-if="active" class="sm:max-w-2xl">
        <UiDialogHeader>
          <UiDialogTitle>{{ active.pesertaInfo?.usaha.nama }} · Minggu ke-{{ active.mingguKe }}</UiDialogTitle>
          <UiDialogDescription>Periksa foto bukti dan bandingkan dengan target mingguan.</UiDialogDescription>
        </UiDialogHeader>
        <div class="grid gap-4 text-sm">
          <div class="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3">
            <div><p class="text-xs text-muted-foreground">Target</p><p class="font-semibold">{{ rupiah(active.target) }}</p></div>
            <div><p class="text-xs text-muted-foreground">Omzet</p><p class="font-semibold">{{ rupiah(active.realisasiOmzet) }}</p></div>
            <div><p class="text-xs text-muted-foreground">Transaksi</p><p class="font-semibold">{{ active.jumlahTransaksi }}</p></div>
          </div>
          <p class="text-base font-bold" :class="capaianClass(active.capaianPersen)" data-testid="capaian">
            Capaian {{ active.capaianPersen ?? "—" }}% dari Target
          </p>
          <p v-if="active.kendala" class="rounded-md border p-2"><span class="font-medium">Kendala:</span> {{ active.kendala }}</p>
          <div>
            <p class="mb-2 font-medium">Foto bukti ({{ active.bukti.length }})</p>
            <p v-if="!active.bukti.length" class="text-muted-foreground">Tidak ada foto.</p>
            <div v-else class="grid grid-cols-3 gap-2 sm:grid-cols-5">
              <button v-for="(id, index) in active.bukti" :key="id" type="button" class="overflow-hidden rounded-md border" :aria-label="`Perbesar foto ${index + 1}`" @click="zoom = id">
                <img :src="assetUrl(id, 240)" :alt="`Foto bukti ${index + 1}`" class="aspect-square w-full object-cover transition-transform hover:scale-105">
              </button>
            </div>
          </div>
          <UiField v-if="active.status === 'menunggu'" class="gap-2">
            <UiFieldLabel for="catatan-pendamping">Catatan pendamping</UiFieldLabel>
            <UiTextarea id="catatan-pendamping" v-model="catatan" rows="3" maxlength="2000" placeholder="Wajib diisi bila meminta perbaikan bukti" />
          </UiField>
          <p v-else-if="active.catatanPendamping" class="text-muted-foreground">Catatan: {{ active.catatanPendamping }}</p>
          <p v-if="reviewError" role="alert" class="text-destructive">{{ reviewError }}</p>
        </div>
        <UiDialogFooter v-if="active.status === 'menunggu'" class="gap-2">
          <UiButton variant="destructive" :disabled="Boolean(deciding)" @click="decide('ditolak')">
            {{ deciding === "ditolak" ? "Menyimpan…" : "Tolak & Minta Perbaikan Bukti" }}
          </UiButton>
          <UiButton :disabled="Boolean(deciding)" @click="decide('disetujui')">
            {{ deciding === "disetujui" ? "Menyimpan…" : "Setujui & Verifikasi Laporan" }}
          </UiButton>
        </UiDialogFooter>
      </UiDialogScrollContent>
    </UiDialog>

    <UiDialog :open="Boolean(zoom)" @update:open="(value) => !value && (zoom = null)">
      <UiDialogContent v-if="zoom" class="sm:max-w-4xl">
        <UiDialogTitle class="sr-only">Foto bukti</UiDialogTitle>
        <img :src="assetUrl(zoom)" alt="Foto bukti ukuran penuh" class="max-h-[80vh] w-full object-contain">
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
