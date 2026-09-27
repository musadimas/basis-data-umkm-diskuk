<script setup lang="ts">
import { MapPin, MessageCircle, Package } from "@lucide/vue";
import { KATEGORI_PRODUK, SKALA_LABEL, TALENT_BADGE_STATUS, assetUrl } from "~/constants";
import { hargaRange, sertifikasiList, whatsappLink } from "~/lib/katalog";
import type { ProdukPublik } from "~/types/program";

const props = defineProps<{ produk: ProdukPublik }>();

const foto = computed(() => props.produk.foto?.[0]?.directus_files_id ?? null);
const harga = computed(() => hargaRange(props.produk));
const kategori = computed(() => KATEGORI_PRODUK.find((item) => item.value === props.produk.kategori)?.label);
const talent = computed(() => TALENT_BADGE_STATUS.some((status) => status === props.produk.usaha_talent_status));
const wa = computed(() =>
  whatsappLink(props.produk.usaha_whatsapp, `Halo ${props.produk.usaha_nama ?? ""}, saya tertarik dengan produk "${props.produk.nama}" di Katalog UMKM Jawa Barat.`),
);
const badges = computed(() => {
  const list: { label: string; className: string }[] = [];
  if (props.produk.status_kurasi === "rekomendasi_marketplace") list.push({ label: "Rekomendasi", className: "bg-indigo-600 text-white" });
  if (talent.value) list.push({ label: "Talent Jabar", className: "bg-amber-400 text-amber-950" });
  for (const jenis of sertifikasiList(props.produk.usaha_sertifikasi)) list.push({ label: jenis.toUpperCase(), className: "bg-emerald-100 text-emerald-800" });
  if (props.produk.usaha_pdn || props.produk.pdn_deklarasi) list.push({ label: "PDN", className: "bg-red-100 text-red-800" });
  if (props.produk.usaha_ramah_disabilitas) list.push({ label: "Ramah Disabilitas", className: "bg-sky-100 text-sky-800" });
  return list;
});
</script>

<template>
  <article class="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md" data-testid="product-card">
    <NuxtLink :to="`/katalog/${produk.id}`" class="flex flex-1 flex-col">
      <figure class="relative aspect-square overflow-hidden bg-muted">
        <img
          v-if="foto"
          :src="assetUrl(foto, 480)"
          :alt="produk.nama"
          class="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        >
        <Package v-else class="absolute inset-0 m-auto size-10 text-muted-foreground" aria-hidden="true" />
        <div v-if="badges.length" class="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
          <span v-for="badge in badges" :key="badge.label" class="rounded px-1.5 py-0.5 text-[10px] font-bold" :class="badge.className">{{ badge.label }}</span>
        </div>
      </figure>
      <div class="flex flex-1 flex-col gap-1 p-3">
        <p class="truncate text-[11px] font-semibold uppercase tracking-wide text-primary">
          {{ produk.usaha_nama }}<template v-if="produk.usaha_skala"> · {{ SKALA_LABEL[produk.usaha_skala] }}</template>
        </p>
        <h3 class="line-clamp-2 text-sm font-medium leading-snug">{{ produk.nama }}</h3>
        <p v-if="kategori" class="text-xs text-muted-foreground">{{ kategori }}</p>
        <p v-if="produk.usaha_kota_nama" class="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin class="size-3 shrink-0" aria-hidden="true" />
          <span class="truncate">{{ produk.usaha_kota_nama }}</span>
        </p>
        <p v-if="harga" class="mt-auto pt-1 text-sm font-semibold">{{ harga }}</p>
        <p v-if="produk.moq" class="text-xs text-muted-foreground">MOQ {{ new Intl.NumberFormat("id-ID").format(produk.moq) }}</p>
      </div>
    </NuxtLink>
    <a
      v-if="wa"
      :href="wa"
      target="_blank"
      rel="noopener noreferrer"
      class="m-3 mt-0 inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1ebe5b]"
    >
      <MessageCircle class="size-4" aria-hidden="true" /> WhatsApp
    </a>
  </article>
</template>
