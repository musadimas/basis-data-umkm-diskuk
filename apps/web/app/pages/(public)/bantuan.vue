<script setup lang="ts">
import { readItems, readSingleton } from "@directus/sdk";
import type { FaqEntry, KontakHotline } from "~/types/program";

definePageMeta({ layout: "landing" });
useSeoMeta({
  title: "Bantuan & FAQ – Diskuk Jawa Barat",
  description: "Pertanyaan umum seputar program UMKM Jawa Barat dan kontak hotline DISKUK.",
});

const directus = useDirectus();
const { data: faq } = await useAsyncData("bantuan:faq", async () => {
  try {
    const items = await directus.request(readItems("faq", { fields: ["id", "pertanyaan", "jawaban", "kategori", "sort"], sort: ["sort", "id"], limit: 100 } as never));
    return (Array.isArray(items) ? items : []) as FaqEntry[];
  } catch {
    return [];
  }
});
const { data: kontak } = await useAsyncData("bantuan:kontak", async () => {
  try {
    const item = await directus.request(readSingleton("kontak_hotline"));
    return item && typeof item === "object" && "nama_layanan" in item ? (item as KontakHotline) : null;
  } catch {
    return null;
  }
});
const items = computed(() => (faq.value ?? []).map((entry) => ({ question: entry.pertanyaan, answer: entry.jawaban })));
</script>

<template>
  <div class="min-h-dvh">
    <LandingHeaderMask title="Bantuan" subtitle="FAQ & Hotline" badge-color="#cbd5e1" />
    <div class="mx-auto grid max-w-7xl gap-8 px-3 pb-10 | lg:px-12 xl:px-0">
      <ProgramHotlineCard v-if="kontak" :kontak="kontak" />
    </div>
    <LandingFaq :items="items" />
  </div>
</template>
