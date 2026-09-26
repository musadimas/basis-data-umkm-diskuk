<script setup lang="ts">
/** DISKUK's official contact (singleton kontak_hotline, public under ADR-006). */
import { Clock, Mail, MapPin, MessageCircle, Phone } from "@lucide/vue";
import { whatsappLink } from "~/lib/katalog";
import type { KontakHotline } from "~/types/program";

const props = defineProps<{ kontak: KontakHotline; pesan?: string }>();
const wa = computed(() => whatsappLink(props.kontak.whatsapp, props.pesan ?? "Halo DISKUK Jawa Barat, saya ingin bertanya."));
</script>

<template>
  <section class="grid gap-3 rounded-xl border bg-card p-5 text-sm" aria-label="Kontak resmi DISKUK">
    <h2 class="text-base font-bold">{{ kontak.nama_layanan }}</h2>
    <ul class="grid gap-2">
      <li v-if="kontak.telepon" class="flex items-center gap-2"><Phone class="size-4 shrink-0" aria-hidden="true" /> <a :href="`tel:${kontak.telepon.replace(/[^\d+]/g, '')}`" class="underline">{{ kontak.telepon }}</a></li>
      <li v-if="kontak.email" class="flex items-center gap-2"><Mail class="size-4 shrink-0" aria-hidden="true" /> <a :href="`mailto:${kontak.email}`" class="underline">{{ kontak.email }}</a></li>
      <li v-if="kontak.jam_layanan" class="flex items-center gap-2"><Clock class="size-4 shrink-0" aria-hidden="true" /> {{ kontak.jam_layanan }}</li>
      <li v-if="kontak.alamat" class="flex items-start gap-2"><MapPin class="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {{ kontak.alamat }}</li>
    </ul>
    <a v-if="wa" :href="wa" target="_blank" rel="noopener noreferrer" class="inline-flex w-fit items-center gap-2 rounded-md bg-[#25D366] px-4 py-2 font-semibold text-white hover:bg-[#1ebe5b]">
      <MessageCircle class="size-4" aria-hidden="true" /> Hubungi via WhatsApp
    </a>
  </section>
</template>
