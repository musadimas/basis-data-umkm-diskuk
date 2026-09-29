<script setup lang="ts">
import { endpoint } from "~/lib/directus";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import type { InvestorDeal } from "~/types/executive";

definePageMeta({ layout: "landing" });
useSeoMeta({ title: "Deal Card Investor – Diskuk Jawa Barat" });

const route = useRoute();
const directus = useDirectus();
const id = String(route.params.id);
const { data, error, pending } = await useAsyncData(`investor:deal:${id}`, () =>
  directus.request(endpoint<InvestorDeal>(`/v1/program/executive/investor/${id}`)));
const pesan = ref("");
const submitting = ref(false);
const feedback = ref<{ tone: "success" | "error"; text: string } | null>(null);
const key = ref<string | null>(null);
async function sendLoi() {
  if (!pesan.value.trim()) return;
  key.value ??= crypto.randomUUID();
  submitting.value = true;
  feedback.value = null;
  try {
    await directus.request(endpoint<{ id: string; duplikat: boolean }, { pesan: string; idempotencyKey: string }>(
      `/v1/program/executive/investor/${id}/loi`, { method: "POST", body: { pesan: pesan.value.trim(), idempotencyKey: key.value } }));
    feedback.value = { tone: "success", text: "LOI tercatat dan dapat ditindaklanjuti kurator." };
    pesan.value = ""; key.value = null;
  } catch { feedback.value = { tone: "error", text: "LOI belum dapat dikirim. Coba lagi." }; }
  finally { submitting.value = false; }
}
const mengunduh = ref<"pdf" | "pitch-deck" | null>(null);
async function download(kind: "pdf" | "pitch-deck") {
  if (mengunduh.value) return;
  mengunduh.value = kind;
  feedback.value = null;
  try {
    const response: unknown = await directus.request(endpoint<Response>(`/v1/program/executive/investor/${encodeURIComponent(id)}/${kind}`));
    if (!(response instanceof Response)) throw new Error("Balasan bukan berkas.");
    const blob = await response.blob();
    if (blob.type !== "application/pdf" || !blob.size) { feedback.value = { tone: "error", text: "Dokumen tidak valid." }; return; }
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = objectUrl;
    anchor.download = `${kind}-${id}.pdf`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    feedback.value = { tone: "error", text: "Dokumen belum dapat diunduh." };
  } finally {
    mengunduh.value = null;
  }
}
const formatPercent = (value: number | null) => value == null ? "Belum tersedia" : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
</script>

<template>
  <div class="min-h-dvh">
    <LandingHeaderMask title="Deal Card Investor" subtitle="Kemitraan" badge-color="#cbd5e1" />
    <main class="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <NuxtLink to="/investor" class="text-sm underline">Kembali ke direktori</NuxtLink>
      <p v-if="pending" class="text-sm text-muted-foreground">Memuat deal card…</p>
      <p v-else-if="error" role="alert" class="text-sm text-destructive">Deal card tidak tersedia untuk akun ini atau persetujuan telah dicabut.</p>
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
          <UiButton v-if="data.produkId" as-child variant="outline"><NuxtLink :to="`/katalog/${data.produkId}`">Lihat portofolio produk</NuxtLink></UiButton>
          <UiButton variant="outline" :disabled="mengunduh !== null" @click="download('pdf')">{{ mengunduh === "pdf" ? "Menyiapkan…" : "Unduh Executive Summary PDF" }}</UiButton>
          <UiButton v-if="data.pitchDeckTersedia" variant="outline" :disabled="mengunduh !== null" @click="download('pitch-deck')">{{ mengunduh === "pitch-deck" ? "Menyiapkan…" : "Unduh pitch deck PDF" }}</UiButton>
        </div>
        <form class="space-y-3 rounded-xl border p-5" @submit.prevent="sendLoi">
          <h2 class="font-semibold">Ajukan minat kemitraan (LOI)</h2>
          <p class="text-sm text-muted-foreground">LOI terhubung ke produk katalog tayang dan menggunakan identitas akun investor terverifikasi.</p>
          <UiField class="gap-1">
            <UiFieldLabel for="loi-pesan">Pesan minat kemitraan</UiFieldLabel>
            <UiTextarea id="loi-pesan" v-model="pesan" required maxlength="2000" rows="4" placeholder="Jelaskan minat dan rencana kemitraan" />
          </UiField>
          <UiButton type="submit" :disabled="submitting || !data.produkId">Kirim LOI</UiButton>
          <p v-if="!data.produkId" class="text-sm">LOI tersedia setelah ada produk katalog tayang.</p>
          <p v-if="feedback" :role="feedback.tone === 'error' ? 'alert' : 'status'" class="text-sm" :class="feedback.tone === 'error' ? 'text-destructive' : 'text-emerald-700'">{{ feedback.text }}</p>
        </form>
      </template>
    </main>
  </div>
</template>
