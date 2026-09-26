<script setup lang="ts">
import OperasionalBuktiZoomPreview from "~/components/operasional/BuktiZoomPreview.vue";
import { berkasUrl, type AntreanItem, type LaporanDetail } from "~/types/operasional";
import { formatAnalyticsCurrency, formatAnalyticsPercent } from "~/lib/analytics-format";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Verifikasi Laporan KPI – Pendamping",
});

const filter = ref<"menunggu" | "disetujui" | "belum">("menunggu");
const daftar = ref<AntreanItem[]>([]);
const terpilih = ref<LaporanDetail | null>(null);
const catatan = ref("");
const pesan = ref<string | null>(null);

const FILTER_LABEL = {
  menunggu: "Menunggu Persetujuan",
  disetujui: "Telah Disetujui",
  belum: "Belum Mengirimkan Laporan",
} as const;

async function muat() {
  const res = await $fetch<{ data: AntreanItem[] }>("/panel/operasional/binaan/antrean", {
    query: { status: filter.value },
  });
  daftar.value = res.data;
}

onMounted(() => {
  void muat();
});

watch(filter, () => {
  void muat();
});

async function buka(item: AntreanItem) {
  if (!item.laporanId) return;
  pesan.value = null;
  catatan.value = "";
  const res = await $fetch<{ data: LaporanDetail }>(`/panel/operasional/laporan/${item.laporanId}`);
  terpilih.value = res.data;
}

function badgeCapaian(v: number | null | undefined): string {
  if (v === null || v === undefined) return "Target belum tersedia";
  return `Capaian ${formatAnalyticsPercent(v)} dari Target`;
}

function kelasCapaian(v: number | null | undefined): string {
  if (v === null || v === undefined) return "bg-slate-200 text-slate-800";
  if (v >= 100) return "bg-emerald-100 text-emerald-800";
  if (v >= 70) return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-800";
}

async function verifikasi(keputusan: "disetujui" | "ditolak") {
  if (!terpilih.value) return;
  pesan.value = null;
  if (keputusan === "ditolak" && catatan.value.trim().length < 3) {
    pesan.value = "Catatan minimal 3 karakter untuk penolakan.";
    return;
  }
  await $fetch(`/panel/operasional/laporan/${terpilih.value.laporanId}/verifikasi`, {
    method: "POST",
    body: { keputusan, catatan: catatan.value || null },
  });
  pesan.value = `Laporan minggu ke-${terpilih.value.mingguKe} ${keputusan === "disetujui" ? "disetujui" : "dikembalikan untuk perbaikan"}.`;
  terpilih.value = null;
  await muat();
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-4 pb-8">
    <h1 class="text-2xl font-bold">Verifikasi Laporan KPI Mingguan</h1>

    <div class="flex gap-2" role="group" aria-label="Filter status">
      <button
        v-for="k in (['menunggu','disetujui','belum'] as const)"
        :key="k"
        type="button"
        class="rounded border px-3 py-1 text-sm"
        :class="filter === k ? 'bg-slate-900 text-white' : ''"
        @click="filter = k"
      >
        {{ FILTER_LABEL[k] }}
      </button>
    </div>

    <ul class="space-y-2">
      <li v-for="item in daftar" :key="item.laporanId ?? item.talentaId" class="rounded border bg-card p-3 text-sm">
        <button v-if="item.laporanId" type="button" class="font-semibold underline" @click="buka(item)">
          {{ item.usaha.nama }} — Minggu {{ item.mingguKe }}
        </button>
        <span v-else class="font-semibold">{{ item.usaha.nama }} — Minggu {{ item.mingguKe }} (belum kirim)</span>
        <span class="ml-2 text-xs text-muted-foreground">{{ item.status }}</span>
      </li>
    </ul>
    <p v-if="daftar.length === 0" class="text-sm text-muted-foreground">Tidak ada antrean pada filter ini.</p>

    <div v-if="terpilih" role="dialog" aria-label="Pemeriksaan Bukti Fisik" class="rounded-xl border bg-card p-4">
      <h2 class="font-bold">Pemeriksaan Bukti Fisik</h2>
      <OperasionalBuktiZoomPreview
        v-if="terpilih.bukti"
        :src="berkasUrl(terpilih.bukti.id)"
        alt="Bukti laporan"
        :tipe="terpilih.bukti.tipe"
      />
      <p class="mt-2 text-sm">
        Realisasi Omzet {{ formatAnalyticsCurrency(terpilih.omzet) }} vs Target
        {{ terpilih.target === null ? "—" : formatAnalyticsCurrency(terpilih.target) }}
      </p>
      <p class="mt-1">
        <span class="rounded px-2 py-0.5 text-xs" :class="kelasCapaian(terpilih.capaianPersen)">
          {{ badgeCapaian(terpilih.capaianPersen) }}
        </span>
      </p>
      <p class="mt-1 text-sm">Transaksi: {{ terpilih.jumlahTransaksi }}</p>
      <p v-if="terpilih.catatanKendala" class="mt-1 text-sm">Kendala: {{ terpilih.catatanKendala }}</p>
      <label class="mt-3 block text-sm">
        Catatan Saran Bimbingan Usaha &amp; Verifikasi
        <textarea v-model="catatan" rows="3" class="mt-1 w-full rounded border p-2" />
      </label>
      <div class="mt-2 flex gap-2">
        <button type="button" class="rounded border px-3 py-1 text-sm" @click="verifikasi('ditolak')">
          Tolak &amp; Minta Perbaikan Bukti
        </button>
        <button type="button" class="rounded bg-emerald-600 px-3 py-1 text-sm text-white" @click="verifikasi('disetujui')">
          Setujui &amp; Verifikasi Laporan
        </button>
      </div>
    </div>

    <p v-if="pesan" role="status" class="rounded border bg-muted/40 p-3 text-sm">{{ pesan }}</p>
  </div>
</template>
