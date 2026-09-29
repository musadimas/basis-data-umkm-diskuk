<script setup lang="ts">
import { endpoint } from "~/lib/directus";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import type { InvestorItem } from "~/types/executive";

useSeoMeta({ title: "Direktori Investor UMKM" });
const directus = useDirectus();
const modal = ref("");
const skema = ref("");
const kbli = ref("");
const query = computed(() => ({ modal: modal.value || undefined, skema: skema.value || undefined, kbli: kbli.value || undefined }));
const { data, error, pending } = await useAsyncData("investor:directory", () =>
  directus.request(endpoint<InvestorItem[]>("/v1/program/executive/investor", { query: query.value })), { watch: [query] });
const schemes = [
  ["kur", "KUR"], ["lpdb", "LPDB"], ["offtaker", "Offtaker"],
  ["penyertaan_modal", "Penyertaan modal"], ["konsinyasi", "Konsinyasi"], ["ekspor", "Ekspor"],
];
</script>

<template>
  <main class="mx-auto max-w-6xl space-y-6 px-4 py-10">
    <header><h1 class="text-3xl font-bold">Direktori kemitraan investor</h1>
      <p class="text-muted-foreground">Hanya profil yang disetujui pelaku usaha dan kurator, untuk akun investor terverifikasi.</p></header>
    <div class="grid gap-3 sm:grid-cols-3">
      <label class="grid gap-1 text-sm">Kebutuhan modal
        <select v-model="modal" class="rounded-md border bg-background p-2"><option value="">Semua rentang</option>
          <option value="kecil">&lt; Rp50 juta</option><option value="menengah">Rp50–500 juta</option><option value="besar">&gt; Rp500 juta</option></select></label>
      <label class="grid gap-1 text-sm">Skema
        <select v-model="skema" class="rounded-md border bg-background p-2"><option value="">Semua skema</option>
          <option v-for="option in schemes" :key="option[0]" :value="option[0]">{{ option[1] }}</option></select></label>
      <label class="grid gap-1 text-sm">KBLI (awalan 2–5 digit)
        <input v-model="kbli" inputmode="numeric" maxlength="5" pattern="[0-9]{2,5}" class="rounded-md border bg-background p-2" placeholder="Contoh: 10" ></label>
    </div>
    <p v-if="error" role="alert" class="rounded-md border p-4 text-sm">Direktori hanya tersedia untuk investor terverifikasi. <NuxtLink to="/sign-in?returnTo=%2Finvestor" class="underline">Masuk</NuxtLink></p>
    <p v-else-if="pending" class="text-sm">Memuat direktori…</p>
    <p v-else-if="!data?.length" class="text-sm">Tidak ada profil sesuai filter.</p>
    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <article v-for="item in data" :key="item.id" class="rounded-xl border p-5">
        <h2 class="text-lg font-semibold">{{ item.jenama }}</h2><p class="text-sm">{{ item.nama }} · {{ item.domisili || "Domisili belum tercatat" }}</p>
        <p class="mt-2 text-sm">KBLI {{ item.kbli || "—" }} · {{ formatAnalyticsCurrency(item.kebutuhanModal) }}</p>
        <p class="text-xs text-muted-foreground">{{ item.skema.join(", ") }}</p>
        <NuxtLink :to="`/investor/${item.id}`" class="mt-4 inline-block font-semibold underline">Lihat deal card</NuxtLink>
      </article>
    </div>
  </main>
</template>
