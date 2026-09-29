<script setup lang="ts">
import { endpoint } from "~/lib/directus";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import type { InvestorDeal } from "~/types/executive";

useSeoMeta({ title: "Deal Card Investor" });
const route = useRoute();
const directus = useDirectus();
const id = String(route.params.id);
const { data, error } = await useAsyncData(`investor:deal:${id}`, () =>
  directus.request(endpoint<InvestorDeal>(`/v1/program/executive/investor/${id}`)));
const pesan = ref("");
const submitting = ref(false);
const feedback = ref("");
const key = ref<string | null>(null);
async function sendLoi() {
  if (!pesan.value.trim()) return;
  key.value ??= crypto.randomUUID();
  submitting.value = true;
  try {
    await directus.request(endpoint<{ id: string; duplikat: boolean }, { pesan: string; idempotencyKey: string }>(
      `/v1/program/executive/investor/${id}/loi`, { method: "POST", body: { pesan: pesan.value.trim(), idempotencyKey: key.value } }));
    feedback.value = "LOI tercatat dan dapat ditindaklanjuti kurator.";
    pesan.value = ""; key.value = null;
  } catch { feedback.value = "LOI belum dapat dikirim. Coba lagi."; }
  finally { submitting.value = false; }
}
async function download(kind: "pdf" | "pitch-deck") {
  const response = await fetch(`/panel/v1/program/executive/investor/${encodeURIComponent(id)}/${kind}`, { credentials: "include", cache: "no-store" });
  if (!response.ok) { feedback.value = "Dokumen belum dapat diunduh."; return; }
  const blob = await response.blob();
  if (blob.type !== "application/pdf" || !blob.size) { feedback.value = "Dokumen tidak valid."; return; }
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = objectUrl;
  anchor.download = `${kind}-${id}.pdf`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
const formatPercent = (value: number | null) => value == null ? "Belum tersedia" : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
</script>

<template>
  <main class="mx-auto max-w-4xl space-y-6 px-4 py-10">
    <NuxtLink to="/investor" class="text-sm underline">Kembali ke direktori</NuxtLink>
    <p v-if="error" role="alert">Deal card tidak tersedia untuk akun ini atau persetujuan telah dicabut.</p>
    <template v-else-if="data">
      <header><h1 class="text-3xl font-bold">{{ data.jenama }}</h1><p>{{ data.nama }} · {{ data.domisili || "Domisili belum tercatat" }}</p></header>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-xl border p-4"><h2 class="font-semibold">Talent Index Score</h2><p class="text-2xl">{{ data.talentIndex ?? "—" }}</p>
          <p class="text-xs text-muted-foreground">{{ data.talentIndexSumber || "Belum terverifikasi" }}</p></div>
        <div class="rounded-xl border p-4"><h2 class="font-semibold">Pertumbuhan omzet mingguan</h2><p class="text-2xl">{{ formatPercent(data.pertumbuhanOmzetMingguan) }}</p>
          <p class="text-xs text-muted-foreground">{{ data.pertumbuhanSumber || "Belum ada dua pekan terverifikasi berurutan" }}</p></div>
        <div class="rounded-xl border p-4"><h2 class="font-semibold">Margin</h2><p class="text-2xl">{{ formatPercent(data.marginPersen) }}</p>
          <p class="text-xs text-muted-foreground">{{ data.marginSumber === "deklarasi" ? "Deklarasi pelaku usaha" : "Terverifikasi" }}</p></div>
        <div class="rounded-xl border p-4"><h2 class="font-semibold">Kebutuhan dana</h2><p class="text-2xl">{{ data.kebutuhanModal == null ? "—" : formatAnalyticsCurrency(data.kebutuhanModal) }}</p>
          <p class="text-xs text-muted-foreground">Kapasitas pasok: {{ data.kapasitasPasok || "Belum diisi" }}</p></div>
      </div>
      <p>KBLI {{ data.kbli || "—" }} · Skema: {{ data.skema.join(", ") }}</p>
      <div class="flex flex-wrap gap-3">
        <NuxtLink v-if="data.produkId" :to="`/katalog/${data.produkId}`" class="rounded-md border px-4 py-2">Lihat portofolio produk</NuxtLink>
        <button type="button" class="rounded-md border px-4 py-2" @click="download('pdf')">Unduh Executive Summary PDF</button>
        <button v-if="data.pitchDeckTersedia" type="button" class="rounded-md border px-4 py-2" @click="download('pitch-deck')">Unduh pitch deck PDF</button>
      </div>
      <form class="space-y-3 rounded-xl border p-5" @submit.prevent="sendLoi">
        <h2 class="font-semibold">Ajukan minat kemitraan (LOI)</h2>
        <p class="text-sm text-muted-foreground">LOI terhubung ke produk katalog tayang dan menggunakan identitas akun investor terverifikasi.</p>
        <textarea v-model="pesan" required maxlength="2000" rows="4" class="w-full rounded-md border p-2" placeholder="Jelaskan minat dan rencana kemitraan" />
        <button type="submit" :disabled="submitting || !data.produkId" class="rounded-md bg-primary px-4 py-2 text-primary-foreground">Kirim LOI</button>
        <p v-if="!data.produkId" class="text-sm">LOI tersedia setelah ada produk katalog tayang.</p>
        <p v-if="feedback" role="status" class="text-sm">{{ feedback }}</p>
      </form>
    </template>
  </main>
</template>
