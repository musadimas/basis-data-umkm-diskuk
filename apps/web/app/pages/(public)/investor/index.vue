<script setup lang="ts">
import { endpoint } from "~/lib/directus";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import type { InvestorItem } from "~/types/executive";

definePageMeta({ layout: "landing" });
useSeoMeta({ title: "Direktori Investor UMKM – Diskuk Jawa Barat" });

const directus = useDirectus();
const modal = ref("");
const skema = ref("");
const kbli = ref("");
const query = computed(() => ({ modal: modal.value || undefined, skema: skema.value || undefined, kbli: kbli.value || undefined }));
const { data, error, pending } = await useAsyncData("investor:directory", () =>
  directus.request(endpoint<InvestorItem[]>("/v1/program/executive/investor", { query: query.value })), { watch: [query] });
const schemes: [string, string][] = [
  ["kur", "KUR"], ["lpdb", "LPDB"], ["offtaker", "Offtaker"],
  ["penyertaan_modal", "Penyertaan modal"], ["konsinyasi", "Konsinyasi"], ["ekspor", "Ekspor"],
];
</script>

<template>
  <div class="min-h-dvh">
    <LandingHeaderMask title="Direktori Investor" subtitle="Kemitraan" badge-color="#cbd5e1" />
    <main class="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <header><h1 class="text-3xl font-bold">Direktori kemitraan investor</h1>
        <p class="text-muted-foreground">Hanya profil yang disetujui pelaku usaha dan kurator, untuk akun investor terverifikasi.</p></header>
      <div class="grid gap-3 sm:grid-cols-3">
        <UiField class="gap-1">
          <UiFieldLabel for="filter-modal">Kebutuhan modal</UiFieldLabel>
          <UiSelect v-model="modal">
            <UiSelectTrigger id="filter-modal"><UiSelectValue placeholder="Semua rentang" /></UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem value="kecil">&lt; Rp50 juta</UiSelectItem>
              <UiSelectItem value="menengah">Rp50–500 juta</UiSelectItem>
              <UiSelectItem value="besar">&gt; Rp500 juta</UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </UiField>
        <UiField class="gap-1">
          <UiFieldLabel for="filter-skema">Skema</UiFieldLabel>
          <UiSelect v-model="skema">
            <UiSelectTrigger id="filter-skema"><UiSelectValue placeholder="Semua skema" /></UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem v-for="option in schemes" :key="option[0]" :value="option[0]">{{ option[1] }}</UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </UiField>
        <UiField class="gap-1">
          <UiFieldLabel for="filter-kbli">KBLI (awalan 2–5 digit)</UiFieldLabel>
          <UiInput id="filter-kbli" v-model="kbli" inputmode="numeric" maxlength="5" pattern="[0-9]{2,5}" placeholder="Contoh: 10" />
        </UiField>
      </div>
      <p v-if="error" role="alert" class="rounded-md border p-4 text-sm">Direktori hanya tersedia untuk investor terverifikasi. <NuxtLink to="/sign-in?returnTo=%2Finvestor" class="underline">Masuk</NuxtLink></p>
      <div v-else-if="pending" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Memuat direktori">
        <UiSkeleton v-for="i in 3" :key="i" class="h-44 rounded-xl" />
      </div>
      <div v-else-if="!data?.length" role="status" class="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Tidak ada profil sesuai filter. Coba longgarkan filter di atas.
      </div>
      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <article v-for="item in data" :key="item.id" class="rounded-xl border p-5">
          <h2 class="text-lg font-semibold">{{ item.jenama }}</h2><p class="text-sm">{{ item.nama }} · {{ item.domisili || "Domisili belum tercatat" }}</p>
          <p class="mt-2 text-sm">KBLI {{ item.kbli || "—" }} · {{ formatAnalyticsCurrency(item.kebutuhanModal) }}</p>
          <p class="text-xs text-muted-foreground">{{ item.skema.join(", ") }}</p>
          <NuxtLink :to="`/investor/${item.id}`" class="mt-4 inline-block font-semibold underline">Lihat deal card</NuxtLink>
        </article>
      </div>
    </main>
  </div>
</template>
