<script setup lang="ts">
import { laporanStatusLabel, laporanStatusClass } from "~/constants/OPERASIONAL";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import type { Binaan } from "~/types/operasional";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Dasbor Binaan Aktif – Dashboard Basis Data UMKM DisKUK Jawa Barat",
});

const data = ref<Binaan[]>([]);
const galat = ref<string | null>(null);

async function muat() {
  try {
    const res = await $fetch<{ data: Binaan[] }>("/panel/operasional/binaan");
    data.value = res.data;
  } catch {
    galat.value = "Gagal memuat binaan.";
  }
}

onMounted(() => {
  void muat();
});
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-5 pb-8">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">Dasbor Binaan Aktif</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Pantau usaha UMKM yang Anda dampingi dalam program pendampingan.
      </p>
    </div>

    <p v-if="galat" role="status" class="rounded border p-3 text-sm">{{ galat }}</p>
    <p v-if="data.length === 0 && !galat" class="rounded-xl border border-border/80 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      Belum ada peserta binaan.
    </p>

    <article v-for="b in data" :key="b.talentaId" class="rounded-xl border bg-card p-4">
      <h2 class="font-bold">{{ b.usaha.nama }}</h2>
      <p class="text-xs text-muted-foreground">{{ b.pemilik }} — {{ b.kota }} — {{ b.batch?.nama }}</p>
      <OperasionalProgresMingguan :minggu-berjalan="b.mingguBerjalan" :jumlah-minggu="b.jumlahMinggu" class="mt-2" />
      <p class="mt-2 text-xs">Target minggu ini: {{ b.targetMingguan === null ? "—" : formatAnalyticsCurrency(b.targetMingguan) }}</p>
      <p class="mt-1">
        <span v-if="b.statusMingguIni === 'belum'" class="rounded bg-slate-200 px-2 py-0.5 text-xs">Belum Mengirimkan Laporan</span>
        <span v-else class="rounded px-2 py-0.5 text-xs" :class="laporanStatusClass(b.statusMingguIni)">{{ laporanStatusLabel(b.statusMingguIni) }}</span>
        <span v-if="b.rekomendasiPitching" class="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Direkomendasikan</span>
      </p>
      <div class="mt-2 flex gap-2 text-xs">
        <NuxtLink :to="`/dashboard/binaan/${b.talentaId}`" class="rounded border px-3 py-1">Detail</NuxtLink>
        <NuxtLink to="/dashboard/binaan/verifikasi" class="rounded border px-3 py-1">Verifikasi Laporan KPI</NuxtLink>
      </div>
    </article>
  </div>
</template>
